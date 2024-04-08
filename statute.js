"use client";
import OpenAI from "openai";
import { v4 as uuidv4 } from "uuid";

const promtMaker = (fact) => {
  const prompt = `Task: Given examples of an FIR and the statutes applied in that case, your objective is to make accurate predictions of the specific charge or statute that is most likely to be applied within the context of the case delimited by triple quotes ("""), ensuring exact predictions and learning from the provided examples.You should only include the statutes it is most confident about.The response format should include the statutes applied as in the context.
You should to showcase creativity and knowledge to enhance the accuracy of statute predictions based on the given fact statement.

Context:
-----
Fact Statement:"In service Mr. SHO Akrabad Aligarh The request is that I am Rahul Kumar S/0 Gopal resident of Vijaygarh Chauraha Police Station Akrabad Aligarh, today on 30/4/2021 at around 7 o'clock in the evening I was sitting at my coke shop, Deepu, Kalu, Karthik, Dinesh, Saunu, came to me and started saying that you ask for a lot of money, now tell you that then the above people called their colleagues and called  And all of them unanimously started beating me and my sister Neelam, due to which my sister's clothes were torn, hearing the noise, Ramu Sunil, many people came from nearby, then all these people started running threatening to kill and then Kalu S/0 Dinanath resident of Kuagaon, Karthik S/0 Devendra,  Deepu fired at me with the intention of killing me, in which a fire has hit the thumb of my left hand, due to which I have suffered a lot of injury and bleeding, so I request sir to please file my report Signature Rahul Applicant Rahul S/0 Gopal R/o Vijaygarh Chauraha Police Station Akhrabad Aligarh Mo0 8126303026 Date30/4/2021 Author: Narasimma Pawar S/0 Rambabu Powerhouse, Karhala Road, Mau0 908400582 Note: I am CC 551 Sanjeev Kumar certifying that the copy of Tahrir has been recorded on the computer word and word"

Statutes:['IPC_323', 'IPC_354', 'IPC_307', 'IPC_506']
-----

###

Format your response as follows:
"Statutes applied: [List of applicable statutes]"

Instructions:

Learn from the examples provided in the context to understand the task of charge or statute prediction.
Your response should be focused on providing the exact statute or charge that aligns with the legal principles and precedents applicable to the given facts.
In your response, include only the statutes you are most confident about.Ensure that the statutes generated as responses are valid and recognized legal statutes applicable in FIRs. You can also apply sections from special acts including but not limited to 'The_Arms_Act_27' , 'The_Motor_Vehicles_Act_1988', 'Dowry_Prohibition_Act_1961', like this 'Dowry_Prohibition_Act_1961_3'. Avoid generating fabricated or invalid statutes.
Think step by step.

Fact Statement: """${fact}"""
`;

  const prompt_new = `Task: Analyze the provided First Information Report (FIR) and predict the most relevant legal statutes and sections that apply to the described incident. Your response should be based on the specific details contained within the FIR. When predicting, you should consider the Indian Penal Code (IPC) and other special acts such as the Protection of Children from Sexual Offences (POCSO) Act, the Motor Vehicles Act, etc. Ensure that your predictions are precise and reflect an understanding of the legal context of the FIR. Your response should be formulated as a list of statutes and sections, including the appropriate act name followed by the section number, e.g., 'IPC_323', 'POCSO_7', 'Motor_Vehicles_Act_1988_184'. Avoid predicting statutes that are not directly supported by the facts of the case. Be thorough and deliberate in your reasoning.

Context:
-----
Fact Statement:"In service Mr. SHO Akrabad Aligarh The request is that I am Rahul Kumar S/0 Gopal resident of Vijaygarh Chauraha Police Station Akrabad Aligarh, today on 30/4/2021 at around 7 o'clock in the evening I was sitting at my coke shop, Deepu, Kalu, Karthik, Dinesh, Saunu, came to me and started saying that you ask for a lot of money, now tell you that then the above people called their colleagues and called  And all of them unanimously started beating me and my sister Neelam, due to which my sister's clothes were torn, hearing the noise, Ramu Sunil, many people came from nearby, then all these people started running threatening to kill and then Kalu S/0 Dinanath resident of Kuagaon, Karthik S/0 Devendra,  Deepu fired at me with the intention of killing me, in which a fire has hit the thumb of my left hand, due to which I have suffered a lot of injury and bleeding, so I request sir to please file my report Signature Rahul Applicant Rahul S/0 Gopal R/o Vijaygarh Chauraha Police Station Akhrabad Aligarh Mo0 8126303026 Date30/4/2021 Author: Narasimma Pawar S/0 Rambabu Powerhouse, Karhala Road, Mau0 908400582 Note: I am CC 551 Sanjeev Kumar certifying that the copy of Tahrir has been recorded on the computer word and word"

Statutes:['IPC_323', 'IPC_354', 'IPC_307', 'IPC_506']
-----
 
 
Instructions:
- Carefully read the FIR to understand the nature of the incident and the actions of the involved parties.
- Identify specific actions described in the FIR that may correspond to legal offenses under the IPC or other relevant special acts.
- Predict the statutes by considering both the actions and the intent of the parties involved, as inferred from the FIR.
- Only include those statutes and sections for which there is clear evidence in the FIR. If the information provided does not support the application of a particular statute or section, do not include it.
- Ensure that the statutes and sections are currently in force and applicable within the jurisdiction of the FIR.
- Prioritize accuracy and relevancy in your predictions over the quantity of statutes listed

Provide a list of applicable statutes and sections in a clear and organized format like follows.
"Statutes applied: [List of applicable statutes]"

Now predict the statutes for the following fact statement.
Fact Statement: """${fact}"""
`;

  const prompt_new_2 = `You are an AI trained to predict the most applicable legal statutes and sections based on the content of a First Information Report (FIR). Below are examples of FIRs with the correctly applied statutes. Learn from these examples to accurately predict the statutes for a new FIR.
Example 1:
Fact Statement: "The complainant reported that their vehicle was stolen from outside their residence on the night of 5th April. The keys had been left in the ignition."
Statutes Applied: ['IPC_379', 'Motor_Vehicles_Act_1988_39']

Example 2:
Fact Statement: "An underage victim reported being touched inappropriately by an adult neighbor. The incident occurred when the victim was alone at home."
Statutes Applied: ['IPC_354', 'POCSO_7', 'POCSO_8']

Example 3:
Fact Statement: "During a routine traffic stop, the driver was found to be under the influence of alcohol. They were driving without a license and caused an accident resulting in minor injuries to a pedestrian."
Statutes Applied: ['IPC_279', 'IPC_337', 'Motor_Vehicles_Act_1988_185', 'Motor_Vehicles_Act_1988_3']

In your response, include only the statutes you are most confident about. Ensure that the statutes generated as responses are valid and recognized legal statutes applicable in FIRs. You can also apply sections from special acts including but not limited to 'The_Arms_Act_27' , 'The_Motor_Vehicles_Act_1988', 'Dowry_Prohibition_Act_1961', etc. Avoid generating fabricated or invalid statutes.
Now, predict the statutes for the following Fact Statement.
Fact Statement: "${fact}"
`;

  return [prompt, prompt_new, prompt_new_2];
};

