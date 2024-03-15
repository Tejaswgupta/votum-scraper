import { promises as fs } from 'fs'; // Use fs.promises for async file operations
import path from 'path';
import puppeteer from "puppeteer";
import Tesseract from "tesseract.js";
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from "uuid";

// Improved CAPTCHA solving function with async file operations
async function getCaptcha(elementHandle) {
    const screenshotData = await elementHandle.screenshot();
    const filename = `img_${uuidv4()}.jpg`;
    await fs.writeFile(filename, screenshotData);

    try {
        const tesseractOptions = {
            lang: 'eng',
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
            psm: 6,
            logger: m => console.log(m)
        };

        const result = await Tesseract.recognize(filename, "eng", tesseractOptions);
        return result.data.text.trim();
    } finally {
        await fs.unlink(filename); // Ensures the file is deleted even if Tesseract fails
    }
}

async function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

async function attemptCaptcha(page) {
    let captchaSolved = false;
    let formSubmitted = false;
    while (!captchaSolved) {
        await page.waitForSelector('a[onclick="refreshCaptcha()"] img.refresh-btn', {visible: true});
        await page.click('a[onclick="refreshCaptcha()"] img.refresh-btn');
        await delay(4000);

        const img = await page.$("#captcha_image");
        const text = await getCaptcha(img);

        await page.evaluate(() => document.getElementById("case_captcha_code").value = "");
        await page.type("#case_captcha_code", text, { delay: 100 });

        if (!formSubmitted) {
            await page.waitForSelector('button.btn.btn-primary[onclick="submitCaseNo();"]', {visible: true});
            await page.click('button.btn.btn-primary[onclick="submitCaseNo();"]');
            formSubmitted = true;

            await delay(3000);

            const isEnterCaptchaModalPresent = await page.evaluate(() => {
                const modalText = document.querySelector(".modal-content")?.innerText || "";
                return modalText.includes("Enter captcha");
            });

            if (isEnterCaptchaModalPresent) {
                await page.evaluate(() => {
                    const closeButton = document.querySelector('.btn-close[onclick*="validateError"]');
                    closeButton?.click();
                });
                console.log("Closed the 'Enter captcha' modal.");
                formSubmitted = false;
                continue;
            }
        }

        const isInvalidCaptchaPresent = await page.evaluate(() => {
            const invalidCaptchaAlert = document.querySelector(".alert.alert-danger-cust");
            return invalidCaptchaAlert && getComputedStyle(invalidCaptchaAlert).display !== 'none';
        });

        if (isInvalidCaptchaPresent) {
            await page.click('.btn-close[data-bs-dismiss="modal"]');
            console.log("Invalid CAPTCHA. Retrying...");
            await delay(1000);
            formSubmitted = false;
        } else {
            console.log("CAPTCHA solved successfully. Form submitted.");
            captchaSolved = true;
            return true;
        }
    }
}

async function scrapeCourtData(formData) {
    const browser = await puppeteer.launch({
        headless: true, // Adjust based on your preference
        args: ['--no-sandbox', '--disable-setuid-sandbox',
            '--disable-accelerated-2d-canvas',
            "--proxy-server=216.97.239.173:12323",
            "--proxy-auth=14a354cd1897b:1490a37130",
        ]
    }); // Set to false for debugging, true for production
    const page = await browser.newPage();

    try {
        await page.goto("https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index&app_token=8d21c32c306b556a9bd59555f64446f5810586c374d09eaa1fd6452834ca0fca", {waitUntil: 'networkidle0', timeout: 60000});
        // Handle any potential modals that might appear upon page load
  try {
    await page.waitForSelector("#validateError", { timeout: 15000, visible: true });
    await page.click("#validateError > div > div > div.modal-header.text-center.align-items-start > button");
    console.log("Modal closed successfully.");
  } catch (error) {
    console.log("Modal not found or failed to close:", error.message);
  }


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
  


// After selecting the court complex,
// Click on the "Advocate" tab
await page.waitForSelector('#advname-tabMenu', {visible: true});
await page.click('#advname-tabMenu');

// Add a slight delay for the new UI to load fully
await delay(2000);

// Type the advocate's name into the input field
await page.waitForSelector('#advocate_name', {visible: true});
await page.type('#advocate_name', formData.Advocate);

//selecting case status
// Based on formData.caseStatus, click the corresponding radio button
if (formData.caseStatus === "Pending") {
    await page.click('#radPAdvt'); // Clicks on the "Pending" radio button
  } else if (formData.caseStatus === "Disposed") {
    await page.click('#radDAdvt'); // Clicks on the "Disposed" radio button
  } else if (formData.caseStatus === "Both") {
    await page.click('#radBAdvt'); // Clicks on the "Both" radio button
  } else {
    console.error('Invalid case status:', formData.caseStatus);
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
    console.log("done bro")
}

  // Wait for the resultsto load
  await delay(3000); // This delay may need to be adjusted depending on how long the site takes to load results

  // waiting for the results to show up
  await page.waitForSelector('#res_adv_name', {visible: true});
await page.waitForSelector('#dispTable', {visible: true});
  
// saving the data 

async function extractResults() {
    const data = [];
    const rows = document.querySelectorAll('#dispTable tbody tr');
    rows.forEach((row, index) => {
        // Skip rows that are just headers for court names
        if (row.querySelector('td[colspan="3"]')) return;

        const srNo = row.children[0]?.innerText.trim();
        const caseDetails = row.children[1]?.innerText.trim();
        const parties = row.children[2]?.innerText.trim();
        const advocate = row.children[3]?.innerText.trim();
        // Extracting the onclick attribute to parse caseId, etc., if needed
        const viewOnClick = row.children[4]?.querySelector('a')?.getAttribute('onclick');

        const regex = /viewHistory\([^,]+,'([^']+)',/;
        let cnrNumber;
        const match = viewOnClick.match(regex);
        if (match && match[1]) {
        cnrNumber = match[1]; // Add the CNR number to the item
        }

        data.push({ srNo, caseDetails, parties, advocate, viewOnClick, cnrNumber });
    });
    return data;
}

// writing to a file 
const resultsData = await page.evaluate(extractResults);

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
}// This should be replaced with actual data extracted from the page
        await saveResultsData(resultsData);
    } catch (error) {
        console.error("An error occurred during scraping:", error);
    } finally {
        await browser.close();
    }
}

// Improved saveResultsData function with async file operations
async function saveResultsData(resultsData) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const filePath = path.join(__dirname, `AdvResults-${uuidv4()}.json`);

    await fs.writeFile(filePath, JSON.stringify(resultsData, null, 2), 'utf8');
    console.log(`Results data saved to ${filePath}`);
}

async function run() {
    // Simulating formData for testing purposes
    const formData = {
        // Example formData, replace with actual test data as needed
        searchType: "CNR Number",
        state: "Delhi",
        district: "New Delhi",
        courtComplex: "Patiala House Court Complex",
        Advocate: 'Rahul Kumar',
        caseStatus: 'Pending',
    };

    console.log("Starting scrape with formData:", formData);
    await scrapeCourtData(formData);
}

run();
