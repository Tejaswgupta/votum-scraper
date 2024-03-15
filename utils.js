
import { Configuration, NopeCHAApi } from "nopecha";

export async function getCaptchaUsingAPI(image) {
  const configuration = new Configuration({
    apiKey: 'sub_1OufbWCRwBwvt6pttFeIThTV',
  });
  const nopecha = new NopeCHAApi(configuration);

  const base64Encoded = image.toString('base64');

  const text = await nopecha.solveRecognition({
    type: 'textcaptcha',
    image_urls: [base64Encoded],
  });

  console.log('Captcha text'+text)

  return text
}


