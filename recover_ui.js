const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function recover() {
    const transcriptPath = 'C:\\Users\\abens\\.gemini\\antigravity\\brain\\6104b00a-a7d5-4e79-b96a-72cb4cb181ea\\.system_generated\\logs\\transcript.jsonl';
    
    const targetFiles = [
        'machub-app/src/pages/InternalMark.jsx',
        'machub-app/src/pages/ExamResult.jsx',
        'machub-app/src/hooks/usePortalData.js',
        'js/app.js'
    ].map(p => path.resolve(p));

    // Initialize memory with current (base) state
    const memory = {};
    for (const file of targetFiles) {
        if (fs.existsSync(file)) {
            memory[file] = fs.readFileSync(file, 'utf8');
        } else {
            memory[file] = '';
        }
    }

    const fileStream = fs.createReadStream(transcriptPath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const entry = JSON.parse(line);
            if (entry.tool_calls) {
                for (const call of entry.tool_calls) {
                    if (!call.args && !call.arguments) continue;
                    let args = call.args || call.arguments;
                    if (typeof args === 'string') {
                        try { args = JSON.parse(args); } catch(e) {}
                    }
                    if (typeof args !== 'object') continue;
                    
                    let targetFile = args.TargetFile || args.targetFile;
                    if (typeof targetFile === 'string') {
                        try { targetFile = JSON.parse(targetFile); } catch(e){}
                    }
                    if (!targetFile) continue;
                    
                    // Normalize path and check if it's one of our targets
                    const resolvedTarget = path.resolve(targetFile);
                    if (!targetFiles.includes(resolvedTarget)) continue;

                    if (call.name === 'write_to_file') {
                        let content = args.CodeContent || args.codeContent;
                        if (typeof content === 'string') {
                            try { content = JSON.parse(content); } catch(e){}
                        }
                        memory[resolvedTarget] = content;
                        console.log('Overwrote', resolvedTarget, 'with length', content.length);
                    } else if (call.name === 'replace_file_content') {
                        let targetContent = args.TargetContent || args.targetContent;
                        let replacementContent = args.ReplacementContent || args.replacementContent;
                        if (typeof targetContent === 'string') try { targetContent = JSON.parse(targetContent); } catch(e){}
                        if (typeof replacementContent === 'string') try { replacementContent = JSON.parse(replacementContent); } catch(e){}
                        
                        if (memory[resolvedTarget].includes(targetContent)) {
                            memory[resolvedTarget] = memory[resolvedTarget].replace(targetContent, replacementContent);
                            console.log('Replaced chunk in', resolvedTarget);
                        } else {
                            console.log('Failed to find chunk in', resolvedTarget);
                        }
                    } else if (call.name === 'multi_replace_file_content') {
                        let chunks = args.ReplacementChunks || args.replacementChunks;
                        if (typeof chunks === 'string') try { chunks = JSON.parse(chunks); } catch(e){}
                        
                        if (Array.isArray(chunks)) {
                            for (const chunk of chunks) {
                                if (memory[resolvedTarget].includes(chunk.TargetContent)) {
                                    memory[resolvedTarget] = memory[resolvedTarget].replace(chunk.TargetContent, chunk.ReplacementContent);
                                    console.log('Multi-replaced chunk in', resolvedTarget);
                                } else {
                                    console.log('Failed to find chunk in', resolvedTarget, 'Chunk starts with:', chunk.TargetContent.substring(0, 30));
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            // ignore
        }
    }

    for (const file of targetFiles) {
        fs.writeFileSync(file + '.recovered', memory[file]);
        console.log('Wrote recovered file to', file + '.recovered');
    }
}

recover().catch(console.error);
