const fs = require('fs');
const path = require('path');

const files = [
    'unescaped_InternalMark.jsx',
    'unescaped_ExamResult.jsx',
    'unescaped_usePortalData.js',
    'unescaped_Attendance.jsx',
    'unescaped_Login.jsx'
].map(f => path.resolve(__dirname, f));

for (const file of files) {
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        console.log(`File: ${path.basename(file)}, length: ${content.length}, lines: ${lines.length}`);
    } else {
        console.log(`Not found: ${file}`);
    }
}
