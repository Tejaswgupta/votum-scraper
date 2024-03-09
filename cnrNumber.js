import puppeteer from "puppeteer";
import Tesseract from "tesseract.js";
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { readFile } from 'fs/promises';


import { writeFileSync, unlinkSync } from "fs";
import { v4 as uuidv4 } from "uuid";




// Function to take a screenshot of the CAPTCHA and solve it
async function getCaptcha(elementHandle) {
  const screenshotData = await elementHandle.screenshot();
  const filename = `img_${uuidv4()}.jpg`;
  writeFileSync(filename, screenshotData);

  const tesseractOptions = {
    lang: 'eng',
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', // Adjust based on your CAPTCHA
    psm: 6, // Assume a single uniform block of text. You might need to experiment with this.
    logger: m => console.log(m)
};

const r = (await Tesseract.recognize(filename, "eng", tesseractOptions)).data.text;


//   const r = (await Tesseract.recognize(filename, "eng")).data.text;
  unlinkSync(filename);
  return r.trim(); // Return solved captcha text
}

async function attemptCaptcha(page) {
    let captchaSolved = false;
    let formSubmitted = false;
    while (!captchaSolved) {
        // Click the CAPTCHA refresh button before each attempt
        await page.waitForSelector('a[onclick="refreshCaptcha()"] img.refresh-btn', {visible: true});
        await page.click('a[onclick="refreshCaptcha()"] img.refresh-btn');

        // Wait a bit for the new CAPTCHA to load
        await delay(4000);

        // Capture the CAPTCHA image
        const img = await page.$("#captcha_image");
        const text = await getCaptcha(img);

        // Clear the CAPTCHA input field before typing
        await page.evaluate(() => document.getElementById("fcaptcha_code").value = ""); // Updated ID for CAPTCHA input
        // Enter the captcha text
        await page.type("#fcaptcha_code", text, { delay: 100 }); // Updated ID for CAPTCHA input

        if (!formSubmitted) {
            await page.waitForSelector('#searchbtn', {visible: true}); // Updated selector for the submit button
            await page.click('#searchbtn'); // Updated selector for the submit button
            formSubmitted = true; // Mark the form as submitted

            // Wait for the response to the submission
            await delay(3000);

            // Check if the "Enter captcha" modal is present
            const isEnterCaptchaModalPresent = await page.evaluate(() => {
                const modalText = document.querySelector(".modal-content")?.innerText || "";
                return modalText.includes("Enter captcha");
            });

            if (isEnterCaptchaModalPresent) {
                // If the modal is present, close it
                await page.evaluate(() => {
                    const closeButton = document.querySelector('.btn-close[onclick*="validateError"]');
                    closeButton?.click();
                });
                console.log("Closed the 'Enter captcha' modal.");

                // Click the "Back" button after closing the modal
                await page.waitForSelector('#main_back_cnr', {visible: true});
                await page.click('#main_back_cnr');
                console.log("Clicked 'Back' button.");

                formSubmitted = false; // Allow retrying the captcha submission
                continue; // Continue to the next iteration of the loop to retry solving the captcha
            }
        }

        // Determine if the invalid CAPTCHA modal is present
        const isInvalidCaptchaPresent = await page.evaluate(() => {
            const invalidCaptchaAlert = document.querySelector(".alert.alert-danger-cust");
            return invalidCaptchaAlert && getComputedStyle(invalidCaptchaAlert).display !== 'none';
        });

        if (isInvalidCaptchaPresent) {
            // Close the invalid CAPTCHA modal
            await page.click('.btn-close[data-bs-dismiss="modal"]');
            console.log("Invalid CAPTCHA. Retrying...");

            // Wait a bit for the modal to close and click the "Back" button
            await delay(1000); // Adjust delay as necessary
            await page.click('#main_back_cnr');
            console.log("Clicked 'Back' button after invalid CAPTCHA.");

            formSubmitted = false; // Reset form submission status for a retry
        } else {
            console.log("CAPTCHA solved successfully. Form submitted.");
            captchaSolved = true;
            return true; // Exit the loop indicating success
        }
    }
}





async function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

