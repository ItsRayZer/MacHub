const fs = require('fs');
const readline = require('readline');

async function extract() {
    const transcriptPath = 'C:\\Users\\abens\\.gemini\\antigravity\\brain\\6104b00a-a7d5-4e79-b96a-72cb4cb181ea\\.system_generated\\logs\\transcript.jsonl';
    const fileStream = fs.createReadStream(transcriptPath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const entry = JSON.parse(line);
            if (entry.step_index === 9524) {
                console.log("Found Step 9524. Saving details to step_9524_details.json...");
                const outPath = path.resolve(__dirname, 'step_9524_details.json');
                fs.writeFileSync(outPath, JSON.stringify(entry.tool_calls, null, 2));
            }
        } catch (e) {
            console.error(e);
        }
    }
}

extract();
