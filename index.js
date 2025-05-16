const puppeteer = require("puppeteer");
// import { GoogleGenAI } from "@google/genai"; //module
const { GoogleGenAI } = require("@google/genai"); //commonjs
const ObjectsToCsv = require("objects-to-csv");
const dotenv = require("dotenv");
dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function AIPhoneFetcher(html) {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: `Fetch the phone number from the text ${html} and return me the phone number only nothing else`,
  });

  return response.text;
}

async function AIWebsiteFetcher(html) {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: `Fetch the website from the text ${html} and return me the website only nothing else`,
  });

  return response.text;
}

async function scrapeGoogleMaps(keywords) {
  const arr = [];
  
  const browser = await puppeteer.launch({ headless: false }); // set to true to hide browser
  const page = await browser.newPage();

  for (const keyword of keywords) {
    console.log(`🔍 Searching: ${keyword}`);
    await page.goto("https://www.google.com/maps", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("input#searchboxinput", { timeout: 60000 }); // longer timeout
    await page.click("input#searchboxinput");
    await page.keyboard.type(keyword);
    await page.keyboard.press("Enter");
    await new Promise((res) => setTimeout(res, 8000));

    // Auto-scroll to load more results
    await page.evaluate(async () => {
      const scrollableSection = document.querySelector('div[role="feed"]');
      let previousHeight = 0;
      let attempts = 0;

      while (attempts < 30) {
        // scroll 30 times max
        scrollableSection.scrollBy(0, 500);
        await new Promise((res) => setTimeout(res, 1000));

        const currentHeight = scrollableSection.scrollHeight;
        if (currentHeight === previousHeight) {
          attempts++;
        } else {
          attempts = 0;
          previousHeight = currentHeight;
        }
      }
    });

    const listingUrls = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a.hfpxzc"));
      return anchors
        .map((a) => a.href)
        .filter((href) => href.includes("/place/"));
    });

    console.log(`📌 Found ${listingUrls.length} listings for "${keyword}"`);

    for (const url of listingUrls.slice(0, 100)) {
      // Limiting to 10 for speed
      await page.goto(url, { waitUntil: "networkidle2" });
      await new Promise((res) => setTimeout(res, 3000));

      const elements = await page.$$eval(".Io6YTe", (nodes) =>
        nodes.map((el) => el.textContent.trim())
      );

      console.log("🔍 Found texts:", elements);
      let phoneNumber = await AIPhoneFetcher(elements);
      let website = await AIWebsiteFetcher(elements);

      arr.push({ phoneNumber, website });
    }
  }

  await browser.close();

  (async () => {
    const csv = new ObjectsToCsv(arr);

    // Save to file:
    await csv.toDisk("./test.csv");

    // Return the CSV file as string:
    console.log(await csv.toString());
  })();
}

// 🚀 Run with your keywords
scrapeGoogleMaps(["Enter your keywords here"]);
