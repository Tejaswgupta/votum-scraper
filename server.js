import cors from "cors";
import express from "express";
import { fetchAdvocate } from "./advocate.js";
import { fetchCaseNum } from "./caseNumber.js";
import { fetchCNR } from "./cnrNumber.js";
import { predictStatutes } from "./statute.js";

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
    }
  } catch (err) {
    console.error("Failed to handle script execution or file operations:", err);
    res.status(500).send("Server error");
  }
}

app.post("/search", (req, res) => {
  const formData = req.body;
  let scriptPath;

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

  console.log(
    `Processing search request. Type: ${formData.searchType}, Script: ${scriptPath}`
  );
  runScriptWithFormData(scriptPath, formData, res);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
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
