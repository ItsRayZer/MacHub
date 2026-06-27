const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('C:\\Users\\abens\\.gemini\\antigravity\\brain\\6104b00a-a7d5-4e79-b96a-72cb4cb181ea\\scratch\\exam_result_raw.html', 'utf8');
const $ = cheerio.load(html);
let output = '';
$('div.panel-body, div.card-body, .container, .row').each((i, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length > 50 && text.includes('Grade') || text.includes('SGPA') || text.includes('Marks')) {
        output += `Element ${i}:\n${text.substring(0, 500)}\n\n`;
    }
});
console.log(output || "No Grade divs found.");
