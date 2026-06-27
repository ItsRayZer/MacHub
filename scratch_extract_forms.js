const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('C:\\Users\\abens\\.gemini\\antigravity\\brain\\6104b00a-a7d5-4e79-b96a-72cb4cb181ea\\scratch\\examresult_debug.html', 'utf8');
const $ = cheerio.load(html);

console.log('--- SELECT HTML ---');
console.log($('select').html());

console.log('--- INPUT ELEMENTS ---');
$('input[type="submit"], button').each((_, el) => console.log('Button:', $(el).attr('name') || $(el).attr('id')));
