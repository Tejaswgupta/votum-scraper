import cron from "node-cron";
import { createClient } from "@supabase/supabase-js";
import { fetchCNRhighcourt } from "./cnrNumberHighCourt.js";

const supabaseUrl = "https://zrkvvedwycdcjjheewef.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpya3Z2ZWR3eWNkY2pqaGVld2VmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDMwMTY4NTQsImV4cCI6MjAxODU5Mjg1NH0.WcjtqBxBPUfWx44wSTPPlEP25kmIYY6m46awFLB35ok";
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateCaseData() {
  let { data: votumCases, error } = await supabase
    .from("votum_cases")
    .select('id, "CNR Number"');

  if (error) {
    console.error("Error fetching cases:", error);
    return;
  }

  for (let caseItem of votumCases) {
    const formData = {
      searchType: "CNR Number",
      cnrNumber: caseItem["CNR Number"],
      court: "high court",
    };

    try {
      const updatedCaseData = await fetchCNRhighcourt(formData);
      const dataToSave = {
        ...JSON.parse(updatedCaseData),
      };

      // Updating
      const { data: updatedData, error: updateError } = await supabase
        .from("votum_cases")
        .update(dataToSave)
        .match({ id: caseItem.id }); // Match based on id

      if (updateError) {
        console.error(
          `Error updating case for id ${caseItem.id}:`,
          updateError
        );
      } else {
        console.log(
          `Case updated successfully for id ${caseItem.id}:`,
          updatedData
        );
      }
    } catch (scrapeError) {
      console.error("Error during scraping:", scrapeError);
    }
  }
}
//  CRON - every Sunday at midnight
//cron.schedule('0 0 * * SUN', updateCaseData);

//2 minutes after the script starts
// setTimeout(() => {
//     updateCaseData();
//     console.log('Update process started.');
// }, 2 * 60 * 1000);

// console.log('Scheduled to start updating in 2 minutes.');

// Directly
updateCaseData()
  .then(() => {
    console.log("Update process complete.");
  })
  .catch(console.error);
