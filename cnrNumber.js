import pupManager from "./pupManager.js"
import { getCaptchaUsingAPI } from "./utils.js";

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

    await delay(4000);
    const img = await page.$("#captcha_image");

    // const text = await getCaptcha(img);

    //!Using API
    const screenshotData = await img.screenshot();
    const text = await getCaptchaUsingAPI(screenshotData);

    await page.evaluate(
      () => (document.getElementById("fcaptcha_code").value = "")
    ); // Updated ID for CAPTCHA input

    await page.type("#fcaptcha_code", text, { delay: 100 }); // Updated ID for CAPTCHA input

    if (!formSubmitted) {
      await page.waitForSelector("#searchbtn", { visible: true }); // Updated selector for the submit button
      await page.click("#searchbtn"); // Updated selector for the submit button
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

        // Click the "Back" button after closing the modal
        await page.waitForSelector("#main_back_cnr", { visible: true });
        await page.click("#main_back_cnr");
        console.log("Clicked 'Back' button.");

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
      // Close the invalid CAPTCHA modal
      await page.click('.btn-close[data-bs-dismiss="modal"]');
      console.log("Invalid CAPTCHA. Retrying...");

      // Wait a bit for the modal to close and click the "Back" button
      await delay(1000); // Adjust delay as necessary
      await page.click("#main_back_cnr");
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

  const page = await pupManager.getPage();
  await pupManager.authenticatePage(page);


  // Navigate to the eCourts page
  await page.goto(
    "https://services.ecourts.gov.in/ecourtindia_v6/?p=home/index&app_token=337f97323f30e038dce33f5bf3b4988c60ecc3ca77b244ec7566e73304cbed6f",
    { timeout: 60000, waitUntil: "networkidle0" }
  );

  // Fill in the CNR number input field
  await page.waitForSelector("#cino", { visible: true });
  await page.type("#cino", formData.cnrNumber);

  await delay(10000);

  try {
    await attemptCaptcha(page);
    console.log("CAPTCHA solved and form submitted successfully.");

    // Additional logic to confirm submission success here...
  } catch (error) {
    console.error("An error occurred:", error.message);
  } finally {
    // await browser.close(); // Ensure the browser is closed properly
    console.log("done captcha bro");
  }

  // Wait for the resultsto load
  await delay(3000); // This delay may need to be adjusted depending on how long the site takes to load results

  // waiting for the results to show up

  async function extractCaseDetails() {
    return await page.evaluate(() => {
      // Define an object to hold all the extracted data
      const caseData = {};

      // Extract basic case details
      const caseDetailsElements = document.querySelectorAll(
        ".case_details_table tr"
      );
      caseDetailsElements.forEach((row) => {
        const label = row.cells[0].textContent.trim();
        const value = row.cells[1]?.textContent.trim();
        caseData[label] = value;
      });

      // Extract case status
      const caseStatusElements = document.querySelectorAll(
        ".case_status_table tr"
      );
      caseStatusElements.forEach((row) => {
        const label = row.cells[0].textContent.trim();
        const value = row.cells[1]?.textContent.trim();
        caseData[label] = value;
      });

      // Extract petitioner and advocate information
      const petitionerAdvocateInfo = document
        .querySelector(".Petitioner_Advocate_table")
        .textContent.trim();
      caseData["Petitioner and Advocate"] = petitionerAdvocateInfo;

      // Extract respondent and advocate information
      const respondentAdvocateInfo = document
        .querySelector(".Respondent_Advocate_table")
        .textContent.trim();
      caseData["Respondent and Advocate"] = respondentAdvocateInfo;

      // Extract acts information
      const actsInfo = document.querySelector(".acts_table").textContent.trim();
      caseData["Acts"] = actsInfo;

      // Extract case history
      const historyElements = document.querySelectorAll(".history_table tr");
      const history = [];
      historyElements.forEach((row, index) => {
        if (index > 0) {
          // Skip header row
          const hearingDate = row.cells[2]?.textContent.trim();
          const purpose = row.cells[3]?.textContent.trim();
          history.push({ hearingDate, purpose });
        }
      });
      caseData["History"] = history;

      return caseData;
    });
  }

  const caseDetails = await extractCaseDetails();

  await page.close();
  return JSON.stringify(caseDetails);
}

// Assuming the formData is passed as a stringified JSON as the third argument
export async function fetchCNR(formData) {
  console.log("called fetchCNR");
  try {
    // Example usage with dynamic formData
    return await scrapeCourtData(formData);
  } catch (err) {
    console.error("Error processing formData:", err);
  }
}
