import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { exec } from 'child_process';
import fs from 'fs';
import { writeFile, unlink } from 'fs/promises';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Use CORS
app.use(cors());

const port = 3001;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

async function runScriptWithFormData(scriptPath, formData, res , resultFilePrefix) {
    // Generate a unique temporary filename
    const tempFileName = `formData-${Date.now()}.json`;
    try {
        // Write formData to a temporary file
        await writeFile(tempFileName, JSON.stringify(formData), 'utf8');

        // Execute the script, passing the path to the temporary file
        exec(`node ${scriptPath} ${tempFileName}`, async (error) => {
            // After script execution, delete the temporary file
            await unlink(tempFileName);

            if (error) {
                console.error(`exec error: ${error}`);
                return res.status(500).send('Error executing search');
            }

            // Function to find the latest result file based on the naming convention
           // Function to find the latest result file based on the naming convention
function findLatestResultFile(dir, prefix) {
    console.log(`Looking for files in: ${dir} with prefix: ${prefix}`);
    const files = fs.readdirSync(dir).filter(file => file.startsWith(prefix));
    console.log(`Found files: ${files.join(', ')}`);
    files.sort();
    const latestFile = files.length ? files[files.length - 1] : null;
    console.log(`Latest file: ${latestFile}`);
    return latestFile;
}


            // Assuming the script saves the result in the current directory
            const resultsDir = __dirname;
            const latestFile = findLatestResultFile(resultsDir, resultFilePrefix);

            if (!latestFile) {
                return res.status(404).send('No results file found');
            }

            const filePath = path.join(resultsDir, latestFile);

            // Read and send the file contents
            fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                    console.error('Unable to read result file:', err);
                    return res.status(500).send('Error reading result file');
                }
                res.json(JSON.parse(data));
            });
        });
    } catch (err) {
        console.error('Failed to write or delete temporary file:', err);
    }
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
        default:
            return res.status(400).send('Invalid search type');
    }

    runScriptWithFormData(scriptPath, formData, res, resultFilePrefix);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
