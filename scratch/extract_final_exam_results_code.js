const fs = require('fs');
const readline = require('readline');
const path = require('path');

const targetSteps = [9099, 9630, 9634, 9910, 9912, 9914, 10077, 10079];

async function extract() {
    const transcriptPath = 'C:\\Users\\abens\\.gemini\\antigravity\\brain\\6104b00a-a7d5-4e79-b96a-72cb4cb181ea\\.system_generated\\logs\\transcript.jsonl';
    const fileStream = fs.createReadStream(transcriptPath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const entry = JSON.parse(line);
            if (targetSteps.includes(entry.step_index)) {
                console.log(`========================================`);
                console.log(`STEP: ${entry.step_index}`);
                if (entry.tool_calls) {
                    for (const call of entry.tool_calls) {
                        let args = call.args || call.arguments;
                        if (typeof args === 'string') {
                            try { args = JSON.parse(args); } catch(e) {}
                        }
                        console.log(`Tool: ${call.name}`);
                        console.log(`Instruction: ${args.Instruction || args.instruction}`);
                        
                        let targetContent = args.TargetContent || args.targetContent;
                        let replacementContent = args.ReplacementContent || args.replacementContent;
                        
                        if (targetContent) {
                            console.log(`TargetContent Length: ${targetContent.length}`);
                            console.log(`TargetContent (first 100): ${JSON.stringify(targetContent.substring(0, 100))}`);
                        }
                        if (replacementContent) {
                            console.log(`ReplacementContent Length: ${replacementContent.length}`);
                            // Write to scratch folder for full inspection
                            const filename = `step_${entry.step_index}_replacement.js`;
                            const outPath = path.resolve(__dirname, filename);
                            fs.writeFileSync(outPath, replacementContent);
                            console.log(`Saved replacement to ${outPath}`);
                        }
                    }
                }
                console.log(`========================================`);
            }
        } catch (e) {
            console.error('Error parsing line:', e);
        }
    }
}

extract();
