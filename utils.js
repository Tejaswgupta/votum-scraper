import { Configuration, NopeCHAApi } from "nopecha";
import fs from 'fs';
import path from 'path';

// Helper function to generate a unique filename
function generateFileName(baseDir, prefix, ext) {
  const date = new Date();
  const dateString = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}${date.getSeconds().toString().padStart(2, '0')}`;
  return path.join(baseDir, `${prefix}_${dateString}${ext}`);
}

export async function getCaptchaUsingAPI(image) {
  const configuration = new Configuration({
    apiKey: 'sub_1OufbWCRwBwvt6pttFeIThTV',
  });
  const nopecha = new NopeCHAApi(configuration);

  const base64Encoded = image.toString('base64');

  try {
    const response = await nopecha.solveRecognition({
      type: 'textcaptcha',
      image_urls: [base64Encoded],
    });

    // Since the API returns an array of texts, we take the first item
    let text = response.length > 0 ? response[0] : "";

    console.log('Captcha text:', text);

    // Ensure the captcha_files directory exists
    const baseDir = './captcha_files';
    if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
    }

    // Save the captcha image
    const imagePath = generateFileName(baseDir, 'captcha', '.png');
    fs.writeFileSync(imagePath, Buffer.from(base64Encoded, 'base64'));

    // Save the captcha text
    const textPath = generateFileName(baseDir, 'captcha_text', '.txt');
    fs.writeFileSync(textPath, text);

    console.log(`Captcha image saved to ${imagePath}`);
    console.log(`Captcha text saved to ${textPath}`);

    return text;
  } catch (error) {
    console.error('Error solving CAPTCHA:', error);
    return ''; // Return an empty string or handle the error as appropriate
  }
}
