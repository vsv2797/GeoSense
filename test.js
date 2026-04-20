const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8000/climate.html', { waitUntil: 'networkidle2' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => { document.querySelectorAll('.mbtn')[4].click(); });
  await page.waitForTimeout(1000);
  const flameCount = await page.evaluate(() => document.querySelectorAll('.globe-flame').length);
  const frostCount = await page.evaluate(() => document.querySelectorAll('.globe-frost').length);
  console.log(`Flames: ${flameCount}, Frosts: ${frostCount}`);
  await browser.close();
})();
