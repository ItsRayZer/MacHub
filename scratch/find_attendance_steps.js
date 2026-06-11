const fs = require('fs');
const readline = require('readline');

async function find() {
    const transcriptPath = 'C:\\Users\\abens\\.gemini\\antigravity\\brain\\6104b00a-a7d5-4e79-b96a-72cb4cb181ea\\.system_generated\\logs\\transcript.jsonl';
    const fileStream = fs.createReadStream(transcriptPath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    console.log("Searching for steps targeting Attendance.jsx...");
    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const entry = JSON.parse(line);
            if (entry.tool_calls) {
                for (const call of entry.tool_calls) {
                    if (['write_to_file', 'replace_file_content', 'multi_replace_file_content'].includes(call.name)) {
                        let args = call.args || call.arguments;
                        if (typeof args === 'string') {
                            try { args = JSON.parse(args); } catch(e) {}
                        }
                        const target = args.TargetFile || args.targetFile || args.target;
                        if (target && target.includes('Attendance.jsx')) {
                            let content = args.CodeContent || args.codeContent;
                            console.log(`Step ${entry.step_index}: Tool=${call.name}, Target=${target}, Content length=${content ? content.length : 'N/A'}`);
                        }
                    }
                }
            }
        } catch (e) {
            // ignore
        }
    }
}

find();
