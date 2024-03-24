import puppeteer from "puppeteer";
import Tesseract from "tesseract.js";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { readFile } from "fs/promises";

import { writeFileSync, unlinkSync } from "fs";
import { v4 as uuidv4 } from "uuid";
async function selectOptionByText(selectElement, keywords, isPartial = true) {
  const options = await selectElement.$$("option");
  for (const option of options) {
    const text = await (await option.getProperty("textContent")).jsonValue();
    const lowerText = text.toLowerCase();

    // Convert keywords to lowercase for case-insensitive matching
    const lowerKeywords = keywords.map((keyword) => keyword.toLowerCase());

    // Check if option text contains any of the keywords
    const matchesKeywords = lowerKeywords.some((keyword) =>
      lowerText.includes(keyword)
    );

    if (isPartial && matchesKeywords) {
      const value = await (await option.getProperty("value")).jsonValue();
      return value; // Return the value attribute of the matching option
    }
  }
  throw new Error(`Option with keywords "${keywords.join(", ")}" not found`);
}

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
    const text = await getCaptcha(img);

    // Clear the CAPTCHA input field before typing
    await page.evaluate(() => (document.getElementById("captcha").value = ""));
    // Enter the captcha text
    await page.type("#captcha", text, { delay: 100 });
    formSubmitted = false;
    // Submit the form
    if (!formSubmitted) {
      // Wait for the button to be loaded on the page
      await page.waitForSelector('input.Gobtn[value="Go"]');

      // Click the button using its class name and value attribute
      await page.evaluate(() => {
        document.querySelector('input.Gobtn[value="Go"]').click();
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
      const errSpanVisible = await page.evaluate(() => {
        const errSpan = document.querySelector("#errSpan");
        return (
          errSpan &&
          errSpan.style.display !== "none" &&
          errSpan.innerText.includes("Invalid Captcha")
        );
      });

      if (errSpanVisible) {
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

async function scrapeHighCourt(formData) {
  const browser = await puppeteer.launch({ headless: false }); // headless: false for debugging
  const page = await browser.newPage();

  await page.goto("https://hcservices.ecourts.gov.in/hcservices/", {
    waitUntil: "networkidle0",
  });

  // Click on the 'Case Status' menu item
  await page.click("#leftPaneMenuCS img.case-status-dp");

  await delay(2000);

  // closing the modal

  await closeVisibleModal(page);

  //   Proceed with further actions
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

  await delay(1000);

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

  // Assuming you have already navigated to the page and have a page object
  await delay(1000);
  await page.waitForSelector("#CSAdvName", { visible: true }); // Ensure the element is present and visible
  await page.evaluate(() => {
    document.querySelector("#CSAdvName").click(); // Directly click on the element via JavaScript
  });

  // Type the advocate's name into the input field
  await page.waitForSelector("#advocate_name", { visible: true });
  await page.type("#advocate_name", formData.Advocate);

  //selecting case status
  // Based on formData.caseStatus, click the corresponding radio button
  if (formData.caseStatus === "Pending") {
    await page.click("#radPAdvt"); // Clicks on the "Pending" radio button
  } else if (formData.caseStatus === "Disposed") {
    await page.click("#radDAdvt"); // Clicks on the "Disposed" radio button
  } else if (formData.caseStatus === "Both") {
    await page.click("#radBAdvt"); // Clicks on the "Both" radio button
  } else {
    console.error("Invalid case status:", formData.caseStatus);
  }

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
    console.log("done bro");
  }

  // Wait for the resultsto load
  await delay(3000); // This delay may need to be adjusted depending on how long the site takes to load results

  async function waitForElement(selector) {
    await page.evaluate((selector) => {
      return new Promise((resolve, reject) => {
        const observer = new MutationObserver((mutations) => {
          if (document.querySelector(selector)) {
            resolve(true);
            observer.disconnect();
          }
        });
        observer.observe(document.body, {
          childList: true,
          subtree: true,
        });
        // Optional: set a timeout to stop waiting after a while
        setTimeout(() => {
          observer.disconnect();
          reject(new Error("Timeout waiting for element"));
        }, 60000); // 60 seconds timeout
      });
    }, selector);
  }

  // Usage
  try {
    await waitForElement("#dispTable");
    console.log("Element found.");
  } catch (error) {
    console.error("Element not found within the specified time.", error);
  }
  await delay(4000);
  // saving the data

  async function extractResults(page) {
    return await page.evaluate(() => {
      const data = [];
      const rows = document.querySelectorAll("#dispTable tbody tr");
      rows.forEach((row, index) => {
        // Skip header rows or any row that might not be a case row
        const isCaseRow =
          row.querySelector('td[class^="col-"]') && row.querySelector("a");
        if (!isCaseRow) return;

        const srNo = row.children[0]?.innerText.trim();
        const caseDetails = row.children[1]?.innerText.trim();
        const petitionerVsRespondent = row.children[2]?.innerText.trim();
        const advocateName = row.children[3]?.innerText.trim();
        // Extracting the CNR number from the onclick attribute
        const viewOnClick = row.children[4]
          ?.querySelector("a")
          ?.getAttribute("onclick");
        const regex = /'([^']*)'/g;
        const matches = [...viewOnClick.matchAll(regex)];
        const cnrNumber =
          matches && matches[2] && matches[2][1] ? matches[2][1] : "";

        data.push({
          srNo,
          caseDetails,
          petitionerVsRespondent,
          advocateName,
          cnrNumber,
        });
      });
      return data;
    });
  }

  // writing to a file
  const resultsData = await extractResults(page); // Pass the `page` object when calling the function

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
    const filePath = getNextFileName(__dirname, "AdvResults", ".json");

    // Write the results data to the new file
    fs.writeFileSync(filePath, JSON.stringify(resultsData, null, 2), "utf8");
    console.log("Results data saved to", filePath);
  }

  saveResultsData(resultsData).catch(console.error);

  await browser.close();
}
async function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

// Assuming the formData is passed as a stringified JSON as the third argument
async function run() {
  const formDataFilePath = process.argv[2];
  try {
    const formDataJson = await readFile(formDataFilePath, "utf8");
    const formData = JSON.parse(formDataJson);

    // Example usage with dynamic formData
    scrapeCourtData(formData)
      .then((results) => {
        console.log("done");
      })
      .catch((error) => {
        console.error("Scraping failed:", error);
      });
  } catch (err) {
    console.error("Error processing formData:", err);
  }
}

run();

// Example formData
// const formData = {
//   highCourt: "Allahabad High Court",
//   bench: "Allahabad High Court",
//   searchType: "Case Number",
//   Advocate: "NAMMAN RAJ VANSHI",
//   caseStatus: "Pending",
// };

// scrapeHighCourt(formData).catch(console.error);
