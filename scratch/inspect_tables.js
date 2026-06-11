const fs = require('fs');
const cheerio = require('C:\\Users\\abens\\.gemini\\antigravity\\worktrees\\MacHub\\machin-scraper-backend-engine\\node_modules\\cheerio');

const htmlPath = 'C:\\Users\\abens\\.gemini\\antigravity\\brain\\6104b00a-a7d5-4e79-b96a-72cb4cb181ea\\scratch\\examresult_debug.html';
const html = fs.readFileSync(htmlPath, 'utf8');
const $ = cheerio.load(html);

console.log(`HTML Length: ${html.length}`);
const tables = $('table');
console.log(`Found ${tables.length} tables`);

tables.each((i, el) => {
    const text = $(el).text().trim().substring(0, 100).replace(/\s+/g, ' ');
    console.log(`Table ${i}: Text: "${text}"`);
});
