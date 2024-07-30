const fs = require("fs/promises");
const { faker } = require("@faker-js/faker");
const pt = require("puppeteer-extra");
const chalk = require("chalk");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
pt.use(StealthPlugin());
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker");
pt.use(
  AdblockerPlugin({
    interceptResolutionPriority: 0, // const { DEFAULT_INTERCEPT_RESOLUTION_PRIORITY } = require('puppeteer')
  })
);
const FirstName = 'Steve';
const FILENAME = 'david.txt';
const PASSWORD = "";
const COUNTRY = "Poland";
// Proxy server details
const PROXY_SERVER = "";
const PROXY_USERNAME = "ptc-59";
const PROXY_PASSWORD = "ptc-59";
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const signup = async (page, emailAddress) => {
  await page.waitForSelector('div#onetrust-close-btn-container button[aria-label="Close"]');
  await page.$eval('div#onetrust-close-btn-container button[aria-label="Close"]', (el) => el.click());
  await page.waitForSelector('[data-qa="work"]', { timeout: 300000 });
  await page.$eval('[data-qa="work"]', (el) => el.click());
  await page.$eval(`button[type="button"][data-qa="btn-apply"]`, (el) => el.click());
  await page.waitForSelector("#first-name-input");
  await page.type("#first-name-input", FirstName);
  await page.type("#last-name-input", faker.person.lastName("male"));
  await page.type("#redesigned-input-email", emailAddress);
  await page.type("#password-input", PASSWORD);
  await page.waitForSelector('[aria-labelledby*="select-a-country"]', {
    timeout: 100000,
  });
  await delay(1500);
  await page.$eval('[aria-labelledby*="select-a-country"]', (el) =>
    el.click()
  );
  await page.waitForSelector('[autocomplete="country-name"]');
  await page.type('[autocomplete="country-name"]', COUNTRY);
  await page.$eval(
    '[aria-labelledby="select-a-country"] li',
    (el) => el.click(),
    { timeout: 100000 }
  );
  await delay(500);
  await page.$eval("#checkbox-terms", (el) => el.click());
  await delay(500);
  await page.$eval("#button-submit-form", (el) => el.click());
  await delay(2000);
};
const currentDate = () => {
  const d = new Date();
  return `${d.getFullYear()}.${d.getMonth()}.${d.getDate()} ${d.getHours()}:${d.getMinutes()}`;
};
const checkConnect = async (page, emailAddress) => {
  await page.goto("https://www.upwork.com/nx/create-profile/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("ul.welcome-step1-list");
  await delay(2000);
  const listCount = await page.evaluate(() => {
    return Array.from(document.querySelector("ul.welcome-step1-list").children).length;
  });
  if (listCount == 3) {
    try {
      await fs.access(FILENAME);
      await fs.appendFile(FILENAME, emailAddress + "\n");
    } catch (err) {
      await fs.writeFile(FILENAME, emailAddress + "\n");
      console.error(`Error accessing file: ${err}`);
    }
    return true;
  }
  return false;
};
const readMail = async (page) => {
  const ul = await page.$("#list_mail");
  let childCount = 0;
  let readMailTryCount = 0;
  while (childCount !== 3) {
    childCount = await page.evaluate((el) => el.children.length, ul);
    if (++readMailTryCount > 10 || childCount === 3) {
      break;
    }
    await page.waitForSelector("a#btn_refresh");
    await page.$eval("a#btn_refresh", (el) => el.click());
    await delay(1000);
  }
  if (childCount !== 3) return "";
  await page.waitForSelector("#list_mail li:nth-child(2) a");
  await page.$eval("#list_mail li:nth-child(2) a", (el) => el.click());
  await delay(5000);
  const hrefValue = await page.evaluate(() => {
    const aElement = document.querySelector(".button-holder > a"); // Select the <a> element
    if (aElement) {
      return aElement.getAttribute("href"); // Get the value of the href attribute
    } else {
      return ""; // Return a message if the href attribute is not found
    }
  });
  return hrefValue;
};
(async () => {
  while (true) {
    let browser;
    try {
      console.log(`--------------- Start: ${new Date()} ------------`);
      const start = performance.now();
      browser = await pt.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          `--proxy-server=${PROXY_SERVER}`,
        ],
      });
      const context = browser.defaultBrowserContext();
      context.overridePermissions("https://10minutemail.net", ["geolocation"]);
      // Generate Email Address
      console.log("Generating new email address");
      let emailAddress = "";
      let emailTryCount = 0;
      const etempMail = await browser.newPage();
      await etempMail.authenticate({
        username: PROXY_USERNAME,
        password: PROXY_PASSWORD,
      });
      await etempMail.goto("https://10minutemail.net/m/", { timeout: 0, waitUntil: "domcontentloaded" });
      const emailInput = await etempMail.$("span#span_mail");
      await etempMail.waitForSelector("span#span_mail");
      while (emailAddress === "") {
        emailAddress = await etempMail.evaluate((el) => el.textContent, emailInput);
        await delay(1000);
        if (++emailTryCount > 10 || emailAddress !== "") {
          break;
        }
      }
      if (emailAddress == "") {
        console.log("Generating new email failed.");
        console.log(`--------------- End: ${new Date()} ------------\n\n\n`);
        await browser.close();
        continue;
      }
      console.log(`New email address: ${emailAddress} (${((performance.now() - start) / 1e3).toFixed(2)}s)`);
      // Signup
      console.log("Sign up using new email address");
      const singupStart = performance.now();
      const upwork = await browser.newPage();
      await upwork.authenticate({
        username: PROXY_USERNAME,
        password: PROXY_PASSWORD,
      });
      await upwork.goto("https://www.upwork.com/nx/signup/?dest=home", {
        waitUntil: "domcontentloaded",
      });
      await signup(upwork, emailAddress);
      await upwork.screenshot({ path: "screenshot.png" });
      console.log(`Sign up success (${((performance.now() - singupStart) / 1e3).toFixed(2)}s)`);
      // Getting verification link
      console.log("Getting verification link");
      const verStart = performance.now();
      const verify_link = await readMail(etempMail);
      if (verify_link == "") {
        console.log("Getting verification link failed.");
        console.log(`--------------- End: ${new Date()} ------------\n\n\n`);
        await browser.close();
        continue;
      }
      console.log(`Verification link: ${verify_link} (${((performance.now() - verStart) / 1e3).toFixed(2)}s)`);
      await upwork.goto(verify_link, {
        waitUntil: "domcontentloaded",
      });
      await delay(5000);
      // Checking connections
      console.log("Checking connections");
      const hasConnect = await checkConnect(upwork, emailAddress);
      await browser.close();
      let end = performance.now();
      console.log(
        emailAddress + " => " + ((end - start) / 1e3).toFixed(2) + "s : " + (hasConnect ? chalk.bgGreen(hasConnect) : chalk.bgRed(hasConnect))
      );
      await delay(Math.random() * 10000);
    } catch (error) {
      if (browser !== undefined) await browser.close();
      console.log(`Unexpectedly finished. Error: ${error}`);
    }
    console.log(`--------------- End: ${new Date()} ------------\n\n\n`);
  }
})();
