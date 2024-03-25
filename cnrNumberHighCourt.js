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
    headless: true, // Adjust based on your preference
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

  async function extractCaseDetails(page) {
    return await page.evaluate(() => {
      const caseDetails = {};

      // Extract case details
      document.querySelectorAll(".case_details_table tr").forEach((row) => {
        const label = row.cells[0]?.textContent.trim();
        const value = row.cells[1]?.textContent.trim();
        caseDetails[label] = value;
      });

      // Extract case status
      document.querySelectorAll(".table_r tr").forEach((row) => {
        const label = row.cells[0]?.textContent.trim();
        const value = row.cells[1]?.textContent.trim();
        caseDetails[label] = value;
      });

      // Petitioner and Advocate
      caseDetails["Petitioner and Advocate"] = document
        .querySelector(".Petitioner_Advocate_table")
        ?.textContent.trim();

      // Respondent and Advocate
      caseDetails["Respondent and Advocate"] = document
        .querySelector(".Respondent_Advocate_table")
        ?.textContent.trim();

      // Acts
      const acts = [];
      document.querySelectorAll("#act_table tr").forEach((row, index) => {
        if (index > 0) {
          // Skip header
          const underActs = row.cells[0]?.textContent.trim();
          const underSections = row.cells[1]?.textContent.trim();
          acts.push({ underActs, underSections });
        }
      });
      caseDetails["Acts"] = acts;

      // Category Details
      document.querySelectorAll("#subject_table tr").forEach((row) => {
        const label = row.cells[0]?.textContent.trim();
        const value = row.cells[1]?.textContent.trim();
        caseDetails[label] = value;
      });

      // Trial Court Information
      const trialCourtInfo = {};
      document.querySelectorAll(".Lower_court_table span").forEach((span) => {
        const parts = span.textContent.split(":");
        if (parts.length === 2) {
          trialCourtInfo[parts[0].trim()] = parts[1].trim();
        }
      });
      caseDetails["Trial Court Information"] = trialCourtInfo;

      // FIR Details
      const firDetails = {};
      document.querySelectorAll(".FIR_details_table span").forEach((span) => {
        const parts = span.textContent.split(":");
        if (parts.length === 2) {
          firDetails[parts[0].trim()] = parts[1].trim();
        }
      });
      caseDetails["FIR Details"] = firDetails;

      // History of Case Hearing
      const history = [];
      document.querySelectorAll(".history_table tr").forEach((row, index) => {
        if (index > 0) {
          // Skip header
          const cells = Array.from(row.cells).map((cell) =>
            cell.textContent.trim()
          );
          history.push(cells);
        }
      });
      caseDetails["History of Case Hearing"] = history;

      // Orders
      const orders = [];
      document.querySelectorAll(".order_table tr").forEach((row, index) => {
        if (index > 0) {
          // Skip header
          const orderNumber = row.cells[0]?.textContent.trim();
          const orderOn = row.cells[1]?.textContent.trim();
          const judge = row.cells[2]?.textContent.trim();
          const orderDate = row.cells[3]?.textContent.trim();
          const orderDetails = row.cells[4]?.textContent.trim();
          orders.push({ orderNumber, orderOn, judge, orderDate, orderDetails });
        }
      });
      caseDetails["Orders"] = orders;

      return caseDetails;
    });
  }

  // final operations
  const caseDetails = await extractCaseDetails(page);
  
  // Close the browser when done or not needed
  await browser.close();
  return JSON.stringify(caseDetails);
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