// This function will be triggered with the user's form data
async function scrapeCourtData(formData) {
  const browser = await puppeteer.launch({ headless: false }); // Set to false for debugging, true for production
  const page = await browser.newPage();

  // Navigate to the eCourts page
  await page.goto(
    "https://services.ecourts.gov.in/ecourtindia_v6/?p=home/index&app_token=337f97323f30e038dce33f5bf3b4988c60ecc3ca77b244ec7566e73304cbed6f"
  );


// Fill in the CNR number input field
await page.waitForSelector('#cino', {visible: true});
await page.type('#cino', formData.cnrNumber);

  async function selectOptionByText(selectElement, textToMatch, isPartial = false) {
    const options = await selectElement.$$("option");
    for (const option of options) {
      const text = await (await option.getProperty('textContent')).jsonValue();
      if (isPartial ? text.includes(textToMatch) : text.trim() === textToMatch) {
        const value = await (await option.getProperty('value')).jsonValue();
        return value; // Return the value of the matching option
      }
    }
    throw new Error(`Option with text "${textToMatch}" not found`);
  }
  


await delay(10000)
// Solve CAPTCHA and Submit the form
// await attemptCaptcha(page);

try {
    const res = await attemptCaptcha(page);
    console.log("CAPTCHA solved and form submitted successfully.");
    console.log(res);
    // Additional logic to confirm submission success here...
} catch (error) {
    console.error("An error occurred:", error.message);
} finally {
    // await browser.close(); // Ensure the browser is closed properly
    console.log("done captcha bro")
}


  // Wait for the resultsto load
  await delay(3000); // This delay may need to be adjusted depending on how long the site takes to load results

  // waiting for the results to show up

  

async function extractCaseDetails() {
    return await page.evaluate(() => {
        // Define an object to hold all the extracted data
        const caseData = {};

        // Extract basic case details
        const caseDetailsElements = document.querySelectorAll('.case_details_table tr');
        caseDetailsElements.forEach(row => {
            const label = row.cells[0].textContent.trim();
            const value = row.cells[1]?.textContent.trim();
            caseData[label] = value;
        });

        // Extract case status
        const caseStatusElements = document.querySelectorAll('.case_status_table tr');
        caseStatusElements.forEach(row => {
            const label = row.cells[0].textContent.trim();
            const value = row.cells[1]?.textContent.trim();
            caseData[label] = value;
        });

        // Extract petitioner and advocate information
        const petitionerAdvocateInfo = document.querySelector('.Petitioner_Advocate_table').textContent.trim();
        caseData['Petitioner and Advocate'] = petitionerAdvocateInfo;

        // Extract respondent and advocate information
        const respondentAdvocateInfo = document.querySelector('.Respondent_Advocate_table').textContent.trim();
        caseData['Respondent and Advocate'] = respondentAdvocateInfo;

        // Extract acts information
        const actsInfo = document.querySelector('.acts_table').textContent.trim();
        caseData['Acts'] = actsInfo;

        // Extract case history
        const historyElements = document.querySelectorAll('.history_table tr');
        const history = [];
        historyElements.forEach((row, index) => {
            if (index > 0) { // Skip header row
                const hearingDate = row.cells[2]?.textContent.trim();
                const purpose = row.cells[3]?.textContent.trim();
                history.push({ hearingDate, purpose });
            }
        });
        caseData['History'] = history;

        return caseData;
    });
}


// writing to a file 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getNextFileName(baseDir, baseName, ext) {
    let counter = 1;
    let filePath = path.join(baseDir, `${baseName}${counter}${ext}`);
    
    // Check if the file exists. If it does, increment the counter and test again
    while (fs.existsSync(filePath)) {
        counter++;
        filePath = path.join(baseDir, `${baseName}${counter}${ext}`);
    }
    
    return filePath;
}

async function saveResultsData(resultsData) {
    // Determine the next available file name
    const filePath = getNextFileName(__dirname, 'caseDetails', '.json');
    
    // Write the results data to the new file
    fs.writeFileSync(filePath, JSON.stringify(resultsData, null, 2), 'utf8');
    console.log('Results data saved to', filePath);
}

// final operations 
const caseDetails = await extractCaseDetails();
await saveResultsData(caseDetails);

  // Close the browser when done or not needed
  await browser.close();
}



// Assuming the formData is passed as a stringified JSON as the third argument
async function run() {
  const formDataFilePath = process.argv[2];
  try {
    const formDataJson = await readFile(formDataFilePath, 'utf8');
    const formData = JSON.parse(formDataJson);

    // Example usage with dynamic formData
scrapeCourtData(formData).then(results => {
  console.log("done");
  // Do something with the results, e.g., send them back to the user
}).catch(error => {
  console.error("Scraping failed:", error);
});
    
  } catch (err) {
    console.error('Error processing formData:', err);
  }
}

run();

// Example usage, dynamic formData would come from your website's frontend
// const formData = {
//     searchType : 'CNR Number',
//     cnrNumber: " DLND010000052020"
// };

// // Example usage with dynamic formData
// scrapeCourtData(formData).then(results => {
//   console.log("done");
//   // Do something with the results, e.g., send them back to the user
// }).catch(error => {
//   console.error("Scraping failed:", error);
// });
