const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('C:\\Users\\abens\\.gemini\\antigravity\\brain\\6104b00a-a7d5-4e79-b96a-72cb4cb181ea\\scratch\\examresult_debug.html', 'utf8');
const $ = cheerio.load(html);

console.log('--- RAW DIV CONTENTS ---');
$('div.panel-body, div.card-body, #MainContent_UpdatePanel1, div.table-responsive').each((i, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length > 50) {
        console.log(`Element ${i}: ` + text.substring(0, 300));
    }
});
