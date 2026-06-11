const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function check() {
    const transcriptPath = 'C:\\Users\\abens\\.gemini\\antigravity\\brain\\6104b00a-a7d5-4e79-b96a-72cb4cb181ea\\.system_generated\\logs\\transcript.jsonl';
    const fileStream = fs.createReadStream(transcriptPath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let count = 0;
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
                    if (typeof args !== 'object' || !args) continue;
                    let targetFile = args.TargetFile || args.targetFile;
                    if (!targetFile) continue;
                    
                    let content = args.CodeContent || args.codeContent || args.ReplacementContent || args.replacementContent || '';
                    if (typeof content === 'string') {
                        const isTruncated = content.includes('<truncated') || content.includes('truncated');
                        console.log(`Tool: ${call.name}, File: ${targetFile}, Length: ${content.length}, IsTruncated: ${isTruncated}`);
                    }
                }
            }
        } catch (e) {
            // ignore
        }
    }
}
check().catch(console.error);
