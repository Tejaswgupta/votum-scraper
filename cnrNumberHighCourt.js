import puppeteer from "puppeteer";
import { getCaptchaUsingAPI } from "./utils.js";

// Function to close any visible modal
async function closeVisibleModal(page) {
  try {
    // Wait for the modal's OK button to be visible
    await page.waitForSelector('.btn-primary[data-bs-dismiss="modal"]', {
      visible: true,
      timeout: 2000,
    }); // Adjust timeout as needed
    // Click the OK button to close the modal
    await page.click('.btn-primary[data-bs-dismiss="modal"]');
    console.log("Modal closed successfully.");
    return true;
  } catch (error) {
    console.log("No modal found or error closing modal:", error.message);
    return false;
  }
}

//Updated attemptCaptcha function
async function attemptCaptcha(page) {
  let captchaSolved = false;
  let formSubmitted = false;
  while (!captchaSolved) {
    // Click the CAPTCHA refresh button before each attempt
    await page.waitForSelector('a[title="Refresh Image"] img.refresh-btn', {
      visible: true,
    });
    await page.click('a[title="Refresh Image"] img.refresh-btn');

    // Wait a bit for the new CAPTCHA to load
    await delay(2000);

    const img = await page.$("#captcha_image");
    //!Using API
    const screenshotData = await img.screenshot();
    const text = await getCaptchaUsingAPI(screenshotData);

    // Clear the CAPTCHA input field before typing
    await page.evaluate(() => (document.getElementById("captcha").value = ""));
    // Enter the captcha text
    await page.type("#captcha", text, { delay: 100 });
    formSubmitted = false;
    // Submit the form
    if (!formSubmitted) {
      // Wait for the button to be loaded on the page
      await page.waitForSelector("#searchbtn");

      // Click the button using its class name and value attribute
      await page.evaluate(() => {
        document.querySelector("#searchbtn").click();
      });
      formSubmitted = true; // Mark the form as submitted

      // Wait for the response to the submission
      await delay(3000);

      // Check and close non-numeric character modal
      const modalcheck = await closeVisibleModal(page);
      if (modalcheck) {
        await page.click('a[title="Refresh Image"] img.refresh-btn');
        await delay(500);
        continue;
      }
      // Check for incorrect captcha submission
      const backBtnVisible = await page.evaluate(() => {
        const backbtn = document.querySelector("#bckbtn");
        return backbtn;
      });

      if (backBtnVisible) {
        console.log("Invalid CAPTCHA. Retrying...");
        formSubmitted = false; // Allow retrying the captcha submission
        continue; // Continue to the next iteration of the loop to retry solving the captcha
      } else {
        captchaSolved = true;
        console.log("CAPTCHA solved successfully. Form submitted.");
        return true; // Exit the loop indicating success
      }
    }
  }
}

async function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

// This function will be triggered with the user's form data
async function scrapeCourtData(formData) {
  const browser = await puppeteer.launch({
    headless: false, // Adjust based on your preference
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-accelerated-2d-canvas",
    ],
  }); // Set to false for debugging, true for production
  const page = await browser.newPage();

  // Navigate to the eCourts page
  await page.goto("https://hcservices.ecourts.gov.in/hcservices/", {
    waitUntil: "networkidle0",
  });

  // Select High Court
  await page.evaluate((highCourt) => {
    const selectElement = document.querySelector("#sess_state_code");
    Array.from(selectElement.options).forEach((option) => {
      if (option.textContent === highCourt) {
        selectElement.value = option.value;
      }
    });
    // Trigger change event after selecting the option
    const event = new Event("change", { bubbles: true });
    selectElement.dispatchEvent(event);
  }, formData.highCourt);

  // Select Bench
  await page.evaluate((bench) => {
    const selectElement = document.querySelector("#court_complex_code");
    Array.from(selectElement.options).forEach((option) => {
      if (option.textContent.trim() === bench) {
        selectElement.value = option.value;
      }
    });
    // Trigger change event after selecting the option
    const event = new Event("change", { bubbles: true });
    selectElement.dispatchEvent(event);
  }, formData.bench);

  // Fill in the CNR number input field
  await page.waitForSelector("#cino", { visible: true });
  await page.type("#cino", formData.cnrNumber);

  await delay(4000);

  try {
    const res = await attemptCaptcha(page);
    console.log("CAPTCHA solved and form submitted successfully.");
    console.log(res);
    // Additional logic to confirm submission success here...
  } catch (error) {
    console.error("An error occurred:", error.message);
  } finally {
    // await browser.close(); // Ensure the browser is closed properly
    console.log("done captcha bro");
  }

  // Wait for the resultsto load
  await delay(3000); // This delay may need to be adjusted depending on how long the site takes to load results

  
  