const openai = new OpenAI({
  apiKey: "EMPTY",
  baseURL: "https://model.thevotum.com/v1",
});

async function translate(text) {
  const key = "8760fcb757fe44a19d3ec590cb80836f";
  const endpoint = "https://api.cognitive.microsofttranslator.com";

  const location = "centralindia";

  const path = "/translate";
  const constructedUrl = endpoint + path;

  const params = new URLSearchParams({
    "api-version": "3.0",
    from: "hi",
    to: "en",
  });

  const headers = {
    "Ocp-Apim-Subscription-Key": key,
    "Ocp-Apim-Subscription-Region": location,
    "Content-type": "application/json",
    "X-ClientTraceId": uuidv4(),
  };

  const body = JSON.stringify([{ text: text }]);

  const response = await fetch(constructedUrl + "?" + params.toString(), {
    method: "POST",
    headers: headers,
    body: body,
  });

  const data = await response.json();
  return data[0].translations[0].text;
}

function extractStatutes(gptOutput) {
  console.log(gptOutput);
  const regex = /\[([^\]]+)\]/g;
  const statutes = gptOutput.match(regex);
  if (statutes) {
    return statutes;
  } else {
    return [];
  }
}

async function generate(inputText) {
  const com = promtMaker(inputText);

  const modelName = (await openai.models.list()).data[0].id;

  const ans = [];

  // for (var a of com) {
  //   console.log(a);
  //   const chatCompletion = await openai.chat.completions.create({
  //     model: modelName,
  //     temperature: 0.3,
  //     messages: [
  //       {
  //         role: "system",
  //         content:
  //           "You are a helpful assistant who is expert in tagging FIRs with relevant statutes from IPC among other special acts.",
  //       },
  //       {
  //         role: "user",
  //         content: a,
  //       },
  //     ],
  //   });

  //   ans.push(
  //     `Answer ${com.indexOf(a)}: ${chatCompletion.choices[0].message.content}\n`
  //   );
  // }

  const promises = com.map((a, index) => {
    return openai.chat.completions
      .create({
        model: modelName,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant who is expert in tagging FIRs with relevant statutes from IPC among other special acts.",
          },
          {
            role: "user",
            content: a,
          },
        ],
      })
      .then((chatCompletion) => {
        return `Answer ${index}: ${chatCompletion.choices[0].message.content}\n`;
      });
  });

  const results = await Promise.all(promises);
  ans.push(...results);

  const filter_prompt = `An AI model just predicted the following answers for the given FIR content.
Your task is to choose the best answer or come up with the most logically appropriate combination of answers for the given FIR content.
Only put the sections that you are confident about. In case you find sections that you think do not exist, ask for a follow up question instead of assuming the section is made up.
Format your response as follows:"Statutes applied: [List of applicable statutes]" i.e ["IPC_133","IPC_155","IPC_307"]
FIR Content:${inputText}
Answers:
-----
${ans.join(" ")}
-----
Correct Statutes:
`;


  const filtered = await openai.chat.completions.create({
    model: modelName,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "You are an expert legal AI assistant, skilled in and tagging applicable legal statutes based on FIR content.",
      },
      {
        role: "user",
        content: filter_prompt,
      },
    ],
  });


  return filtered.choices[0].message.content;
}

export async function predictStatutes(firText, language) {
  let text;
  // let acStatute = '';

  if (language === "Hindi") {
    text = await translate(firText);
  } else {
    text = firText;
  }

  if (!text) {
    return {
      success: false,
      asStatus: "Please enter the FIR text to predict statutes.",
    };
  }

  const gptOutput = await generate(text);

  const statutesList = extractStatutes(gptOutput);
  if (statutesList.length > 0) {
    return { success: true, statutesList };
    // return [statutesList.map(statute => `- ${statute}`).join("\n"), acStatute];
  } else {
    return {
      success: false,
      asStatus:
        "No statutes were predicted. Please check the FIR text and try again.",
    };
  }
}