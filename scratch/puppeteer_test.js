const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    
    console.log('Navigating to localhost:3001...');
    await page.goto('http://localhost:3001/');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const isDrawerDefined = await page.evaluate(() => typeof window.openPortalDrawer);
    const isSyncDefined = await page.evaluate(() => typeof window.syncHomePortalDashboard);
    
    console.log('window.openPortalDrawer typeof:', isDrawerDefined);
    console.log('window.syncHomePortalDashboard typeof:', isSyncDefined);
    
    await browser.close();
})();
