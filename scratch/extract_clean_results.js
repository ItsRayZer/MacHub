const fs = require('fs');
const path = require('path');

const srcPath = 'C:\\Users\\abens\\OneDrive\\Documents\\02_Projects\\Active_Projects\\DareToWin\\app.js';
const destPath = path.resolve(__dirname, 'clean_results.js');

if (!fs.existsSync(srcPath)) {
    console.error('Source file not found!');
    process.exit(1);
}

const lines = fs.readFileSync(srcPath, 'utf8').split('\n');

// Lines are 1-indexed. We want lines 113 to 697 (0-indexed indices 112 to 696).
const extractedLines = lines.slice(112, 697);

// Clean up line 113 (which is index 0 of extractedLines)
// "    navItems: window.switchExamTab = function(tab) {" -> "window.switchExamTab = function(tab) {"
extractedLines[0] = extractedLines[0].replace(/^\s*navItems:\s*/, '');

// Clean up line 697 (which is last index of extractedLines)
// "}," -> "}"
const lastIdx = extractedLines.length - 1;
if (extractedLines[lastIdx].trim() === '},') {
    extractedLines[lastIdx] = extractedLines[lastIdx].replace(/,$/, '');
}

fs.writeFileSync(destPath, extractedLines.join('\n'), 'utf8');
console.log(`Successfully extracted and cleaned results code to ${destPath}`);
