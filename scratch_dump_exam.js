const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('C:\\Users\\abens\\.gemini\\antigravity\\brain\\6104b00a-a7d5-4e79-b96a-72cb4cb181ea\\scratch\\examresult_debug.html', 'utf8');
const $ = cheerio.load(html);
$('table').each((i, el) => {
    console.log('Table ' + i + ':');
    console.log($(el).html().substring(0, 500) + '...');
});
