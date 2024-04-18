import pupManager from "./pupManager.js"
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

    // const text = await getCaptcha(img);

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

async function scrapeCourtData(formData) {
  const page = await pupManager.getPage();

  try {
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

    await page.waitForSelector('#dispTable', { visible: true });
    await delay(4000);
    // saving the data

    async function extractResults() {
      // return await page.evaluate(() => {
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
      // });
    }

    const resultsData = await page.evaluate(extractResults);
    console.log(resultsData)
    return JSON.stringify(resultsData);
  } catch (error) {
    console.error("An error occurred during scraping:", error);
  } finally {
    await page.close();
  }
}
async function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

export async function fetchAdvocateHC(formData) {
  console.log("called fetchAdvocate highcourt");
  try {
    // Example usage with dynamic formData
    return await scrapeCourtData(formData);
  } catch (err) {
    console.error("Error processing formData:", err);
  }
}
// // Assuming the formData is passed as a stringified JSON as the third argument
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

// Example formData
// const formData = {
//   highCourt: "Allahabad High Court",
//   bench: "Allahabad High Court",
//   searchType: "Case Number",
//   Advocate: "NAMMAN RAJ VANSHI",
//   caseStatus: "Pending",
// };

// scrapeHighCourt(formData).catch(console.error);
