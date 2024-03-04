import fs, { writeFileSync } from "fs";
import puppeteer from "puppeteer";

async function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

function appendToJsonFile(filePath, newData) {
  // Read the existing JSON file
  fs.readFile(filePath, "utf8", (readError, data) => {
    if (readError) {
      console.error("Error reading the JSON file:", readError);
      return;
    }

    // Try to parse the JSON data
    let json;
    try {
      json = JSON.parse(data);
    } catch (parseError) {
      console.error("Error parsing JSON:", parseError);
      return;
    }

    // Append new data to the JSON object
    const newarr = [...json, newData];

    // Write the updated JSON object back to the file
    fs.writeFile(
      filePath,
      JSON.stringify(newarr, null, 2),
      "utf8",
      (writeError) => {
        if (writeError) {
        } else {
        }
      }
    );
  });
}

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  let state_code;

  //   page.on("request", async (request) => {
  //     if (request.postData()) {
  //       //   console.log(request.postData());
  //       //   state_code = JSON.parse(request.postData())["state_code"];
  //     }
  //   });

  //   page.on("response", async (response) => {
  //     if (response.url().includes("fillcomplex")) {
  //       try {
  //         console.log(state_code);
  //         const json = await response.json();
  //         // console.log(json);
  //         appendToJsonFile(
  //           "test.json",
  //           JSON.stringify({
  //             state_code: state_code,
  //             dist_codes: json["dist_list"],
  //           })
  //         );
  //       } catch (e) {
  //         console.log(e);
  //       }
  //     }
  //   });

  // Replace with the actual URL of the page containing the modal
  await page.goto(
    "https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index&app_token=8d21c32c306b556a9bd59555f64446f5810586c374d09eaa1fd6452834ca0fca"
  );

  try {
    await delay(3000);
    await page
      .waitForSelector("#validateError", {
        timeout: 15000,
        visible: true,
      })
      .then(async () => {
        await page
          .click(
            "#validateError > div > div > div.modal-header.text-center.align-items-start > button"
          )
          .then(() => {
            console.log("Modal closed successfully.");
          })
          .catch(() => console.log("error"));
      });
  } catch (error) {
    console.log("Modal not found or failed to close:", error.message);
  }

  //element of type select
  const selectElement = await page.$("#sess_state_code");
  // Get all option elements within the select element
  console.log(selectElement);
  const options = await selectElement.$$("option");
  const save = {};

  // Iterate through each option and click it
  for (const option of options) {
    try {
      const val = await option.evaluate((opt) => {
        return { text: opt.textContent, value: opt.value };
      });
      selectElement.select(val.value);
      await delay(3000);
      console.log(`Clicked option state: ${val.text}`);

      if (!save[val.value]) {
        save[val.value] = {
          name: val.text,
        };
      }

      const districtSelect = await page.$("#sess_dist_code");
      const districts = await districtSelect.$$("option");

      for (const d of districts) {
        const districtVal = await d.evaluate((opt) => {
          return { text: opt.textContent, value: opt.value };
        });
        districtSelect.select(districtVal.value);
        await delay(3000);

        console.log(`Clicked option district: ${districtVal.text}`);

        const courtSelect = await page.$("#court_complex_code");
        const courts = await courtSelect.$$("option");
        const abb = [];

        for (const c of courts) {
          const courtVal = await c.evaluate((opt) => {
            return { text: opt.textContent, value: opt.value };
          });
          abb.push(courtVal);
        }

        save[val.value][districtVal.value] = {
          name: districtVal.text,
          courts: abb,
        };
        writeFileSync("test.json", JSON.stringify(save));
      }
    } catch (error) {
      console.error(`Error clicking option: ${error.message}`);
    }
  }

  await browser.close();
})();