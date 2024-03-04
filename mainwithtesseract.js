import events from "events";
import { unlinkSync, writeFileSync } from "fs";
import pLimit from "p-limit";
import puppeteer from "puppeteer";
import Tesseract from "tesseract.js";
import { v4 as uuidv4 } from "uuid";
import { query } from "./db.js";
import downloadPdf from "./download.js";
import logger from "./logger.js";

// Increase maximum event listeners
process.setMaxListeners(0);

const PAGE_SIZE = 10;

const limit = pLimit(6); // Only allow 5 `downloadPdf` calls at a time

async function downloadWithLimit(url, path, data) {
  await limit(() =>
    downloadPdf(url, path, data).catch((err) => {
      logger.error(err);
    })
  );
}

async function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

// function incrementDates() {
//   let startDate = new Date("1950-01-01");
//   let endDate = new Date("1951-01-01");
//   let dateRanges = [];

//   while (endDate.getFullYear() <= 2023) {
//     let range = {
//       fromDate: startDate.toISOString().substring(0, 10),
//       toDate: endDate.toISOString().substring(0, 10),
//     };
//     dateRanges.push(range);

//     startDate.setFullYear(startDate.getFullYear() + 1);
//     endDate.setFullYear(endDate.getFullYear() + 1);
//   }

//   return dateRanges;
// }

function incrementMonths() {
  let startDate = new Date("1950-01-01");
  let endDate = new Date("1950-02-01");
  let dateRanges = [];

  while (endDate <= new Date("2023-08-01")) {
    let range = {
      fromDate: startDate.toISOString().substring(0, 10),
      toDate: endDate.toISOString().substring(0, 10),
    };
    dateRanges.push(range);

    startDate.setMonth(startDate.getMonth() + 1);
    endDate.setMonth(endDate.getMonth() + 1);
  }

  return dateRanges;
}

