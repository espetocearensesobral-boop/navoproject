import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('console', msg => console.log('LOG:', msg.text()));

  await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle2' });
  await browser.close();
})();
