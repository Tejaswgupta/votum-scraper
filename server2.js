import express from 'express';
import cors from 'cors';
import { exec as execCb } from 'child_process';
import { promises as fs } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import path from 'path';
import { promisify } from 'util';

const exec = promisify(execCb); // Convert exec to promise-based

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

const port = 3001;

async function runScriptWithFormData(scriptPath, formData, res, resultFilePrefix) {
    const tempFileName = `formData-${Date.now()}.json`;
    console.log(`Creating temporary file: ${tempFileName}`);
    try {
        await fs.writeFile(tempFileName, JSON.stringify(formData), 'utf8');
        console.log(`Temporary file ${tempFileName} created successfully.`);

        try {
            const { stdout, stderr } = await exec(`node ${scriptPath} ${tempFileName}`);
            console.log(`Script executed successfully. stdout: ${stdout}`);
            if (stderr) console.error(`Script execution errors: ${stderr}`);
        } finally {
            await fs.unlink(tempFileName);
            console.log(`Temporary file ${tempFileName} deleted.`);
        }

        const latestFile = await findLatestResultFile(__dirname, resultFilePrefix);
        console.log(`Latest result file found: ${latestFile}`);

        if (!latestFile) {
            console.log('No results file found.');
            return res.status(404).send('No results file found');
        }

        const filePath = path.join(__dirname, latestFile);
        const data = await fs.readFile(filePath, 'utf8');
        console.log(`Result file ${latestFile} read successfully.`);

        res.json(JSON.parse(data));

        await fs.unlink(filePath);
        console.log(`Result file ${latestFile} deleted.`);
    } catch (err) {
        console.error('Failed to handle script execution or file operations:', err);
        res.status(500).send('Server error');
    }
}

async function findLatestResultFile(dir, prefix) {
    console.log(`Searching for latest result file in ${dir} with prefix ${prefix}`);
    const files = await fs.readdir(dir);
    const filteredFiles = files.filter(file => file.startsWith(prefix)).sort();
    const latestFile = filteredFiles.length ? filteredFiles[filteredFiles.length - 1] : null;
    return latestFile;
}

app.post('/search', (req, res) => {
    const formData = req.body;
    let scriptPath, resultFilePrefix;

    switch (formData.searchType) {
        case 'Case Number':
            scriptPath = 'caseNumber.js';
            resultFilePrefix = 'caseNoResults';
            break;
        case 'Advocate':
            scriptPath = 'advocate.js';
            resultFilePrefix = 'AdvResults';
            break;
        case 'CNR Number':
            scriptPath = 'cnrNumber.js';
            resultFilePrefix = 'caseDetails';
            break;
        default:// Choose files based on court type
        if (formData.court === "district court") {
          switch (formData.searchType) {
            case 'Case Number':
              scriptPath = './caseNumber.js';
              resultFilePrefix = 'caseNoResults';
              break;
            case 'Advocate':
              scriptPath = './advocate.js';
              resultFilePrefix = 'AdvResults';
              break;
            case 'CNR Number':
              scriptPath = './cnrNumber.js';
              resultFilePrefix = 'caseDetails';
              break;
            default:
              console.log(`Invalid search type: ${formData.searchType}`);
              return res.status(400).send('Invalid search type');
          }
        } else if (formData.court === "high court") {
          switch (formData.searchType) {
            case 'Case Number':
              scriptPath = './caseNumberHighCourt.js';
              resultFilePrefix = 'caseNoResults';
              break;
            case 'Advocate':
              scriptPath = './advocateHighCourt.js';
              resultFilePrefix = 'AdvResults';
              break;
            case 'CNR Number':
              scriptPath = './cnrNumberHighCourt.js';
              resultFilePrefix = 'caseDetails';
              break;
            default:
              console.log(`Invalid search type: ${formData.searchType}`);
              return res.status(400).send('Invalid search type');
          }
        }
            console.log(`Invalid search type: ${formData.searchType}`);
            return res.status(400).send('Invalid search type');
    }

    console.log(`Processing search request. Type: ${formData.searchType}, Script: ${scriptPath}`);
    runScriptWithFormData(scriptPath, formData, res, resultFilePrefix);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
