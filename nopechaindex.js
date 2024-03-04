const { Configuration, NopeCHAApi } = require('nopecha');

const configuration = new Configuration({
    apiKey: 'YOUR_API_KEY',
});
const nopecha = new NopeCHAApi(configuration);

(async () => {
    // Call the Recognition API
    const text = await nopecha.solveRecognition({
        type: 'textcaptcha',
        image_urls: ['https://nopecha.com/image/demo/textcaptcha/00Ge55.png'],
    });

    // Print the text to type
    console.log(text);
})();