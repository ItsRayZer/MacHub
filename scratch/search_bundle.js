const fs = require('fs');
const content = fs.readFileSync('machub-app/dist/assets/index-kSs_Rgn3.js', 'utf8');

function search(query) {
    const idx = content.indexOf(query);
    if (idx !== -1) {
        console.log(`Found "${query}" at index ${idx}. Surrounding:`);
        console.log(content.substring(Math.max(0, idx - 100), Math.min(content.length, idx + 200)));
    } else {
        console.log(`"${query}" NOT found.`);
    }
}

search('beautifully');
search('organ');
search('Admission');
search('Welcome');
