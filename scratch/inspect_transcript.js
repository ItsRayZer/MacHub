const fs = require('fs');
const readline = require('readline');

async function inspect() {
    const transcriptPath = 'C:\\Users\\abens\\.gemini\\antigravity\\brain\\6104b00a-a7d5-4e79-b96a-72cb4cb181ea\\.system_generated\\logs\\transcript.jsonl';
    const fileStream = fs.createReadStream(transcriptPath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let count = 0;
    for await (const line of rl) {
        if (count >= 10) break;
        if (!line.trim()) continue;
        try {
            const entry = JSON.parse(line);
            console.log(`Step ${entry.step_index}, type: ${entry.type}, source: ${entry.source}`);
            if (entry.tool_calls) {
                console.log(`  Has tool_calls! Count: ${entry.tool_calls.length}`);
                console.log(`  Names: ${entry.tool_calls.map(c => c.name).join(', ')}`);
            } else {
                console.log(`  No tool_calls`);
            }
            count++;
        } catch (e) {
            console.log(`Error parsing line: ${e.message}`);
        }
    }
}

inspect();
