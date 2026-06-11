const fs = require('fs');
const cheerio = require('C:\\Users\\abens\\.gemini\\antigravity\\worktrees\\MacHub\\machin-scraper-backend-engine\\node_modules\\cheerio');

const htmlPath = 'C:\\Users\\abens\\.gemini\\antigravity\\brain\\6104b00a-a7d5-4e79-b96a-72cb4cb181ea\\scratch\\examresult_debug.html';
if (!fs.existsSync(htmlPath)) {
    console.error("HTML file not found:", htmlPath);
    process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');
const $ = cheerio.load(html);

// Find tables and print their rows
$('table').each((i, el) => {
    console.log(`Table ${i}:`);
    $(el).find('tr').slice(0, 10).each((rIdx, tr) => {
        const cells = [];
        $(tr).find('th, td').each((cIdx, td) => {
            cells.push($(td).text().trim().replace(/\s+/g, ' '));
        });
        console.log(`  Row ${rIdx}:`, JSON.stringify(cells));
    });
});