const data = await page.evaluate(() => {
  const cleanText = (text) => {
    return text.replace(/[\n\r]+/g, ' ')
               .replace(/\s{2,}/g, ' ')
               .trim();
};

const extractSimpleData = (array, label) => {
    for (const item of array) {
        if (item[0] === label) {
            return item[1];
        }
    }
    return null; // Return null if not found
};

const extractTableData = (selector) => {
    const rows = Array.from(document.querySelectorAll(selector + ' tr'));
    return rows.map(row => {
        const cells = Array.from(row.querySelectorAll('td, th'));
        return cells.map(cell => cleanText(cell.innerText));
    });
};
// Extracts key-value pairs from a detailed string
const extractDetails = (text) => {
  const details = {};
  const lines = text.split('\n').map(line => cleanText(line));
  lines.forEach(line => {
    const parts = line.split(':');
    if (parts.length === 2) {
      const key = parts[0].trim();
      const value = parts[1].trim();
      details[key] = value;
    }
  });
  return details;
};

// Specific function for extracting and structuring FIR Details
const extractFIRDetails = () => {
  const text = cleanText(document.querySelector('.FIR_details_table').innerText);
  return extractDetails(text);
};

// Specific function for extracting and structuring Trial Court Info
const extractTrialCourtInfo = () => {
  const text = cleanText(document.querySelector('.Lower_court_table').innerText);
  return extractDetails(text);
};
  const categoryDetails = extractTableData('#subject_table');
  let caseType = null;
  if (categoryDetails.length > 1 && categoryDetails[1].length > 0) {
      caseType = categoryDetails[0][1]; 
  }

  const historyOfCaseHearing = extractTableData('.history_table').slice(1).map(row => ({
      hearingDate: row[3],
      purpose: row[4]
  }));
  const caseDetails = extractTableData('.case_details_table');
  const caseStatus = extractTableData('.table_r');
  // Reformatted data object
  const reformattedData = {
    'Case Status': extractSimpleData(caseStatus, "Stage of Case"),
    'CNR Number': extractSimpleData(caseDetails, "CNR Number"),
    'Filing Number': extractSimpleData(caseDetails, "Filing Number"),
    'Registration Number': extractSimpleData(caseDetails, "Registration Number"),
    'First Hearing Date': extractSimpleData(caseStatus, "First Hearing Date"),
    'Decision Date': extractSimpleData(caseStatus, "Next Hearing Date"),
    'Coram': extractSimpleData(caseStatus, "Coram"),
    'Bench Type': extractSimpleData(caseStatus, "Bench Type"),
    'Judicial Branch': extractSimpleData(caseStatus, "Judicial Branch"),
    'State': extractSimpleData(caseStatus, "State"),
    'District': extractSimpleData(caseStatus, "District"),
    'Order Details': extractTableData('.order_table').slice(1).map(row => ({
        "Order Number": row[0],
        "Order on": row[1],
        "Judge": row[2],
        "Order Date": row[3],
        "Order Details": row[4]
    })),
      'Case Type': caseType,
      'History': historyOfCaseHearing,
      "Petitioner and Advocate" : cleanText(document.querySelector('.Petitioner_Advocate_table').innerText),
        "Respondent and Advocate" : cleanText(document.querySelector('.Respondent_Advocate_table').innerText),
        "Acts" : extractTableData('#act_table'),
        "categoryDetails" : extractTableData('#subject_table'),
        "trialCourtInfo": cleanText(document.querySelector('.Lower_court_table').innerText),
        "FIR Details": cleanText(document.querySelector('.FIR_details_table').innerText)
    
      // Include other keys here as previously defined
  };

  return reformattedData;
});
  // Close the browser when done or not needed
  await browser.close();
  return JSON.stringify(data,null,2);
}

export async function fetchCNRhighcourt(formData) {
  console.log("called fetchCNR highcourt");
  try {
    return await scrapeCourtData(formData);
  } catch (err) {
    console.error("Error processing formData:", err);
  }
}

// Assuming the formData is passed as a stringified JSON as the third argument
// async function run() {
//   const formDataFilePath = process.argv[2];
//   try {
//     const formDataJson = await readFile(formDataFilePath, "utf8");
//     const formData = JSON.parse(formDataJson);

//     // Example usage with dynamic formData
//     scrapeCourtData(formData)
//       .then((results) => {
//         console.log("done");
//       })
//       .catch((error) => {
//         console.error("Scraping failed:", error);
//       });
//   } catch (err) {
//     console.error("Error processing formData:", err);
//   }
// }

// run();
