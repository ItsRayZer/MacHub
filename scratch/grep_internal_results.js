const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, 'search_internal_results.txt');
if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    console.log(`Searching for Attendance.jsx in search_internal_results.txt (Total lines: ${lines.length})`);
    
    let matchedLines = [];
    lines.forEach((line, idx) => {
        if (line.includes('Attendance.jsx')) {
            matchedLines.push({ lineNum: idx + 1, content: line.trim() });
        }
    });

    console.log(`Found ${matchedLines.length} matches:`);
    matchedLines.forEach(m => {
        console.log(`Line ${m.lineNum}: ${m.content}`);
    });
} else {
    console.log("search_internal_results.txt not found");
}
