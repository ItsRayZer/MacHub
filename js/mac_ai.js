// js/mac_ai.js - MacAI chatbot manager
(function () {
    window.openMacAI = function() {
        switchView('view-ai');
        const nav = document.getElementById('bottomNav');
        if (nav) nav.classList.add('nav-hidden');
        
        // Initialize welcome message if empty
        const msgContainer = document.getElementById('macAiMessages');
        if (msgContainer && msgContainer.children.length === 0) {
            appendMessage("assistant", "Hi there! I am **MacAI**, your college assistant. Ask me anything about your timetables, syllabi, subjects, teachers, exam seats, or general campus info! ✨");
        }
    };

    window.closeMacAI = function() {
        const nav = document.getElementById('bottomNav');
        if (nav) nav.classList.remove('nav-hidden');
        switchView('view-home');
    };

    window.handleAiInputKey = function(e) {
        if (e.key === 'Enter') {
            submitMacAiMessage();
        }
    };

    window.sendSuggestedMessage = function(text) {
        const input = document.getElementById('macAiInput');
        if (input) {
            input.value = text;
            submitMacAiMessage();
        }
    };

    window.submitMacAiMessage = function() {
        const input = document.getElementById('macAiInput');
        if (!input) return;
        
        const text = input.value.trim();
        if (!text) return;

        // Clear input
        input.value = '';

        // Append user message
        appendMessage("user", text);

        // Show typing indicator
        showTypingIndicator();

        // Generate response (simulate network delay)
        setTimeout(() => {
            removeTypingIndicator();
            const response = generateAiResponse(text);
            appendMessage("assistant", response);
        }, 800);
    };

    function appendMessage(sender, text) {
        const container = document.getElementById('macAiMessages');
        if (!container) return;

        const isUser = sender === 'user';
        const formattedText = parseMarkdown(text);

        const bubbleHtml = `
            <div class="max-w-[80%] rounded-[1.75rem] px-5 py-3 text-sm font-semibold leading-relaxed relative ${
                isUser 
                    ? 'bg-gradient-to-r from-[#0071e3] to-[#8622ff] text-white self-end rounded-tr-sm shadow-sm' 
                    : 'bg-black/5 dark:bg-white/5 text-[#1d1d1f] dark:text-[#f5f5f7] self-start rounded-tl-sm border border-white/5'
            }">
                <p class="whitespace-pre-line">${formattedText}</p>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', bubbleHtml);
        container.scrollTop = container.scrollHeight;
    }

    let typingIndicatorId = 'mac-ai-typing-indicator';

    function showTypingIndicator() {
        const container = document.getElementById('macAiMessages');
        if (!container) return;

        const indicatorHtml = `
            <div id="${typingIndicatorId}" class="max-w-[40%] bg-black/5 dark:bg-white/5 text-[#1d1d1f] dark:text-[#f5f5f7] rounded-[1.75rem] px-5 py-3.5 self-start rounded-tl-sm flex items-center gap-1 border border-white/5">
                <span class="w-1.5 h-1.5 bg-[#86868b] rounded-full animate-bounce"></span>
                <span class="w-1.5 h-1.5 bg-[#86868b] rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span class="w-1.5 h-1.5 bg-[#86868b] rounded-full animate-bounce [animation-delay:0.4s]"></span>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', indicatorHtml);
        container.scrollTop = container.scrollHeight;
    }

    function removeTypingIndicator() {
        const indicator = document.getElementById(typingIndicatorId);
        if (indicator) indicator.remove();
    }

    function parseMarkdown(text) {
        // Simple helper to parse bold text **bold**
        return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    }

    function generateAiResponse(query) {
        const q = query.toLowerCase();
        const info = getStudentInfo();
        const studentName = info ? (info.name || 'Student') : 'Student';
        const studentDept = info ? (info.dept || 'BCA').toUpperCase() : 'BCA';

        // 1. Timetable reasoning
        if (q.includes('timetable') || q.includes('class') || q.includes('period') || q.includes('schedule')) {
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
            let requestedDay = days.find(d => q.includes(d.toLowerCase()));
            if (!requestedDay) {
                // Default to current class day
                requestedDay = window.currentClassDay || 'Monday';
            }
            
            const timetableKey = `CLASS_TIMETABLE_${studentDept}`;
            const timetable = window[timetableKey] ? window[timetableKey][requestedDay] : null;

            if (timetable && timetable.length) {
                let reply = `Hi **${studentName}**! Here is your **${studentDept}** timetable for **${requestedDay}**:\n\n`;
                timetable.forEach(p => {
                    reply += `• **Period ${p.period}** (${p.time}): ${p.title} in **${p.room}**\n`;
                });
                return reply;
            } else {
                return `I couldn't find a regular timetable for **${studentDept}** on **${requestedDay}**.`;
            }
        }

        // 2. Syllabus / Course reasoning
        if (q.includes('syllabus') || q.includes('module') || q.includes('credit') || q.includes('subject') || q.includes('course')) {
            const subjectsKey = `CLASS_SUBJECTS_${studentDept}`;
            const subjects = window[subjectsKey] || [];
            
            // Check if user named a specific subject
            const match = subjects.find(s => q.includes(s.title.toLowerCase()) || q.includes(s.code.toLowerCase()) || q.includes('data structure') || q.includes('web') || q.includes('math') || q.includes('operating') || q.includes('constitution') || q.includes('marketing') || q.includes('behaviour') || q.includes('media') || q.includes('social work') || q.includes('mental health'));

            if (match) {
                let reply = `Here are the details for **${match.title}** (${match.code}):\n`;
                reply += `• **Type**: ${match.type}\n`;
                reply += `• **Credits**: ${match.credits}\n`;
                reply += `• **Faculty**: ${match.teacher.name} (${match.teacher.room})\n\n`;
                reply += `**Syllabus Modules**:\n`;
                match.syllabus.forEach(mod => {
                    reply += `• ${mod}\n`;
                });
                return reply;
            } else if (subjects.length) {
                let reply = `Here are the subjects for your **${studentDept}** course:\n\n`;
                subjects.forEach(s => {
                    reply += `• **${s.title}** (${s.code}) — ${s.credits} Credits\n`;
                });
                reply += `\nAsk me about a specific subject (e.g. "What is the syllabus of ${subjects[0].title}?") to see its modules!`;
                return reply;
            }
        }

        // 3. Faculty Directory reasoning
        if (q.includes('teacher') || q.includes('faculty') || q.includes('professor') || q.includes('instructor') || q.includes('lecturer')) {
            const subjectsKey = `CLASS_SUBJECTS_${studentDept}`;
            const subjects = window[subjectsKey] || [];
            
            const teacherMatch = subjects.find(s => q.includes(s.teacher.name.toLowerCase()) || q.includes('roy') || q.includes('anjana') || q.includes('thomas') || q.includes('sandeep') || q.includes('meera') || q.includes('rajesh') || q.includes('elizabeth') || q.includes('sreejith') || q.includes('joseph') || q.includes('deepa'));

            if (teacherMatch) {
                const t = teacherMatch.teacher;
                let reply = `**Faculty Profile**: **${t.name}**\n`;
                reply += `• **Designation**: ${t.designation}\n`;
                reply += `• **Course**: ${teacherMatch.title}\n`;
                reply += `• **Office Cabin**: ${t.room}\n`;
                reply += `• **Office Hours**: ${t.hours}\n`;
                reply += `• **Email**: ${t.email}\n`;
                return reply;
            } else if (subjects.length) {
                let reply = `Here is your assigned faculty directory for **${studentDept}**:\n\n`;
                subjects.forEach(s => {
                    reply += `• **${s.teacher.name}** — ${s.title} (${s.teacher.room})\n`;
                });
                reply += `\nAsk me about a specific teacher to find their office hours or cabin number!`;
                return reply;
            }
        }

        // 4. Exam Seating reasoning
        if (q.includes('seat') || q.includes('hall') || q.includes('exam seating') || q.includes('auditorium') || q.includes('where is my exam')) {
            if (info && info.reg) {
                const reg = info.reg.toLowerCase();
                if (window.ALL_DEPARTMENTS) {
                    const match = window.ALL_DEPARTMENTS.find(d => d[0].toLowerCase().includes(reg));
                    if (match) {
                        return `Hi **${studentName}**! I found your exam seating registration:\n\n• **Hall/Block**: ${match[1]}\n• **Room/Auditorium**: ${match[2]}\n• **Desk Section**: Row ${match[4]}, ${match[5]} Side\n• **Subject/Dept**: ${match[6]}\n\nLet me know if you need directions! 🏫`;
                    }
                }
                return `Hi **${studentName}**! I couldn't find an active exam seating mapping for your ID (**${info.reg}**). Seating charts might not be published yet.`;
            } else {
                return `To find your exact seat mapping, please complete your student onboarding or profile setup first with your Registration ID!`;
            }
        }

        // 5. College knowledge database lookup
        if (window.MAC_AI_FAQ) {
            const faqMatch = window.MAC_AI_FAQ.find(item => 
                item.keywords.some(word => q.includes(word))
            );
            if (faqMatch) {
                return faqMatch.answer;
            }
        }

        // Fallback friendly reply
        return `I'm not completely sure about that, **${studentName}**. \n\nYou can ask me about your **${studentDept} class timetable**, **subject syllabus modules**, **teacher cabins/emails**, **exam seating hall**, or general info like **library hours**! 🎓`;
    }
    
    function getStudentInfo() {
        if (window.ExamHubProfileApi) return window.ExamHubProfileApi.getStudentInfo();
        try {
            return JSON.parse(localStorage.getItem('mac_student_info'));
        } catch (error) {
            return null;
        }
    }
})();
