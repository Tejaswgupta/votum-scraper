import cors from "cors";
import 'dotenv/config';
import express from "express";
import { fetchAdvocate } from "./advocate.js";
import { fetchAdvocateHC } from "./advocateHighCourt.js";
import { fetchCaseNum } from "./caseNumber.js";
import { fetchCaseNumHC } from "./caseNumberHighCourt.js";
import { fetchCNR } from "./cnrNumber.js";
import { fetchCNRhighcourt } from "./cnrNumberHighCourt.js";
import { predictStatutes } from "./statute.js";
import cluster from 'cluster'
import os from 'os';

const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
  console.log(` 🚹 Master Started. ${process.pid} Deploying Workers Now.. `);

  for (let i = 0; i < numCPUs; i++) {
    console.log(`  🐎 Worker Deployed ==> With Identity ${i+1}`)
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
  });
}else{
  const app = express();

  app.use(cors());
  app.use(express.json());
  
  const port = 3001;
  
  async function runScriptWithFormData(scriptPath, formData, res) {
    try {
      if (scriptPath == "caseNumber.js") {
        const val = await fetchCaseNum(formData);
        console.log(val);
        console.log(typeof val);
  
        res.json(JSON.parse(val));
      } else if (scriptPath == "advocate.js") {
        const val = await fetchAdvocate(formData);
        console.log(val);
        console.log(typeof val);
  
        res.json(JSON.parse(val));
      } else if (scriptPath == "cnrNumber.js") {
        const val = await fetchCNR(formData);
        console.log(val);
        console.log(typeof val);
  
        res.json(JSON.parse(val));
      } else if (scriptPath == "caseNumberHighCourt.js") {
        const val = await fetchCaseNumHC(formData);
        console.log(val);
        console.log(typeof val);
  
        res.json(JSON.parse(val));
      }
      else if (scriptPath == "advocateHighCourt.js") {
        const val = await fetchAdvocateHC(formData);
        console.log(val);
        console.log(typeof val);
  
        res.json(JSON.parse(val));
      }
      else if (scriptPath == "cnrNumberHighCourt.js") {
        const val = await fetchCNRhighcourt(formData);
        console.log(val);
        console.log(typeof val);
  
        res.json(JSON.parse(val));
      }
    } catch (err) {
      console.error("Failed to handle script execution or file operations:", err);
      res.status(500).send("Server error");
    }
  }
  // { "court": "district court", "searchType": "Case Number", "state": "Uttar Pradesh", "district": "Kanpur Nagar", "courtComplex": "Kanpur Nagar District Court Complex", "caseType": "CRIMINAL APPEAL", "caseNumber": "01", "Year": 2024 }
  
  app.post("/search", (req, res) => {
    const formData = req.body;
    let scriptPath;
  
    if (formData.court === "district court") {
      switch (formData.searchType) {
        case "Case Number":
          scriptPath = "caseNumber.js";
          break;
  
        case "Advocate":
          scriptPath = "advocate.js";
          break;
  
        case "CNR Number":
          scriptPath = "cnrNumber.js";
          break;
  
        default:
          console.log(`Invalid search type: ${formData.searchType}`);
          return res.status(400).send("Invalid search type");
      }
    } else if (formData.court === "high court") {
      switch (formData.searchType) {
        case 'Case Number':
          scriptPath = 'caseNumberHighCourt.js';
          break;
        case 'Advocate':
          scriptPath = 'advocateHighCourt.js';
          break;
        case 'CNR Number':
          scriptPath = 'cnrNumberHighCourt.js';
          break;
        default:
          console.log(`Invalid search type: ${formData.searchType}`);
          return res.status(400).send('Invalid search type');
      }
    }
    console.log(
      `Processing search request. Type: ${formData.searchType}, Script: ${scriptPath}`
    );
    runScriptWithFormData(scriptPath, formData, res);
  });
  
  app.post("/statute", async (req, res) => {
    console.log(req.body);
    const statute = await predictStatutes(req.body.firText, req.body.language);
    res.status(200).send(statute);
  });
  
  app.listen(port, () => {
    if (cluster.worker.id === 1) {
    console.log(` => 🌟 Server running at http://localhost:${port}`);
    }
    
  });
  
  // server.js file mein
  app.get("/", (req, res) => {
    res.send("Main Page!");
  });
  
  app.post("/statute", async (req, res) => {
    console.log(req.body);
    const statute = await predictStatutes(req.body.firText, req.body.language);
    res.status(200).send(statute);
  });


  app.use((err, req, res, next) => {
    console.error("Global error handler:", err);
    res.status(500).send("There is some issue with your current request");
  });
  
}

