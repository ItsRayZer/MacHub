const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function extract() {
    const transcriptPath = 'C:\\Users\\abens\\.gemini\\antigravity\\brain\\6104b00a-a7d5-4e79-b96a-72cb4cb181ea\\.system_generated\\logs\\transcript.jsonl';
    const fileStream = fs.createReadStream(transcriptPath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
        if (line.includes('"step_index":9524') || line.includes('"step_index": 9524')) {
            console.log("Found raw Step 9524!");
            const outPath = path.resolve(__dirname, 'step_9524_raw.txt');
            fs.writeFileSync(outPath, line);
            console.log(`Saved raw line of Step 9524 to ${outPath} (length: ${line.length})`);
            break;
        }
    }
}

extract();
