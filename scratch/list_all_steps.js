const fs = require('fs');
const readline = require('readline');

async function run() {
    const transcriptPath = 'C:\\Users\\abens\\.gemini\\antigravity\\brain\\6104b00a-a7d5-4e79-b96a-72cb4cb181ea\\.system_generated\\logs\\transcript.jsonl';
    const fileStream = fs.createReadStream(transcriptPath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const entry = JSON.parse(line);
            if (entry.tool_calls) {
                for (const call of entry.tool_calls) {
                    let args = call.args || call.arguments;
                    if (typeof args === 'string') {
                        try { args = JSON.parse(args); } catch(e) {}
                    }
                    if (!args) continue;
                    let target = args.TargetFile || args.targetFile;
                    if (!target) continue;
                    if (target.includes('app.js')) {
                        console.log(`Step: ${entry.step_index} | Tool: ${call.name} | Instruction: ${args.Instruction || args.instruction}`);
                    }
                }
            }
        } catch (e) {}
    }
}
run();
