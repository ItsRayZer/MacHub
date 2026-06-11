const fs = require('fs');
const path = require('path');

const stepFiles = [
    'step_10438_InternalMark.jsx',
    'step_10440_ExamResult.jsx',
    'step_10494_usePortalData.js',
    'step_10496_Attendance.jsx',
    'step_10508_Login.jsx'
].map(f => path.resolve(__dirname, f));

for (const file of stepFiles) {
    if (!fs.existsSync(file)) {
        console.log(`File does not exist: ${file}`);
        continue;
    }
    let content = fs.readFileSync(file, 'utf8');
    console.log(`Original file: ${path.basename(file)}, length: ${content.length}`);
    
    // Check if it starts with quote and needs parsing
    if (content.startsWith('"') || content.startsWith("'")) {
        try {
            content = JSON.parse(content);
            console.log(`  Parsed JSON. New length: ${content.length}`);
        } catch (e) {
            // Try manually unescaping if JSON.parse fails
            try {
                content = eval(content);
                console.log(`  Eval'd content. New length: ${content.length}`);
            } catch (e2) {
                console.log(`  Failed to parse content: ${e.message}`);
            }
        }
    }
    
    // Write out the cleaned file
    const cleanPath = file.replace('step_', 'clean_');
    fs.writeFileSync(cleanPath, content, 'utf8');
    console.log(`  Wrote cleaned file to ${cleanPath}`);
}
