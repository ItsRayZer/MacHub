const fs = require('fs');
const path = require('path');

const files = [
    'machub-app/src/hooks/usePortalData.js.recovered',
    'machub-app/src/pages/InternalMark.jsx.recovered',
    'machub-app/src/pages/ExamResult.jsx.recovered'
].map(p => path.resolve(__dirname, '..', p));

for (const file of files) {
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        console.log(`File: ${path.basename(file)}`);
        console.log(`Length: ${content.length}`);
        console.log(`First 100 chars: ${JSON.stringify(content.substring(0, 100))}`);
        console.log(`Ends with quotes? ${content.endsWith('"') || content.endsWith("'")}`);
        console.log('---');
    } else {
        console.log(`File not found: ${file}`);
    }
}
