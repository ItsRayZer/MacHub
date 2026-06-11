const fs = require('fs');
const readline = require('readline');
const path = require('path');

const targetSteps = [10438, 10440, 10494, 10496, 10508];

async function extract() {
    const transcriptPath = 'C:\\Users\\abens\\.gemini\\antigravity\\brain\\6104b00a-a7d5-4e79-b96a-72cb4cb181ea\\.system_generated\\logs\\transcript.jsonl';
    const fileStream = fs.createReadStream(transcriptPath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const entry = JSON.parse(line);
            if (targetSteps.includes(entry.step_index)) {
                console.log(`Found Step ${entry.step_index}`);
                if (entry.tool_calls) {
                    for (const call of entry.tool_calls) {
                        let args = call.args || call.arguments;
                        if (typeof args === 'string') {
                            try { args = JSON.parse(args); } catch(e) {}
                        }
                        let target = args.TargetFile || args.targetFile;
                        if (target) {
                            target = target.replace(/"/g, '');
                        }
                        let content = args.CodeContent || args.codeContent;
                        if (typeof content === 'string') {
                            // Strip any outer quotes if it's double-encoded
                            if (content.startsWith('"') && content.endsWith('"')) {
                                try { content = JSON.parse(content); } catch(e) {}
                            } else {
                                try { content = JSON.parse(content); } catch(e){}
                            }
                        }
                        if (content) {
                            const filename = path.basename(target);
                            const outPath = path.resolve(__dirname, `step_${entry.step_index}_${filename}`);
                            fs.writeFileSync(outPath, content);
                            console.log(`  Saved content to ${outPath} (length: ${content.length})`);
                        } else {
                            console.log(`  No CodeContent in tool call`);
                        }
                    }
                }
            }
        } catch (e) {
            console.error(`Error parsing line:`, e);
        }
    }
}

extract();
