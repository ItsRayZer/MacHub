const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('C:\\Users\\abens\\.gemini\\antigravity\\brain\\6104b00a-a7d5-4e79-b96a-72cb4cb181ea\\scratch\\exam_result_raw.html', 'utf8');
const $ = cheerio.load(html);
console.log($('table').first().html() || "NO TABLE FOUND");