export function extractDetails(str) {
  let cnr = str.match(/CNR :<\/span><font color='green'> (.*?)<\/font>/)[1];
  let case_name = str.match(/aria-label=\"(.*?) pdf\"/)[1];
  let judge_name = str.match(/Judge Name: (.*?)<\/strong>/)[1];
  let date_of_registration = str.match(
    /Date of registration :<\/span><font color='green'> (.*?)<\/font>/
  )[1];
  let date_of_decision = str.match(
    /Date of decision :<\/span><font color='green'> (.*?)<\/font>/
  )[1];
  let disposal_nature = str.match(
    /Disposal Nature :<\/span><font color='green'> (.*?)<\/font>/
  )[1];
  let court_name = str.match(/Court : (.*?)<\/span><\/strong>/)[1];

  return {
    cnr: cnr,
    case_name: case_name,
    judge_name: judge_name,
    date_of_registration: date_of_registration,
    date_of_decision: date_of_decision,
    disposal_nature: disposal_nature,
    court_name: court_name,
  };
}

async function isLoading(page) {
  try {
    // Wait for the loading modal to appear
    await page.waitForSelector("#loadMe.modal.hide.show", {
      visible: true,
      timeout: 7000,
    });
  } catch (error) {
    logger.info("Loading Modal did not appear in time");
  }
  try {
    // Wait for the loading modal to disappear
    await page.waitForSelector("#loadMe", {
      timeout: 7000,
      hidden: true,
    });
  } catch (error) {
    logger.info("Loading Modal did not disappear in time");
  }
}

async function getCaptcha(elementHandle) {
  const screenshotData = await elementHandle.screenshot();

  const filename = `img_${uuidv4()}.jpg`;

  writeFileSync(filename, screenshotData);

  const r = (await Tesseract.recognize(filename, "eng")).data.text;

  unlinkSync(filename);

  return r; // Return solved captcha text
}

async function attemptCaptcha(page) {
  try {
    while (true) {
      await page.waitForSelector("#captcha_image");
      try {
        const img = await page.$("#captcha_image");
        const text = await getCaptcha(img);

        // Enter the captcha text and perform other actions
        await page.focus("#captcha");
        await page.keyboard.type(text);
        await page.click("#main_search");
      } catch (error) {
        logger.error(error);
      }

      await delay(2000);

      logger.info("checking for captcha error");

      const numeric = await page.$x(
        "//div[contains(text(), 'Captcha should be numeric..!')]"
      );
      const element = await page.$x(
        "//div[contains(text(), 'Please enter captcha')]"
      );

      const invalid = await page.$x(
        "//div[contains(text(), 'Invalid Captcha..!!!')]"
      );

      logger.info(`${numeric.length}, ${element.length}, ${invalid.length}`);

      if (numeric.length || element.length) {
        try {
          await page.click(".btn-close");
          await page.evaluate(`document.getElementById("captcha").value = "";`);
          await page.evaluate(`if (typeof window.captcha_image_audioObj !== "undefined") {
  captcha_image_audioObj.refresh();
  document.getElementById("captcha_image").src =
    "/pdfsearch/vendor/securimage/securimage_show.php?" + Math.random();
  this.blur();
}`);
          await delay(1000);
        } catch (error) {
          logger.error(error);
        }

        continue;
      } else if (invalid.length) {
        try {
          await page.click(".btn-close");
          await page.evaluate(`document.getElementById("captcha").value = "";`);
          await delay(1000);
          continue;
        } catch (error) {
          logger.error(error);
        }
      } else {
        break;
      }
    }
  } catch (error) {
    logger.error(error);
  }
}

async function handleObjectLoading(page, eventEmitter) {
  // logger.info("handleObjectLoading", shouldExit);
  // if (shouldExit) return;
  try {
    // try to wait for the object selector
    await page.waitForSelector("object", { timeout: 4000 }); // Waiting for 4 seconds
  } catch (err) {
    // if a timeout error occurs, this means the captcha has likely appeared
    logger.info(`${err}`);
    eventEmitter.emit("finished", false);
  }
}

async function goToNextPage(page) {
  while (true) {
    await delay(2000);
    try {
      await page.evaluate(
        `document.querySelector('#example_pdf_next').click();`
      );
      logger.info("page clicked");
      await page.waitForSelector("#validateError.modal", {
        visible: true,
        timeout: 3000,
      });
      logger.info("next page error modal found");
      page.click("#validateError.modal .btn-close");
      continue;
    } catch (error) {
      logger.error("no error dialog found, moving to next page");
      break;
    }
  }
}

function getRandomDelay(min = 2000, max = 3000) {
  // Generate a random delay between min and max (both inclusive)
  return Math.floor(Math.random() * (max - min + 1) + min);
}

async function writeCompleted(taskID) {
  await query("UPDATE tasks SET status = 'completed' WHERE id = $1", [taskID]);
}

async function main(page, courtValue, toDate, fromDate, taskID) {
  const eventEmitter = new events.EventEmitter();
  let isFirstRun = true;

  // const proxy = await getFreeProxies();
  // logger.info(`Using proxy: ${proxy}`);
  // await useProxy(page, proxy);

  await page.setViewport({ width: 1680, height: 1000 });

  // Log requests
  page.on("request", (request) => {
    if (request.url().includes("pdf_search/home/")) {
      logger.info(`Request: ${(request.url(), request.postData())}`);

      if (
        request.postData() &&
        request.postData().includes(`state_code=${courtValue}`)
      ) {
        isFirstRun = false;
      }
    }
  });

  // Intercept responses
  page.on("response", async (response) => {
    try {
      if (response.url().includes("pdf_search/home/")) {
        if (isFirstRun) {
          logger.info("First run, skipping...");
          return;
        }

        //prevent json error from crashing the entire script
        let data;
        try {
          data = await response.json();
        } catch (error) {
          logger.error(error);
          return;
        }

        //check is data contains the key `reportrow`
        if (!data.hasOwnProperty("reportrow")) {
          return;
        }

        const buttonHandles = data.reportrow.aaData;

        for (const button of buttonHandles) {
          const buttonString = button[1];
          const onClickRegex = /onclick=javascript:(.*?);/g;
          const jsCode = onClickRegex.exec(buttonString)[1];

          // Download the PDF
          const { cnr } = extractDetails(buttonString);

          const row = await query(
            "SELECT cnr FROM records WHERE cnr = $1",
            [cnr]
            // (err, row) => {
            //   if (err) {
            //     return err;
            //   } else {
            //     return row;
            //   }
            // }
          )
            .then((res) => res.rows[0])
            .catch((err) => logger.error(err));

          if (row) {
            logger.info(`Record with CNR ${cnr} already exists.`);
            continue;
          }

          await delay(getRandomDelay());

          await page.evaluate(jsCode);

          // Wait for the PDF to load
          await handleObjectLoading(page, eventEmitter);
          await page.waitForSelector("#viewFiles", { visible: true });
          const pdfUrl = await page.evaluate(() => {
            const object = document.querySelector("object");
            return object?.getAttribute("data");
          });
          logger.info(`PDF URL: ${pdfUrl}`);

          downloadWithLimit(
            `https://judgments.ecourts.gov.in/${pdfUrl}`,
            `pdfs/${cnr}.pdf`,
            extractDetails(buttonString)
          );
        }

        if (buttonHandles.length < PAGE_SIZE) {
          logger.info(`finished event emitted from buttonHandles`);
          await writeCompleted(taskID);
          eventEmitter.emit("finished", true);
          return;
        }

        //moving to next page
        await goToNextPage(page);
      }
    } catch (error) {
      logger.info(
        `error at response catch for ${courtValue}${fromDate}${toDate}: ${error}`
      );
      logger.info("finished event emitted");
      eventEmitter.emit("finished", false);
    }
  });

  try {
    await page.goto("https://judgments.ecourts.gov.in/pdfsearch/", {
      timeout: 60000,
    });

    await page.waitForSelector('select[name="fcourt_type"]');
    await page.select('select[name="fcourt_type"]', "2");

    // Perform the action that will trigger the navigation
    await attemptCaptcha(page);

    // Set up the event listener before starting the navigation
    const finishedPromise = new Promise((resolve, reject) => {
      logger.info("Waiting for finish event...");
      function onFinished(isComplete) {
        logger.info("Finished the current task");
        eventEmitter.removeListener("finished", onFinished); // remove listener
        resolve(isComplete);
      }
      eventEmitter.on("finished", onFinished);
    });

    // Start listening to the navigation

    await page.waitForFunction(
      'document.readyState === "complete" || document.readyState === "interactive"'
    );

    await isLoading(page);

    logger.info(`current page: ${page.url()}`);

    //set court type
    await page.waitForSelector("select#state_code");
    await page.select("select#state_code", courtValue);

    //set date
    await page.evaluate(`document.querySelector('#exampleRadios5').click()`);
    await page.evaluate(
      `document.getElementById('from_date').value = '${fromDate}'`
    );
    await page.evaluate(
      `document.getElementById('to_date').value = '${toDate}'`
    );

    await delay(2000);

    await page.click(".btn.btn-outline-secondary.col-sm.btn-sm.me-1");

    // await isLoading(page);

    // Set maximum entries per page
    // await page.waitForSelector('select[name="example_pdf_length"]');
    // await page.select('select[name="example_pdf_length"]', `${PAGE_SIZE}`);

    await isLoading(page);

    //Check if there are any records
    const isEmpty = await page.$(".dataTables_empty");
    if (isEmpty) {
      logger.info("No records found!");
      await writeCompleted(taskID);
      eventEmitter.emit("finished", true);
    }

    // after setting up the response event listener:
    const r = await finishedPromise;
    return r;
  } catch (error) {
    logger.error(`error at main catch ${error}`);
    return false;
  }
}

const MAX_CONCURRENCY = process.env.MAX_CONCURRENCY; // Define your maximum concurrency level
const WORKER_ID = process.env.WORKER_ID;
const HEADLESS = process.env.HEADLESS;
const BATCH_SIZE = 200;

async function runCluster() {
  // Create a set of worker functions
  let tasks = await fetchTasksBatch(WORKER_ID);

  let activeWorkers = 0;

  const workers = Array.from(
    { length: parseInt(MAX_CONCURRENCY) },
    () => async () => {
      while (true) {
        // If there are no more tasks in the array, fetch another batch
        if (tasks.length === 0) {
          tasks = await fetchTasksBatch(WORKER_ID);

          // If there are still no more tasks after fetching, break the loop
          if (tasks.length === 0) break;
        }

        // Take the first task from the array
        const task = tasks.shift();
        activeWorkers++;

        logger.info(`Currently active workers: ${activeWorkers}`);

        const data = {
          taskID: task.id,
          court: task.court,
          fromDate: task.from_date.toISOString().split("T")[0],
          toDate: task.to_date.toISOString().split("T")[0],
        };

        logger.info(`Data is ${Object.entries(data)}`);

        // Create a new Puppeteer browser
        const browser = await puppeteer.launch({
          headless: "new",
        });

        // Create a new page
        const page = await browser.newPage();
        logger.info(
          `Starting task with id ${data.taskID} for court ${data.court} and date range ${data.fromDate} to ${data.toDate}`
        );

        try {
          await main(
            page,
            data.court,
            data.toDate,
            data.fromDate,
            data.taskID
          ).catch((err) => {
            logger.error(err);
          });
        } catch (err) {
          logger.error(err);
        } finally {
          await page.close();
          logger.info("Page closed");
          await browser.close();
          logger.info("Browser closed");
          activeWorkers--;
        }
      }
    }
  );

  // Start all workers
  await Promise.all(workers.map((worker) => worker()));
}

async function fetchTasksBatch(workerId) {
  const { rows } = await query(
    `UPDATE tasks 
     SET claimed_by = $1, claimed_at = NOW() 
     WHERE id IN (
       SELECT id FROM tasks 
       WHERE status = 'pending' AND (claimed_by IS NULL OR claimed_by = $1) 
       LIMIT $2
     ) RETURNING *`,
    [workerId, BATCH_SIZE]
  );

  logger.info(
    `Fetched ${rows.length} with first value ${Object.entries(
      rows[0]
    )} tasks for worker ${workerId}`
  );

  return rows;
}

export { runCluster };
