const fs = require('fs');
const path = require('path');

const files = [
    'step_10438_InternalMark.jsx',
    'step_10440_ExamResult.jsx',
    'step_10494_usePortalData.js',
    'step_10496_Attendance.jsx',
    'step_10508_Login.jsx'
].map(f => path.resolve(__dirname, f));

function unescapeString(str) {
    if (str.startsWith('"') && str.endsWith('"')) {
        str = str.substring(1, str.length - 1);
    } else if (str.startsWith("'") && str.endsWith("'")) {
        str = str.substring(1, str.length - 1);
    }
    return str
        .replace(/\\r/g, '\r')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, '\\');
}

for (const file of files) {
    if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf8');
        const unescaped = unescapeString(raw);
        const outName = 'unescaped_' + path.basename(file).substring(11); // remove step_XXXXX_
        const outPath = path.resolve(__dirname, outName);
        fs.writeFileSync(outPath, unescaped, 'utf8');
        console.log(`Unescaped ${path.basename(file)} -> ${outName} (length: ${unescaped.length})`);
    } else {
        console.log(`File not found: ${file}`);
    }
}
