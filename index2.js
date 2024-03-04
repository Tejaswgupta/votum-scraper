import puppeteer from "puppeteer";
import Tesseract from "tesseract.js";

import { writeFileSync, unlinkSync } from "fs";
import { v4 as uuidv4 } from "uuid";

// Function to take a screenshot of the CAPTCHA and solve it
async function getCaptcha(elementHandle) {
  const screenshotData = await elementHandle.screenshot();
  const filename = `img_${uuidv4()}.jpg`;
  writeFileSync(filename, screenshotData);
  const r = (await Tesseract.recognize(filename, "eng")).data.text;
  unlinkSync(filename);
  return r.trim(); // Return solved captcha text
}

async function attemptCaptcha(page) {
    let captchaSolved = false;
    while (!captchaSolved) {
        // Click the CAPTCHA refresh button before each attempt
        // Ensure the page is fully loaded or the element is available before clicking
        await page.waitForSelector('a[onclick="refreshCaptcha()"] img.refresh-btn', {visible: true});
        await page.click('a[onclick="refreshCaptcha()"] img.refresh-btn');

        // Wait a bit for the new CAPTCHA to load; adjust the timing as needed
        await delay(4000); // Delay function or use page.waitForTimeout(1000);

        await page.waitForSelector("#captcha_image");
        const img = await page.$("#captcha_image");
        const text = await getCaptcha(img);

        // Clear the CAPTCHA input field before typing
        await page.evaluate(() => document.getElementById("fcaptcha_code").value = "");
        // Enter the captcha text
        await page.type("#fcaptcha_code", text, { delay: 100 });
        // Submit the form or perform the action to check the CAPTCHA
        // After solving CAPTCHA, click the submit button
    await page.waitForSelector("button.btn.btn-primary[value='Go']", {visible: true});
    await page.click("button.btn.btn-primary[value='Go']");

        // Add a reasonable delay to wait for the response to the submission
        await delay(3000);

        // Check for CAPTCHA error messages or successful submission indicators
        const isCaptchaErrorPresent = await page.evaluate(() => {
            // Implement logic to check for CAPTCHA errors
            // Return true if an error is found, false otherwise
        });

        if (!isCaptchaErrorPresent) {
            captchaSolved = true;
        } else {
            // Handle retries as needed, the loop will continue
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
  await page.goto("https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index&app_token=...");

  // Handle any potential modals that might appear upon page load
  try {
    await page.waitForSelector("#validateError", { timeout: 15000, visible: true });
    await page.click("#validateError > div > div > div.modal-header.text-center.align-items-start > button");
    console.log("Modal closed successfully.");
  } catch (error) {
    console.log("Modal not found or failed to close:", error.message);
  }


async function selectOptionByText(selectElement, textToMatch) {
    const options = await selectElement.$$("option");
    for (const option of options) {
      const text = await (await option.getProperty('textContent')).jsonValue();
      if (text.trim() === textToMatch) {
        const value = await (await option.getProperty('value')).jsonValue();
        return value; // Return the value of the matching option
      }
    }
    throw new Error(`Option with text "${textToMatch}" not found`);
  }

  // Select the State
  const stateSelect = await page.$("#sess_state_code");
  const stateValue = await selectOptionByText(stateSelect, formData.state);
  await page.select('#sess_state_code', stateValue);
  console.log('Selected state:', formData.state);
  
  
// Ensure the districts are loaded
await page.waitForSelector("#sess_dist_code option[value='7']");
// Now select the District
const districtSelect = await page.$("#sess_dist_code");
const districtValue = await selectOptionByText(districtSelect, formData.district);
await page.select('#sess_dist_code', districtValue);
console.log('Selected district:', formData.district);
  
  // Wait for the Court Complex options to load
  await page.waitForSelector("#court_complex_code option:not([value=''])");
  const courtSelect = await page.$("#court_complex_code");
  const courtComplexValue = await selectOptionByText(courtSelect, formData.courtComplex);
  await page.select('#court_complex_code', courtComplexValue);
  console.log('Selected court complex:', formData.courtComplex);

  // Handle any potential modals that might appear upon page load
  try {
    await page.waitForSelector("#validateError", { timeout: 15000, visible: true });
    await page.click("#validateError > div > div > div.modal-header.text-center.align-items-start > button");
    console.log("Modal closed successfully.");
  } catch (error) {
    console.log("Modal not found or failed to close:", error.message);
  }
  
  // Rest of your code to fill in the petitioner/respondent, registration year, etc.
  // Fill in the Petitioner/Respondent name
await page.type('#petres_name', formData.petitionerRespondent);

// Fill in the Registration Year
await page.type('#rgyearP', formData.registrationYear.toString());
  
//selecting case status
// Based on formData.caseStatus, click the corresponding radio button
if (formData.caseStatus === "Pending") {
    await page.click('#radP'); // Clicks on the "Pending" radio button
  } else if (formData.caseStatus === "Disposed") {
    await page.click('#radD'); // Clicks on the "Disposed" radio button
  } else if (formData.caseStatus === "Both") {
    await page.click('#radB'); // Clicks on the "Both" radio button
  } else {
    console.error('Invalid case status:', formData.caseStatus);
  }

  // captcha solving  version 1 WORKING

//   const captchaImageUrl = await page.evaluate(() => {
//     return document.querySelector('#captcha_image').src;
//   });

//   // Use Tesseract.js to recognize text from the CAPTCHA image
//   const { data: { text } } = await Tesseract.recognize(
//     captchaImageUrl,
//     'eng',
//     {
//       logger: m => console.log(m), // Log Tesseract progress
//     }
//   );

//   console.log('Recognized CAPTCHA text:', text);

//captcha v2 SOLVING

await attemptCaptcha(page);

  // Input the recognized text into the CAPTCHA field
  await page.type('#fcaptcha_code', text.trim());
//   await browser.close();
  // Here you would add your CAPTCHA solving logic
  // const captchaSolution = await solveCaptcha(page);
  // await page.type('#captchaInput', captchaSolution);

  // Submit the form
//   await page.click("#submitButton");

  // Wait for the results to load
  await delay(5000); // This delay may need to be adjusted depending on how long the site takes to load results

  // Scrape the results
//   const results = await page.evaluate(() => {
//     const data = [];
//     // Your logic to scrape the results goes here
//     // e.g., document.querySelectorAll('.result-row').forEach(row => { data.push(row.innerText); });
//     return data;
//   });

  // Output the results
//   console.log(results);

  // Close the browser
//   await browser.close();

  // Return the results so they can be used in your application
//   return results;
}

// Example usage with dynamic formData, this would come from your website's frontend
const formData = {
  state: 'Delhi',
  district: 'New Delhi',
  courtComplex: 'Patiala House Court Complex',
  petitionerRespondent: 'Rahul',
  registrationYear: 2020,
  caseStatus: "Disposed"
  // Add other necessary form fields here
};

scrapeCourtData(formData).then((results) => {
    console.log("done")
  // Do something with the results, e.g., send them back to the user
});
