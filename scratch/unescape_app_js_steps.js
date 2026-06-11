const fs = require('fs');
const path = require('path');

const files = [
    'step_9099_replacement.js',
    'step_9630_replacement.js',
    'step_9634_replacement.js',
    'step_10079_replacement.js',
    'step_5786_replacement.js'
];

function unescapeString(str) {
    // If it is JSON, parse it
    if (str.startsWith('"') && str.endsWith('"')) {
        try {
            return JSON.parse(str);
        } catch (e) {
            // fallback manual unescape
            str = str.substring(1, str.length - 1);
        }
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
    const filePath = path.resolve(__dirname, file);
    if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        const unescaped = unescapeString(raw.trim());
        const outName = 'clean_' + file;
        const outPath = path.resolve(__dirname, outName);
        fs.writeFileSync(outPath, unescaped, 'utf8');
        console.log(`Unescaped ${file} -> ${outName} (length: ${unescaped.length})`);
    } else {
        console.log(`File not found: ${filePath}`);
    }
}
