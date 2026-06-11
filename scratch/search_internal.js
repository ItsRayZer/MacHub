const fs = require('fs');
const readline = require('readline');

async function search() {
    const transcriptPath = 'C:\\Users\\abens\\.gemini\\antigravity\\brain\\6104b00a-a7d5-4e79-b96a-72cb4cb181ea\\.system_generated\\logs\\transcript.jsonl';
    const fileStream = fs.createReadStream(transcriptPath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    let output = '';

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
                    let targetFile = args.TargetFile || args.targetFile || '';
                    
                    let content = args.CodeContent || args.codeContent || args.ReplacementContent || args.replacementContent || '';
                    if (targetFile.includes('InternalMark.jsx') || targetFile.includes('ExamResult.jsx') || targetFile.includes('app.js')) {
                        output += `\n========================================\n`;
                        output += `STEP: ${entry.step_index} | TOOL: ${call.name} | FILE: ${targetFile}\n`;
                        output += `INSTRUCTION: ${args.Instruction || args.instruction || ''}\n`;
                        output += `CONTENT LENGTH: ${content.length}\n`;
                        if (content.length > 0) {
                            output += `--- START ---\n`;
                            output += content.substring(0, 1500) + '\n';
                            if (content.length > 1500) output += `... [TRUNCATED] ...\n`;
                            output += `--- END ---\n`;
                        }
                        
                        let chunks = args.ReplacementChunks || args.replacementChunks;
                        if (typeof chunks === 'string') {
                            try { chunks = JSON.parse(chunks); } catch(e) {}
                        }
                        if (Array.isArray(chunks)) {
                            output += `CHUNKS COUNT: ${chunks.length}\n`;
                            chunks.forEach((chunk, i) => {
                                output += `  Chunk ${i+1}: Target starts with: "${chunk.TargetContent.substring(0, 100)}"\n`;
                                output += `  Chunk ${i+1}: Replacement starts with: "${chunk.ReplacementContent.substring(0, 500)}"\n`;
                            });
                        }
                    }
                }
            }
        } catch (e) {
            // ignore
        }
    }
    fs.writeFileSync('scratch/search_internal_results.txt', output, 'utf8');
    console.log('Done writing search_internal_results.txt in UTF-8');
}
search().catch(console.error);
