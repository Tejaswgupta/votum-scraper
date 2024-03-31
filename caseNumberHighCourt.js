import puppeteer from "puppeteer";
import { getCaptchaUsingAPI } from "./utils.js";


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
// async function getCaptcha(elementHandle) {
//   const screenshotData = await elementHandle.screenshot();
//   const filename = `img_${uuidv4()}.jpg`;
//   writeFileSync(filename, screenshotData);

//   const tesseractOptions = {
//     lang: "eng",
//     tessedit_char_whitelist:
//       "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", // Adjust based on your CAPTCHA
//     psm: 6, // Assume a single uniform block of text. You might need to experiment with this.
//     logger: (m) => console.log(m),
//   };

//   const r = (await Tesseract.recognize(filename, "eng", tesseractOptions)).data
//     .text;

//   //   const r = (await Tesseract.recognize(filename, "eng")).data.text;
//   unlinkSync(filename);
//   return r.trim(); // Return solved captcha text
// }

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
  const browser = await puppeteer.launch({ headless: true }); // headless: false for debugging
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

  // Wait and click on 'Case Number' search option if necessary
  // Assuming you have already navigated to the page and have a page object
  await delay(1000);
  await page.waitForSelector("#CScaseNumber", { visible: true }); // Ensure the element is present and visible
  await page.evaluate(() => {
    document.querySelector("#CScaseNumber").click(); // Directly click on the element via JavaScript
  });

  // Select the Case Type from the dropdown
  // Assuming formData.caseType contains a partial text to match
  await delay(1000);

  const caseTypeValue = formData.caseType.split('-')[1];; // The value for "C372(CRIMINAL APPEAL U/S 372 Cr.PC.)-100"

  // Wait for the dropdown to be available
  await page.waitForSelector('#case_type');

  // Click the dropdown to show its options
  await page.click('#case_type');

  // Select the option directly by clicking it
  const optionValueSelector = `#case_type option[value="${caseTypeValue}"]`;
  await page.waitForSelector(optionValueSelector); // Ensure the option is available
  await page.evaluate((optionValueSelector) => {
    const option = document.querySelector(optionValueSelector);
    if (option) {
      option.selected = true; // Select the option
      const event = new Event('change', { bubbles: true });
      option.parentNode.dispatchEvent(event); // Dispatch the change event on the select element
    }
  }, optionValueSelector);

  // Optionally, verify if the correct option is selected
  const selectedValue = await page.evaluate(() => document.querySelector('#case_type').value);

  console.log("Selected case type:", formData.caseType);

  await delay(500);
  // Enter the case number
  await page.type("#search_case_no", formData.caseNumber);

  // Enter the year
  await page.type("#rgyear", formData.Year.toString());
  console.log("now captcha")

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
  // Wait for the results table to show up
  await page.waitForSelector("#dispTable", { visible: true });

  // Extract and save the data from the table
  const resultsData = await page.evaluate(() => {
    const data = [];
    const tableRows = document.querySelectorAll("#dispTable tbody tr");
    tableRows.forEach((row) => {
      // Check if the row is not a case data row
      if (row.querySelector('td[colspan="4"]')) return; // Adjusted to colspan="4" for the header/identifier row

      const srNo = row.children[0]?.innerText.trim();
      const caseDetails = row.children[1]?.innerText.trim();
      const parties = row.children[2]?.innerText.trim().replace(/\n/g, " "); // Replacing newlines with spaces for readability
      const viewLinkOnClick = row.children[3]
        ?.querySelector("a")
        ?.getAttribute("onclick");

      // Extract CNR number from the 'onclick' attribute using regex
      let cnrNumber;
      const regex = /viewHistory\([^,]+,'([^']+)',/;
      const match = viewLinkOnClick.match(regex);
      if (match && match[1]) {
        cnrNumber = match[1]; // Extracted CNR number
      }

      // Pushing extracted data into the array
      data.push({ srNo, caseDetails, parties, viewLinkOnClick, cnrNumber });
    });
    return data;
  });

  await browser.close();
  return JSON.stringify(resultsData, null, 2);
}
async function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

export async function fetchCaseNumHC(formData) {
  console.log("called fetchCase highcourt");
  try {
    // Example usage with dynamic formData
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

// Example formData
// const formData = {
//   highCourt: "Allahabad High Court",
//   bench: "Allahabad High Court",
//   searchType: "Case Number",
//   caseType: "C372(CRIMINAL APPEAL U/S 372 Cr.PC.)-100",
//   caseNumber: "1",
//   caseYear: "2020",
// };

// scrapeHighCourt(formData).catch(console.error);
