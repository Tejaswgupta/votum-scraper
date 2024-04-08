import fs from 'fs';
import { Configuration, NopeCHAApi } from "nopecha";
import path from 'path';

function generateFileName(baseDir, prefix, ext) {
    let counter = 1;
    let filePath;
    do {
        filePath = path.join(baseDir, `${prefix}_${counter}${ext}`);
        counter++;
    } while (fs.existsSync(filePath));
    return filePath;
}

export async function getCaptchaUsingAPI(image) {
    const configuration = new Configuration({
        apiKey: process.env.API_KEY,
    });
    const nopecha = new NopeCHAApi(configuration);

    const base64Encoded = image.toString('base64');

    let response = await nopecha.solveRecognition({
        type: 'textcaptcha',
        image_urls: [base64Encoded],
    });

    // Extracting text from the response
    let text = Array.isArray(response) ? response[0] : response;
    console.log('Captcha text:', text);

    const baseDir = './captcha_files';
    // Ensure the directory exists
    if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir);
    }

    const imagePath = generateFileName(baseDir, 'captcha', '.png');
    const textPath = generateFileName(baseDir, 'captcha_text', '.txt');

    // Save the image and text to their respective files
    fs.writeFileSync(imagePath, Buffer.from(base64Encoded, 'base64')); // Convert base64 back to binary before saving
    fs.writeFileSync(textPath, text);

    console.log(`Captcha image saved to ${imagePath}`);
    console.log(`Captcha text saved to ${textPath}`);

    return text;
}
