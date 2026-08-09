import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('request', request => {
    console.log('Request:', request.url());
  });

  await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle2' });
  await browser.close();
})();
