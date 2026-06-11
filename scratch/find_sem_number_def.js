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
            if (line.includes('getStudentSemNumber')) {
                console.log(`Step: ${entry.step_index}`);
                if (entry.tool_calls) {
                    for (const call of entry.tool_calls) {
                        let args = call.args || call.arguments;
                        if (typeof args === 'string') {
                            try { args = JSON.parse(args); } catch(e) {}
                        }
                        if (args && args.ReplacementContent) {
                            const idx = args.ReplacementContent.indexOf('getStudentSemNumber');
                            if (idx !== -1) {
                                console.log(`Found definition in replacement chunk:`);
                                console.log(args.ReplacementContent.substring(Math.max(0, idx - 200), idx + 200));
                            }
                        }
                    }
                }
            }
        } catch (e) {}
    }
}
run();
