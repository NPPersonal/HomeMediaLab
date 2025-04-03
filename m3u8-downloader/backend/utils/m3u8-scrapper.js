import { chromium } from "playwright";

const m3u8Regex = /^https?:\/\/.*.m3u8/;
const isM3U8Url = (url) => {
  return m3u8Regex.test(url);
};

export const scrapeM3U8Urls = async (url) => {
  let browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const m3u8Responses = [];

    page.on("response", (response) => {
      if (isM3U8Url(response.url())) m3u8Responses.push(response.url());
      //   console.log("page get respond", response.status(), response.url());
    });

    try {
      await page.goto(url, { waitUntil: "load" });
      const pageContent = await page.content();
      const foundUrls = pageContent.match(/(https|http):\/\/.*.m3u8/gm);
      if (foundUrls) {
        foundUrls.forEach((url) => {
          if (!m3u8Responses.includes(url)) {
            m3u8Responses.push(url);
          }
        });
      }
      return m3u8Responses;
    } catch (error) {
      console.log(error);
      throw new Error(
        `Fail to scrape m3u8 url from website: ${url}\n${error.message}`
      );
    } finally {
      await page.removeAllListeners();
      await page.close();
    }
  } catch (error) {
    throw new Error(`Scrapper fail to launch browser\n${error.message}`);
  } finally {
    await browser.close();
  }
};
