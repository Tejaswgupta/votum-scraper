import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import Tesseract from "tesseract.js";
import { fileURLToPath } from "url";

import { unlinkSync, writeFileSync } from "fs";
import { v4 as uuidv4 } from "uuid";

// Function to take a screenshot of the CAPTCHA and solve it
async function getCaptcha(elementHandle) {
  const screenshotData = await elementHandle.screenshot();
  const filename = `img_${uuidv4()}.jpg`;
  writeFileSync(filename, screenshotData);

  const tesseractOptions = {
    lang: "eng",
    tessedit_char_whitelist:
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", // Adjust based on your CAPTCHA
    psm: 6, // Assume a single uniform block of text. You might need to experiment with this.
    logger: (m) => console.log(m),
  };

  const r = (await Tesseract.recognize(filename, "eng", tesseractOptions)).data
    .text;

  //   const r = (await Tesseract.recognize(filename, "eng")).data.text;
  unlinkSync(filename);
  return r.trim(); // Return solved captcha text
}

async function attemptCaptcha(page) {
  let captchaSolved = false;
  let formSubmitted = false;
  while (!captchaSolved) {
    // Click the CAPTCHA refresh button before each attempt
    await page.waitForSelector(
      'a[onclick="refreshCaptcha()"] img.refresh-btn',
      { visible: true }
    );
    await page.click('a[onclick="refreshCaptcha()"] img.refresh-btn');

    // Wait a bit for the new CAPTCHA to load
    await delay(4000);

    const img = await page.$("#captcha_image");
    const text = await getCaptcha(img);

    // Clear the CAPTCHA input field before typing
    await page.evaluate(
      () => (document.getElementById("case_captcha_code").value = "")
    );
    // Enter the captcha text
    await page.type("#case_captcha_code", text, { delay: 100 });

    if (!formSubmitted) {
      await page.waitForSelector(
        'button.btn.btn-primary[onclick="submitCaseNo();"]',
        { visible: true }
      );
      await page.click('button.btn.btn-primary[onclick="submitCaseNo();"]');
      formSubmitted = true; // Mark the form as submitted

      // Wait for the response to the submission
      await delay(3000);

      // Check if the "Enter captcha" modal is present
      const isEnterCaptchaModalPresent = await page.evaluate(() => {
        const modalText =
          document.querySelector(".modal-content")?.innerText || "";
        return modalText.includes("Enter captcha");
      });

      if (isEnterCaptchaModalPresent) {
        // If the modal is present, close it
        await page.evaluate(() => {
          const closeButton = document.querySelector(
            '.btn-close[onclick*="validateError"]'
          );
          closeButton?.click();
        });
        console.log("Closed the 'Enter captcha' modal.");
        formSubmitted = false; // Allow retrying the captcha submission
        continue; // Continue to the next iteration of the loop to retry solving the captcha
      }
    }

    // Determine if the invalid CAPTCHA modal is present
    const isInvalidCaptchaPresent = await page.evaluate(() => {
      const invalidCaptchaAlert = document.querySelector(
        ".alert.alert-danger-cust"
      );
      return (
        invalidCaptchaAlert &&
        getComputedStyle(invalidCaptchaAlert).display !== "none"
      );
    });

    if (isInvalidCaptchaPresent) {
      // Close the invalid CAPTCHA modal and retry
      await page.click('.btn-close[data-bs-dismiss="modal"]');
      console.log("Invalid CAPTCHA. Retrying...");
      await delay(1000); // Wait a bit for the modal to close
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
  const browser = await puppeteer.launch({
    headless: false,

    args: [
      "--proxy-server=216.97.239.173:12323",
      "--proxy-auth=14a354cd1897b:1490a37130",
    ],
  }); // Set to false for debugging, true for production
  const page = await browser.newPage();

  await page.authenticate({
    username: "14a354cd1897b",
    password: "1490a37130",
  });

  // Navigate to the eCourts page
  await page.goto(
    "https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index&app_token=8d21c32c306b556a9bd59555f64446f5810586c374d09eaa1fd6452834ca0fca"
  );

  // Handle any potential modals that might appear upon page load
  try {
    await page.waitForSelector("#validateError", {
      timeout: 15000,
      visible: true,
    });
    await page.click(
      "#validateError > div > div > div.modal-header.text-center.align-items-start > button"
    );
    console.log("Modal closed successfully.");
  } catch (error) {
    console.log("Modal not found or failed to close:", error.message);
  }

  async function selectOptionByText(
    selectElement,
    textToMatch,
    isPartial = false
  ) {
    const options = await selectElement.$$("option");
    for (const option of options) {
      const text = await (await option.getProperty("textContent")).jsonValue();
      if (
        isPartial ? text.includes(textToMatch) : text.trim() === textToMatch
      ) {
        const value = await (await option.getProperty("value")).jsonValue();
        return value; // Return the value of the matching option
      }
    }
    throw new Error(`Option with text "${textToMatch}" not found`);
  }

  // Select the State
  const stateSelect = await page.$("#sess_state_code");
  const stateValue = await selectOptionByText(stateSelect, formData.state);
  await page.select("#sess_state_code", stateValue);
  console.log("Selected state:", formData.state);

  // Ensure the districts are loaded
  await page.waitForSelector("#sess_dist_code option[value='7']");
  // Now select the District
  const districtSelect = await page.$("#sess_dist_code");
  const districtValue = await selectOptionByText(
    districtSelect,
    formData.district
  );
  await page.select("#sess_dist_code", districtValue);
  console.log("Selected district:", formData.district);

  // Wait for the Court Complex options to load
  await page.waitForSelector("#court_complex_code option:not([value=''])");
  const courtSelect = await page.$("#court_complex_code");
  const courtComplexValue = await selectOptionByText(
    courtSelect,
    formData.courtComplex
  );
  await page.select("#court_complex_code", courtComplexValue);
  console.log("Selected court complex:", formData.courtComplex);

  // Handle any potential modals that might appear upon page load
  try {
    await page.waitForSelector("#validateError", {
      timeout: 15000,
      visible: true,
    });
    await page.click(
      "#validateError > div > div > div.modal-header.text-center.align-items-start > button"
    );
    console.log("Modal closed successfully.");
  } catch (error) {
    console.log("Modal not found or failed to close:", error.message);
  }

  // After selecting the court complex, click on the Case Number tab
  await page.waitForSelector("#casenumber-tabMenu", { visible: true });
  await page.click("#casenumber-tabMenu");

  // Add a slight delay for the new UI to load fully
  await delay(2000);

  // Select the Case Type from the dropdown
  await page.waitForSelector("#case_type", { visible: true });
  const caseTypeSelect = await page.$("#case_type");
  const caseTypeValue = await selectOptionByText(
    caseTypeSelect,
    formData.caseType,
    true
  ); // Assuming partial match might be needed
  await page.select("#case_type", caseTypeValue);
  console.log("Selected case type:", formData.caseType);

  // Fill in the Case Number and Year
  await page.type("#search_case_no", formData.caseNumber); // Make sure this is the correct selector
  await page.type("#rgyear", formData.Year.toString()); // Adjust the selector as per actual field for the year

  await delay(10000);
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
    console.log("done bro");
  }

  // Wait for the resultsto load
  await delay(3000); // This delay may need to be adjusted depending on how long the site takes to load results

  // waiting for the results to show up
  await page.waitForSelector("#case_no_res", { visible: true });
  await page.waitForSelector("#dispTable", { visible: true });

  // saving the data
  const resultsData = await page.evaluate(() => {
    const data = [];
    const tableRows = document.querySelectorAll("#dispTable tbody tr");
    tableRows.forEach((row) => {
      // Assuming the first row might not contain case data based on your structure
      if (row.querySelector('td[colspan="3"]')) return;

      const srNo = row.children[0]?.innerText.trim();
      const caseDetails = row.children[1]?.innerText.trim();
      const parties = row.children[2]?.innerText.trim();
      const viewLinkOnClick = row.children[3]
        ?.querySelector("a")
        ?.getAttribute("onclick");

      const regex = /viewHistory\([^,]+,'([^']+)',/;
      let cnrNumber;
      const match = viewLinkOnClick.match(regex);
      if (match && match[1]) {
        cnrNumber = match[1]; // Add the CNR number to the item
      }

      data.push({ srNo, caseDetails, parties, viewLinkOnClick, cnrNumber });

      // if(row.querySelector('td') && row.querySelectorAll('td').length > 1) {
      //     const srNo = row.querySelector('td:nth-child(1)')?.innerText.trim();
      //     const caseDetails = row.querySelector('td:nth-child(2)')?.innerText.trim();
      //     const parties = row.querySelector('td:nth-child(3)')?.innerText.trim().replace(/\n/g, ' '); // Replacing newlines with spaces for readability
      //     const viewLinkOnClick = row.querySelector('td:nth-child(4) a')?.getAttribute('onclick');

      // }
    });
    return data;
  });

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
    const filePath = getNextFileName(__dirname, "caseNoResults", ".json");

    // Write the results data to the new file
    fs.writeFileSync(filePath, JSON.stringify(resultsData, null, 2), "utf8");
    console.log("Results data saved to", filePath);
  }

  saveResultsData(resultsData).catch(console.error);

  // Close the browser when done or not needed
  await browser.close();
}

// Example usage with dynamic formData, this would come from your website's frontend
const formData = {
  state: "Delhi",
  district: "New Delhi",
  courtComplex: "Patiala House Court Complex",
  caseType: "CRIMINAL APPEAL",
  caseNumber: "2",
  Year: 2020,
};

// Assuming the formData is passed as a stringified JSON as the third argument
async function run() {
  // const formDataFilePath = process.argv[2];
  try {
    // const formDataJson = await readFile(formDataFilePath, "utf8");
    // const formData = JSON.parse(formDataJson);

    // Example usage with dynamic formData
    scrapeCourtData(formData)
      .then((results) => {
        console.log("done");
        // Do something with the results, e.g., send them back to the user
      })
      .catch((error) => {
        console.error("Scraping failed:", error);
      });
  } catch (err) {
    console.error("Error processing formData:", err);
  }
}

run();

// scrapeCourtData(formData).then((results) => {
//     console.log("done")
//   // Do something with the results, e.g., send them back to the user
// });
