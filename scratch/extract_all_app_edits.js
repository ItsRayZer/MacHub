const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function extract() {
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
                    target = target.replace(/"/g, '');

                    if (target.endsWith('js/app.js') || target.endsWith('js\\app.js')) {
                        console.log(`STEP: ${entry.step_index} | TOOL: ${call.name}`);
                        let instruction = args.Instruction || args.instruction;
                        console.log(`INSTRUCTION: ${instruction}`);
                        
                        let targetContent = args.TargetContent || args.targetContent;
                        let replacementContent = args.ReplacementContent || args.replacementContent;
                        
                        if (targetContent) {
                            console.log(`TARGET CONTENT (first 100): ${JSON.stringify(targetContent.substring(0, 100))}`);
                        }
                        if (replacementContent) {
                            console.log(`REPLACEMENT CONTENT LENGTH: ${replacementContent.length}`);
                            const outPath = path.resolve(__dirname, `step_${entry.step_index}_replacement.js`);
                            fs.writeFileSync(outPath, replacementContent);
                            console.log(`  Saved replacement to ${outPath}`);
                        }
                        console.log('----------------------------------------');
                    }
                }
            }
        } catch (e) {
            // ignore
        }
    }
}

extract();
