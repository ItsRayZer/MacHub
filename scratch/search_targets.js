const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function search() {
    const transcriptPath = 'C:\\Users\\abens\\.gemini\\antigravity\\brain\\6104b00a-a7d5-4e79-b96a-72cb4cb181ea\\.system_generated\\logs\\transcript.jsonl';
    const fileStream = fs.createReadStream(transcriptPath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    console.log("Searching transcript for file-modifying tools...");
    let toolCount = 0;
    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const entry = JSON.parse(line);
            if (entry.tool_calls) {
                for (const call of entry.tool_calls) {
                    if (['write_to_file', 'replace_file_content', 'multi_replace_file_content'].includes(call.name)) {
                        toolCount++;
                        let args = call.args || call.arguments;
                        if (typeof args === 'string') {
                            try { args = JSON.parse(args); } catch(e) {}
                        }
                        const target = args.TargetFile || args.targetFile || args.target;
                        console.log(`Step ${entry.step_index}: Tool=${call.name}, Target=${target}`);
                    }
                }
            }
        } catch (e) {
            // ignore
        }
    }
    console.log(`Total modifying tools found: ${toolCount}`);
}

search();
