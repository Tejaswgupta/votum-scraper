import puppeteer from "puppeteer";

class PuppeteerManager {
  constructor() {
    this.browser = null;
  }

  async launchBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'shell', // Adjust based on your preference
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-accelerated-2d-canvas",
          `--proxy-server=${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`,
          `--proxy-auth=${process.env.PROXY_USERNAME}:${process.env.PROXY_PASSWORD}`,
        ],
      });
    }
    return this.browser;
  }

  async getPage() {
    const browser = await this.launchBrowser();
    return  browser.newPage();
  }

  async authenticatePage(page) {
    await page.authenticate({
      username: `${process.env.PROXY_USERNAME}`,
      password: `${process.env.PROXY_PASSWORD}`,
    });
  }
}

 const pupManager = new PuppeteerManager();

 export default pupManager