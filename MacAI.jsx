import React, { useState, useEffect, useRef } from 'react';

// =========================================================================
// MacAI.jsx - Standalone 1:1 Rebrand of DareToWin for MacHub
// =========================================================================

export default function MacAI({ onBack }) {
  // ── State Management & Storage ──
  const [tab, setTab] = useState('home');
  const [data, setData] = useState(() => {
    const saved = localStorage.getItem('macai_app_data');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      streak: 5,
      auraPoints: 750,
      grade: 'B+',
      displayName: 'Elite Student',
      username: 'elite_student',
      studyHours: 24,
      workoutsCompleted: 12,
      booksRead: 4,
      dailyLog: {},
      workoutLog: {},
      previousChats: [],
      activeChatId: null,
      lookmax: {
        onboarded: true,
        skinType: 'Combination',
        skinConcerns: ['Acne', 'Dark spots'],
        hairType: 'Wavy',
        hairConcerns: ['Frizz'],
        shelf: {
          skincare: ['COSRX Cleanser', 'The Ordinary Niacinamide', 'Cerave Moisturizer', 'La Roche-Posay SPF 50+'],
          haircare: ['Nizoral Shampoo', 'Streax Hair Serum', 'Coconut Oil']
        },
        routine: {
          morning: [
            { id: 'm1', title: 'Cleanser', desc: 'COSRX face wash with cold water', done: false },
            { id: 'm2', title: 'Ice Massage', desc: 'Glide ice cube 1-2 min', done: false },
            { id: 'm3', title: 'Moisturizer', desc: 'Cerave lightweight lotion', done: false },
            { id: 'm4', title: 'Sunscreen', desc: 'La Roche-Posay SPF 50+', done: false }
          ],
          night: [
            { id: 'n1', title: 'Cleanser', desc: 'Standard wash', done: false },
            { id: 'n2', title: 'Niacinamide', desc: 'The Ordinary serum', done: false },
            { id: 'n3', title: 'Moisturizer', desc: 'Cerave lock-in cream', done: false }
          ]
        }
      },
      coach: {
        onboarded: true,
        goal: 'Muscle Gain',
        location: 'Gym',
        currentPlan: [
          { id: 'ex1', name: 'Incline Dumbbell Press', sets: 4, reps: 10, done: false },
          { id: 'ex2', name: 'Lat Pulldowns', sets: 4, reps: 12, done: false },
          { id: 'ex3', name: 'Dumbbell Shoulder Press', sets: 3, reps: 10, done: false },
          { id: 'ex4', name: 'Barbell Squats', sets: 3, reps: 12, done: false },
          { id: 'ex5', name: 'Hammer Curls', sets: 3, reps: 12, done: false }
        ]
      },
      mind: {
        onboarded: true,
        examDate: '2026-06-15',
        subjects: [
          { id: 1, name: 'Web Technology', priority: 'high', progress: 65 },
          { id: 2, name: 'Data Structures', priority: 'high', progress: 45 },
          { id: 3, name: 'Discrete Mathematics', priority: 'medium', progress: 75 },
          { id: 4, name: 'Operating Systems', priority: 'medium', progress: 50 },
          { id: 5, name: 'Professional Ethics', priority: 'low', progress: 90 }
        ],
        books: [
          { id: 1, title: 'Atomic Habits', author: 'James Clear', status: 'finished' },
          { id: 2, title: 'Can\'t Hurt Me', author: 'David Goggins', status: 'reading' },
          { id: 3, title: 'Deep Work', author: 'Cal Newport', status: 'want' }
        ],
        moodLogs: [
          { date: 'May 24', score: 8, note: 'Highly focused study day' },
          { date: 'May 25', score: 7, note: 'Completed legs workout session' }
        ]
      },
      hustle: {
        projects: [
          { id: 1, name: 'SaaS Dashboard Platform', progress: 80, done: false },
          { id: 2, name: 'E-commerce Automation Script', progress: 45, done: false },
          { id: 3, name: 'Chrome Developer Extension', progress: 100, done: true }
        ],
        milestones: [
          { id: 1, text: 'Reach 100 active premium users', done: false },
          { id: 2, text: 'Optimize backend queries to <50ms', done: true }
        ]
      }
    };
  });

  // ── Persistent Chat History States ──
  const [chatHistoryList, setChatHistoryList] = useState(() => {
    const saved = localStorage.getItem('macai_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentChatId, setCurrentChatId] = useState(null);
  const [activeChat, setActiveChat] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [activeTag, setActiveTag] = useState(null);
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  // References
  const chatBottomRef = useRef(null);
  const plusMenuRef = useRef(null);

  // Sync state to localStorage
  useEffect(() => {
    localStorage.setItem('macai_app_data', JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    localStorage.setItem('macai_history', JSON.stringify(chatHistoryList));
  }, [chatHistoryList]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeChat, isTyping]);

  // Click outside plus menu
  useEffect(() => {
    function handleClickOutside(e) {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target) && !e.target.closest('#aiPlusBtn')) {
        setShowPlusMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Chat Actions ──
  const handleSend = () => {
    const text = chatInput.trim();
    if (!text) return;

    const userMsg = {
      id: `msg-${Date.now()}`,
      role: 'user',
      text: activeTag ? `[TAG: ${activeTag}] ${text}` : text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const nextChat = [...activeChat, userMsg];
    setActiveChat(nextChat);
    setChatInput('');
    setIsTyping(true);

    // Save/update this active chat in the history list immediately
    updateChatHistoryList(nextChat);

    // AI thinking delay
    const delay = isThinking ? 2200 : 800;
    setTimeout(() => {
      setIsTyping(false);
      const assistantMsg = {
        id: `msg-ai-${Date.now()}`,
        role: 'assistant',
        text: generateLocalAiResponse(text, activeTag),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      const finalChat = [...nextChat, assistantMsg];
      setActiveChat(finalChat);
      updateChatHistoryList(finalChat);
    }, delay);
  };

  const updateChatHistoryList = (messages) => {
    let chatId = currentChatId;
    if (!chatId) {
      chatId = `chat-${Date.now()}`;
      setCurrentChatId(chatId);
    }

    setChatHistoryList(prev => {
      const existingIdx = prev.findIndex(c => c.id === chatId);
      const firstMsgPreview = messages[0]?.text || 'Empty Chat';
      const activeMode = activeTag || 'Default';

      const entry = {
        id: chatId,
        timestamp: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        preview: firstMsgPreview.length > 45 ? firstMsgPreview.slice(0, 45) + '...' : firstMsgPreview,
        mode: activeMode,
        messages: messages
      };

      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = entry;
        return next;
      } else {
        return [entry, ...prev];
      }
    });
  };

  const handleNewChat = () => {
    setActiveChat([]);
    setCurrentChatId(null);
    setActiveTag(null);
    setShowHistoryDrawer(false);
  };

  const handleLoadChat = (chatEntry) => {
    setCurrentChatId(chatEntry.id);
    setActiveChat(chatEntry.messages);
    setActiveTag(chatEntry.mode === 'Default' ? null : chatEntry.mode);
    setShowHistoryDrawer(false);
  };

  const handleDeleteChat = (e, chatId) => {
    e.stopPropagation();
    setChatHistoryList(prev => prev.filter(c => c.id !== chatId));
    if (currentChatId === chatId) {
      setActiveChat([]);
      setCurrentChatId(null);
    }
  };

  const handleClearAllHistory = () => {
    setChatHistoryList([]);
    setActiveChat([]);
    setCurrentChatId(null);
    setShowConfirmClear(false);
    setShowHistoryDrawer(false);
  };

  const handleSuggestedPrompt = (promptText, tag = null) => {
    if (tag) setActiveTag(tag);
    setChatInput(promptText);
  };

  // ── Voice Dictation Mock ──
  const handleVoiceToggle = () => {
    if (!isListening) {
      setIsListening(true);
      setChatInput('Listening...');
      setTimeout(() => {
        const voiceInputs = [
          "Where is my exam seating hall today?",
          "What is my Web Technology syllabus?",
          "How many hours should I study today?",
          "Show me my current study roadmap"
        ];
        const randomInput = voiceInputs[Math.floor(randomInput => voiceInputs.length)];
        setChatInput(randomInput);
        setIsListening(false);
      }, 2000);
    } else {
      setIsListening(false);
      setChatInput('');
    }
  };

  // ── Custom Mock AI Reasoning Engine ──
  const generateLocalAiResponse = (query, tag) => {
    const q = query.toLowerCase();
    
    if (tag === 'Deep Research' || q.includes('research') || q.includes('deep')) {
      return `💭 [DEEP RESEARCH SWARM INITIALIZED]\nScanning academic databases and validated local schemas...\n\nHere is your deep-dive insights:\n- For your current semester course, focusing on **${data.mind.subjects[0]?.name || 'Web Technology'}** will yield the highest performance return.\n- Recommended approach: Allocate **2.5 hours** of focused study using the Pomodoro technique to master the syllabus topics.\n- Verify seat configurations in Hall 1 / auditorium maps before morning slots.`;
    }

    if (tag === 'Syllabus Swarm' || q.includes('syllabus') || q.includes('module')) {
      return `📚 [SYLLABUS SWARM INTEL ACTIVATED]\nExtracted targets from course databases:\n\n• **Web Technology (WT-301)**:\n  - Module 1: HTML5 Semantics & Tailwind Core layouts\n  - Module 2: React Component states, hooks, and CDN compilation\n  - Module 3: Storage APIs & offline client states (localStorage/Service Workers)\n\n• **Data Structures (DS-302)**:\n  - Module 1: Stack & Queue arrays\n  - Module 2: Non-linear Graphs & Tree traversal logic\n\nLet me know which topic you want me to generate high-yield revision flashcards for!`;
    }

    if (tag === 'Exam Coach' || q.includes('coach') || q.includes('streak') || q.includes('workout')) {
      return `🔥 [EXAM COACH - HARD TRUTH STREAM]\nNo excuses, Elite. Here is your reality check:\n\n- Your active streak is at **${data.streak} days**. Let's keep it that way.\n- Active study subjects: **${data.mind.subjects.length} modules**. Ensure you check off at least 2 key concepts today.\n- Fitness targets: Gym plan loaded with **${data.coach.currentPlan.length} exercises**. Lift heavy, hit your protein goal, and log your sleep. No slacking!`;
    }

    // Default general queries
    if (q.includes('exam') || q.includes('date') || q.includes('countdown')) {
      return `📅 Your biggest exam is currently set for **${data.mind.examDate || 'June 15, 2026'}**.\nThat gives you exactly **${data.mind.examDate ? Math.max(0, Math.ceil((new Date(data.mind.examDate) - Date.now()) / (1000 * 60 * 60 * 24))) : '—'} days** to complete all target revision modules. Keep pushing!`;
    }

    if (q.includes('seat') || q.includes('hall') || q.includes('seating') || q.includes('where')) {
      return `🪑 [SEAT LOCATOR AGENT]\nSearching linked student rolls...\n\n- Hi, **${data.displayName}**!\n- Hall/Block: **Hall 1**\n- Desk Position: **Row 4, Right Side**\n- Status: Verified and Synced with MacHub.`;
    }

    if (q.includes('help') || q.includes('features')) {
      return `🤖 Welcome to **MacAI Swarm**! I am your premium AI workspace, ported directly from your personalized DareToWin system.\n\nYou can prompt me about:\n1. Your **academic timetable** or WT/DS **syllabus modules**.\n2. Finding your **exam seating arrangements** instantly.\n3. Custom revision roadmaps or daily study schedules.\n4. Fitness goals or custom bathroom product shelf updates.\n\nUse the **+ Plus Menu** to lock in specialized multi-agent tags!`;
    }

    return `🤖 [MACAI SWARM AGENT]\nProcessed your input: "${query}"\n\nI recommend utilizing specialized multi-agent tags (like **Syllabus Swarm** or **Deep Research** via the Plus icon) to receive high-yield, structured information regarding your college metrics. Keep striving for success!`;
  };

  // ── Core Setters ──
  const toggleSkincareStep = (id) => {
    setData(prev => {
      const routine = { ...prev.lookmax.routine };
      routine.morning = routine.morning.map(s => s.id === id ? { ...s, done: !s.done } : s);
      routine.night = routine.night.map(s => s.id === id ? { ...s, done: !s.done } : s);
      return { ...prev, lookmax: { ...prev.lookmax, routine } };
    });
  };

  const toggleWorkoutStep = (id) => {
    setData(prev => {
      const plan = prev.coach.currentPlan.map(ex => ex.id === id ? { ...ex, done: !ex.done } : ex);
      return { ...prev, coach: { ...prev.coach, currentPlan: plan } };
    });
  };

  const updateSubjectProgress = (id, progress) => {
    setData(prev => ({
      ...prev,
      mind: {
        ...prev.mind,
        subjects: prev.mind.subjects.map(s => s.id === id ? { ...s, progress } : s)
      }
    }));
  };

  const updateSubjectPriority = (id, priority) => {
    setData(prev => ({
      ...prev,
      mind: {
        ...prev.mind,
        subjects: prev.mind.subjects.map(s => s.id === id ? { ...s, priority } : s)
      }
    }));
  };

  const toggleProjectStep = (id) => {
    setData(prev => ({
      ...prev,
      hustle: {
        ...prev.hustle,
        projects: prev.hustle.projects.map(p => p.id === id ? { ...p, done: !p.done, progress: !p.done ? 100 : 0 } : p)
      }
    }));
  };

  const toggleMilestoneStep = (id) => {
    setData(prev => ({
      ...prev,
      hustle: {
        ...prev.hustle,
        milestones: prev.hustle.milestones.map(m => m.id === id ? { ...m, done: !m.done } : m)
      }
    }));
  };

  return (
    <div className="mac-ai-wrapper">
      {/* ── CSS STYLESHEET EMBED ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* Root Design variables */
        .mac-ai-wrapper {
          --bg-black: #000000;
          --bg-zinc-card: rgba(13, 13, 13, 0.85);
          --accent-purple: #8622ff;
          --accent-blue: #0071e3;
          --accent-green: #30d158;
          --accent-red: #ff3b30;
          --accent-gold: #ffd700;
          --text-primary: #ffffff;
          --text-secondary: #a3a3a3;
          --text-muted: #666666;
          --glass-border: rgba(255, 255, 255, 0.08);
          --glass-glow: rgba(134, 34, 255, 0.15);
          
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background-color: var(--bg-black);
          color: var(--text-primary);
          width: 100%;
          min-height: 100vh;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* Glassmorphism styling */
        .mac-ai-glass-panel {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(25px) saturate(180%);
          -webkit-backdrop-filter: blur(25px) saturate(180%);
          border: 1px solid var(--glass-border);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        /* Header block */
        .mac-ai-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--glass-border);
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          flex-shrink: 0;
        }

        .mac-ai-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .mac-ai-back-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          color: var(--text-primary);
          padding: 8px 14px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .mac-ai-back-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateX(-2px);
        }

        .mac-ai-title {
          font-size: 20px;
          font-weight: 900;
          letter-spacing: -0.03em;
          background: linear-gradient(180deg, #FFFFFF 0%, #A3A3A3 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        /* Core Body Container */
        .mac-ai-viewport {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          padding-bottom: 100px;
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          box-sizing: border-box;
        }

        .mac-ai-content-box {
          width: 100%;
          max-width: 500px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* Main Chat view */
        .mac-ai-chat-messages {
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding-bottom: 20px;
          overflow-y: visible;
        }

        .mac-ai-msg-bubble {
          max-width: 80%;
          padding: 12px 18px;
          border-radius: 22px;
          font-size: 14px;
          line-height: 1.5;
          font-weight: 500;
          position: relative;
          word-wrap: break-word;
          box-sizing: border-box;
          animation: msg-pop-up 0.3s cubic-bezier(0.25, 1, 0.5, 1);
        }

        @keyframes msg-pop-up {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .mac-ai-msg-bubble.user {
          align-self: flex-end;
          background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
          color: #ffffff;
          border-bottom-right-radius: 4px;
          box-shadow: 0 4px 15px rgba(134, 34, 255, 0.2);
        }

        .mac-ai-msg-bubble.assistant {
          align-self: flex-start;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          color: #f5f5f7;
          border-bottom-left-radius: 4px;
        }

        .mac-ai-timestamp {
          font-size: 9px;
          color: var(--text-muted);
          margin-top: 4px;
          text-align: right;
          display: block;
        }

        /* Suggestions cards */
        .mac-ai-suggestions-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 10px;
        }

        .mac-ai-suggestion-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: 18px;
          padding: 12px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        }

        .mac-ai-suggestion-card:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: var(--accent-purple);
          transform: translateY(-2px);
        }

        .mac-ai-suggestion-icon {
          font-size: 20px;
          margin-bottom: 6px;
          display: block;
        }

        .mac-ai-suggestion-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-primary);
          display: block;
        }

        .mac-ai-suggestion-desc {
          font-size: 9px;
          color: var(--text-secondary);
          margin-top: 4px;
          display: block;
        }

        /* Input pill dock */
        .mac-ai-input-dock {
          position: fixed;
          bottom: 84px;
          left: 50%;
          transform: translateX(-50%);
          width: 90%;
          max-width: 460px;
          z-index: 100;
        }

        .mac-ai-pill-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 30px;
          background: rgba(15, 15, 15, 0.9);
          border: 1px solid var(--glass-border);
          backdrop-filter: blur(30px);
          -webkit-backdrop-filter: blur(30px);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
        }

        .mac-ai-circle-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          color: #fff;
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .mac-ai-circle-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .mac-ai-input-field {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: #fff;
          font-size: 13px;
          padding: 6px 0;
          font-weight: 600;
        }

        .mac-ai-input-field::placeholder {
          color: var(--text-muted);
        }

        .mac-ai-input-actions {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }

        .mac-ai-send-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #ffffff;
          border: none;
          color: #000;
          display: grid;
          place-items: center;
          font-weight: 900;
          cursor: pointer;
          transition: transform 0.2s ease;
          flex-shrink: 0;
        }

        .mac-ai-send-btn:hover {
          transform: scale(1.05);
        }

        .mac-ai-send-btn:active {
          transform: scale(0.95);
        }

        /* Active tag row */
        .mac-ai-active-tag-row {
          display: flex;
          gap: 6px;
          margin-bottom: 6px;
          padding-left: 8px;
        }

        .mac-ai-active-tag {
          font-size: 10px;
          font-weight: 800;
          background: rgba(134, 34, 255, 0.15);
          border: 1px solid rgba(134, 34, 255, 0.3);
          color: #ba8cff;
          padding: 4px 10px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .mac-ai-active-tag-close {
          border: none;
          background: transparent;
          color: #ba8cff;
          font-weight: 900;
          cursor: pointer;
          font-size: 11px;
        }

        /* ── Plus Menu Card ── */
        .mac-ai-plus-menu {
          position: absolute;
          bottom: 64px;
          left: 12px;
          width: 250px;
          background: rgba(15, 15, 18, 0.96);
          border: 1px solid var(--glass-border);
          border-radius: 24px;
          padding: 8px;
          box-shadow: 0 15px 40px rgba(0, 0, 0, 0.7);
          display: flex;
          flex-direction: column;
          gap: 4px;
          z-index: 200;
        }

        .mac-ai-plus-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 16px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .mac-ai-plus-item:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .mac-ai-plus-icon {
          font-size: 18px;
        }

        .mac-ai-plus-text {
          font-size: 12px;
          font-weight: 700;
          color: #fff;
        }

        .mac-ai-plus-desc {
          font-size: 9px;
          color: var(--text-secondary);
          margin-top: 1px;
        }

        /* ── 3D Perspective Modes Selectors (Original DareToWin Style) ── */
        .mac-ai-modes-perspective {
          perspective: 1000px;
          display: flex;
          justify-content: center;
          gap: 14px;
          width: 100%;
          margin: 20px 0;
        }

        .mac-ai-mode-card {
          width: 120px;
          height: 150px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          cursor: pointer;
          transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
          transform: rotateY(0deg) translateZ(0px);
        }

        .mac-ai-mode-card:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: var(--accent-purple);
          transform: rotateY(5deg) scale(1.05) translateZ(10px);
          box-shadow: 0 10px 25px rgba(134, 34, 255, 0.15);
        }

        .mac-ai-mode-card.left { transform: rotateY(15deg); }
        .mac-ai-mode-card.right { transform: rotateY(-15deg); }

        .mac-ai-mode-icon {
          font-size: 32px;
        }

        .mac-ai-mode-label {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.05em;
          color: #fff;
          text-transform: uppercase;
        }

        /* ── Lookmax Section ── */
        .lookmax-routine-card {
          padding: 20px;
          border-radius: 28px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
        }

        .lookmax-calendar {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 14px;
        }

        .lookmax-day-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--glass-border);
          border-radius: 16px;
        }

        .lookmax-day-lbl {
          font-size: 13px;
          font-weight: 700;
          color: #fff;
        }

        .lookmax-day-val {
          font-size: 12px;
          color: var(--text-secondary);
        }

        .lookmax-checkbox-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 12px;
        }

        .lookmax-check-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          cursor: pointer;
          transition: all 0.2s;
        }

        .lookmax-check-row.done {
          border-color: rgba(48, 209, 88, 0.3);
          background: rgba(48, 209, 88, 0.05);
        }

        .lookmax-check-box {
          width: 18px;
          height: 18px;
          border-radius: 6px;
          border: 2px solid var(--text-muted);
          display: grid;
          place-items: center;
          font-size: 12px;
          font-weight: bold;
        }

        .lookmax-check-row.done .lookmax-check-box {
          border-color: var(--accent-green);
          background: var(--accent-green);
          color: #fff;
        }

        /* ── Body Screen ── */
        .body-stat-card {
          padding: 20px;
          border-radius: 28px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--glass-border);
        }

        .body-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 14px;
        }

        .body-mini-box {
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--glass-border);
          padding: 14px;
          border-radius: 18px;
          text-align: center;
        }

        .body-mini-val {
          font-size: 20px;
          font-weight: 800;
          color: var(--accent-blue);
        }

        .body-mini-lbl {
          font-size: 10px;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        /* ── Mind Section ── */
        .mind-subject-card {
          padding: 16px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .mind-progress-track {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 4px;
        }

        .mind-bar-shell {
          flex: 1;
          height: 6px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 3px;
          overflow: hidden;
        }

        .mind-bar-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.8s cubic-bezier(0.2, 0, 0, 1);
        }

        /* ── Profile Section ── */
        .profile-core-card {
          padding: 24px;
          border-radius: 30px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--glass-border);
          text-align: center;
          position: relative;
        }

        .profile-badge-icon {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02));
          border: 1px solid var(--glass-border);
          display: grid;
          place-items: center;
          font-size: 32px;
          margin: 0 auto 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }

        .profile-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 20px;
        }

        .profile-stat-box {
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--glass-border);
          padding: 12px;
          border-radius: 16px;
        }

        .profile-stat-val {
          font-size: 22px;
          font-weight: 900;
        }

        .profile-stat-lbl {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        /* ── Sliding History Drawer Panel ── */
        .mac-ai-history-drawer {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 300px;
          background: rgba(10, 10, 12, 0.95);
          border-left: 1px solid var(--glass-border);
          backdrop-filter: blur(30px);
          -webkit-backdrop-filter: blur(30px);
          z-index: 10000;
          box-shadow: -10px 0 40px rgba(0, 0, 0, 0.8);
          display: flex;
          flex-direction: column;
          transform: translateX(100%);
          transition: transform 0.3s cubic-bezier(0.25, 1, 0.5, 1);
        }

        .mac-ai-history-drawer.open {
          transform: translateX(0);
        }

        .mac-ai-drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px;
          border-bottom: 1px solid var(--glass-border);
        }

        .mac-ai-drawer-title {
          font-size: 16px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.02em;
        }

        .mac-ai-drawer-close {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-size: 18px;
          cursor: pointer;
        }

        .mac-ai-drawer-content {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .mac-ai-history-item {
          padding: 12px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .mac-ai-history-item:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(134, 34, 255, 0.3);
        }

        .mac-ai-history-item-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .mac-ai-history-time {
          font-size: 9px;
          color: var(--text-muted);
          font-weight: 600;
        }

        .mac-ai-history-mode {
          font-size: 8px;
          font-weight: 800;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--glass-border);
          padding: 2px 6px;
          border-radius: 8px;
          color: var(--text-secondary);
        }

        .mac-ai-history-preview {
          font-size: 11px;
          color: var(--text-secondary);
          font-weight: 500;
          line-height: 1.3;
        }

        .mac-ai-history-delete-btn {
          border: none;
          background: transparent;
          color: var(--accent-red);
          cursor: pointer;
          font-size: 12px;
          padding: 0 4px;
        }

        .mac-ai-drawer-footer {
          padding: 16px;
          border-top: 1px solid var(--glass-border);
        }

        .mac-ai-clear-btn {
          width: 100%;
          background: rgba(255, 59, 48, 0.1);
          border: 1px solid rgba(255, 59, 48, 0.2);
          color: var(--accent-red);
          padding: 12px;
          border-radius: 16px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }

        .mac-ai-clear-btn:hover {
          background: rgba(255, 59, 48, 0.15);
        }

        /* ── Floating Navigation Pill ── */
        .mac-ai-nav-pill-dock {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          width: 90%;
          max-width: 440px;
          background: rgba(13, 13, 15, 0.85);
          backdrop-filter: blur(35px) saturate(210%);
          -webkit-backdrop-filter: blur(35px) saturate(210%);
          border: 1px solid var(--glass-border);
          border-radius: 36px;
          padding: 6px;
          box-shadow: 0 15px 40px rgba(0,0,0,0.6);
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 999;
        }

        .mac-ai-nav-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          padding: 8px 0;
          cursor: pointer;
          border-radius: 30px;
          transition: all 0.25s ease;
        }

        .mac-ai-nav-item.active {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.02);
        }

        .mac-ai-nav-icon {
          font-size: 18px;
        }

        .mac-ai-nav-label {
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* Confirm Popup */
        .mac-ai-popup-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(5px);
          display: grid;
          place-items: center;
          z-index: 10001;
        }

        .mac-ai-popup-card {
          background: #111113;
          border: 1px solid var(--glass-border);
          padding: 24px;
          border-radius: 28px;
          width: 80%;
          max-width: 320px;
          text-align: center;
          box-shadow: 0 20px 50px rgba(0,0,0,0.8);
        }

        .mac-ai-popup-title {
          font-size: 16px;
          font-weight: 800;
          margin-bottom: 8px;
        }

        .mac-ai-popup-desc {
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 20px;
          line-height: 1.4;
        }

        .mac-ai-popup-buttons {
          display: flex;
          gap: 10px;
        }

        .mac-ai-popup-btn {
          flex: 1;
          padding: 12px;
          border-radius: 16px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          border: none;
        }

        .mac-ai-popup-btn.confirm {
          background: var(--accent-red);
          color: #fff;
        }

        .mac-ai-popup-btn.cancel {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-primary);
        }
      ` }} />

      {/* ── HEADER BLOCK ── */}
      <header className="mac-ai-header">
        <div className="mac-ai-header-left">
          <button className="mac-ai-back-btn" onClick={onBack}>
            <span>←</span>
            <span>MacHub</span>
          </button>
          <div className="mac-ai-title">MacAI</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {tab === 'home' && (
            <button 
              className="mac-ai-circle-btn" 
              onClick={handleNewChat}
              title="New Conversation"
              style={{ fontSize: 16 }}
            >
              +
            </button>
          )}
          <button 
            className="mac-ai-circle-btn" 
            onClick={() => setShowHistoryDrawer(true)}
            title="Chat History"
            style={{ fontSize: 14 }}
          >
            🕒
          </button>
        </div>
      </header>

      {/* ── CORE VIEWPORT ── */}
      <main className="mac-ai-viewport">
        <div className="mac-ai-content-box">
          
          {/* TAB 1: HOME (BOSS AI CHAT) */}
          {tab === 'home' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Perspective Modes selectors */}
              {activeChat.length === 0 && (
                <>
                  <div style={{ textAlign: 'center', marginTop: 20 }}>
                    <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.04em' }}>Swarm Intelligence</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>Deploy specialized agents below</div>
                  </div>
                  
                  <div className="mac-ai-modes-perspective">
                    <div className="mac-ai-mode-card left" onClick={() => handleSuggestedPrompt("Analyze my studies and current schedule", "Syllabus Swarm")}>
                      <span className="mac-ai-mode-icon">📚</span>
                      <span className="mac-ai-mode-label">Syllabus</span>
                    </div>
                    <div className="mac-ai-mode-card" onClick={() => handleSuggestedPrompt("Perform deep research on web technologies", "Deep Research")}>
                      <span className="mac-ai-mode-icon">🔍</span>
                      <span className="mac-ai-mode-label">Research</span>
                    </div>
                    <div className="mac-ai-mode-card right" onClick={() => handleSuggestedPrompt("Check my daily exam status & workload", "Exam Coach")}>
                      <span className="mac-ai-mode-icon">🔥</span>
                      <span className="mac-ai-mode-label">Coach</span>
                    </div>
                  </div>
                </>
              )}

              {/* Chat messages roll */}
              <div className="mac-ai-chat-messages">
                {activeChat.length === 0 ? (
                  <div style={{ padding: '40px 0', textAlign: 'center' }}>
                    <div className="mac-ai-suggestions-grid">
                      <div className="mac-ai-suggestion-card" onClick={() => handleSuggestedPrompt("What is my syllabus today?", "Syllabus Swarm")}>
                        <span className="mac-ai-suggestion-icon">📚</span>
                        <span className="mac-ai-suggestion-label">Syllabus</span>
                        <span className="mac-ai-suggestion-desc">Check topics &amp; modules</span>
                      </div>
                      <div className="mac-ai-suggestion-card" onClick={() => handleSuggestedPrompt("Find my exam seating arrangement")}>
                        <span className="mac-ai-suggestion-icon">🪑</span>
                        <span className="mac-ai-suggestion-label">Seat Seeker</span>
                        <span className="mac-ai-suggestion-desc">Locate exam desks</span>
                      </div>
                      <div className="mac-ai-suggestion-card" onClick={() => handleSuggestedPrompt("How is my best streak going?", "Exam Coach")}>
                        <span className="mac-ai-suggestion-icon">🔥</span>
                        <span className="mac-ai-suggestion-label">Streak Status</span>
                        <span className="mac-ai-suggestion-desc">Check battle streak</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  activeChat.map(msg => (
                    <div key={msg.id} className={`mac-ai-msg-bubble ${msg.role}`}>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                      <span className="mac-ai-timestamp">{msg.timestamp}</span>
                    </div>
                  ))
                )}

                {isTyping && (
                  <div className="mac-ai-msg-bubble assistant" style={{ display: 'flex', gap: 6, padding: '12px 20px', width: 'fit-content' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block', animation: 'bounce 0.8s infinite alternate' }}></span>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block', animation: 'bounce 0.8s infinite alternate 0.2s' }}></span>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block', animation: 'bounce 0.8s infinite alternate 0.4s' }}></span>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Input docking wrapper */}
              <div className="mac-ai-input-dock">
                <div className="mac-ai-active-tag-row">
                  {activeTag && (
                    <div className="mac-ai-active-tag">
                      <span>{activeTag}</span>
                      <button className="mac-ai-active-tag-close" onClick={() => setActiveTag(null)}>×</button>
                    </div>
                  )}
                </div>

                <div className="mac-ai-pill-wrap">
                  {showPlusMenu && (
                    <div className="mac-ai-plus-menu" ref={plusMenuRef}>
                      <div className="mac-ai-plus-item" onClick={() => { setActiveTag('Deep Research'); setShowPlusMenu(false); }}>
                        <span className="mac-ai-plus-icon">🔍</span>
                        <div>
                          <p className="mac-ai-plus-text">Deep Research</p>
                          <p className="mac-ai-plus-desc">Deploy research crawler agents</p>
                        </div>
                      </div>
                      <div className="mac-ai-plus-item" onClick={() => { setActiveTag('Syllabus Swarm'); setShowPlusMenu(false); }}>
                        <span className="mac-ai-plus-icon">📚</span>
                        <div>
                          <p className="mac-ai-plus-text">Syllabus Swarm</p>
                          <p className="mac-ai-plus-desc">Comprehensive topics database</p>
                        </div>
                      </div>
                      <div className="mac-ai-plus-item" onClick={() => { setActiveTag('Exam Coach'); setShowPlusMenu(false); }}>
                        <span className="mac-ai-plus-icon">🔥</span>
                        <div>
                          <p className="mac-ai-plus-text">Exam Coach (Hard Truths)</p>
                          <p className="mac-ai-plus-desc">Brutal checklist warnings</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <button 
                    id="aiPlusBtn"
                    className="mac-ai-circle-btn" 
                    onClick={() => setShowPlusMenu(!showPlusMenu)}
                  >
                    <span style={{ transform: showPlusMenu ? 'rotate(45deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>+</span>
                  </button>

                  <input 
                    className="mac-ai-input-field"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder={isListening ? "Listening..." : "Ask MacAI Swarm..."}
                  />

                  <div className="mac-ai-input-actions">
                    <button 
                      className="mac-ai-circle-btn" 
                      onClick={() => setIsThinking(!isThinking)}
                      title="Deep Thinking Mode"
                      style={{ color: isThinking ? 'var(--accent-gold)' : 'rgba(255,255,255,0.6)' }}
                    >
                      💡
                    </button>
                    <button 
                      className="mac-ai-circle-btn" 
                      onClick={handleVoiceToggle}
                      title="Voice Speech Dictation"
                      style={{ color: isListening ? 'var(--accent-red)' : 'rgba(255,255,255,0.6)' }}
                    >
                      🎙️
                    </button>
                  </div>

                  <button 
                    className="mac-ai-send-btn" 
                    onClick={handleSend}
                    disabled={!chatInput.trim()}
                  >
                    ➔
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LOOKMAX */}
          {tab === 'lookmax' && (
            <div className="lookmax-routine-card mac-ai-glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--accent-purple)', letterSpacing: '0.15em' }}>GLOWUP MATRIX</p>
                  <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 4 }}>Lookmax</h2>
                </div>
                <span style={{ fontSize: 28 }}>🧴</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 20 }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: 12, borderRadius: 16, textalign: 'center' }}>
                  <p style={{ fontSize: 18, fontWeight: 900, color: 'var(--accent-purple)', textAlign: 'center' }}>{data.lookmax.skinType}</p>
                  <p style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 4, textAlign: 'center' }}>Skin Type</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: 12, borderRadius: 16, textalign: 'center' }}>
                  <p style={{ fontSize: 18, fontWeight: 900, color: 'var(--accent-purple)', textAlign: 'center' }}>{data.lookmax.hairType}</p>
                  <p style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 4, textAlign: 'center' }}>Hair Type</p>
                </div>
              </div>

              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>MORNING PROTOCOLS</p>
                <div className="lookmax-checkbox-list">
                  {data.lookmax.routine.morning.map(step => (
                    <div key={step.id} className={`lookmax-check-row ${step.done ? 'done' : ''}`} onClick={() => toggleSkincareStep(step.id)}>
                      <div className="lookmax-check-box">{step.done ? '✓' : ''}</div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{step.title}</p>
                        <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>NIGHT PROTOCOLS</p>
                <div className="lookmax-checkbox-list">
                  {data.lookmax.routine.night.map(step => (
                    <div key={step.id} className={`lookmax-check-row ${step.done ? 'done' : ''}`} onClick={() => toggleSkincareStep(step.id)}>
                      <div className="lookmax-check-box">{step.done ? '✓' : ''}</div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{step.title}</p>
                        <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BODY */}
          {tab === 'body' && (
            <div className="body-stat-card mac-ai-glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--accent-blue)', letterSpacing: '0.15em' }}>ATHLETIC GRID</p>
                  <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 4 }}>Body</h2>
                </div>
                <span style={{ fontSize: 28 }}>🏋️</span>
              </div>

              <div className="body-grid">
                <div className="body-mini-box">
                  <p className="body-mini-val">{data.coach.goal}</p>
                  <p className="body-mini-lbl">Fitness Goal</p>
                </div>
                <div className="body-mini-box">
                  <p className="body-mini-val">{data.coach.location}</p>
                  <p className="body-mini-lbl">Workout Hub</p>
                </div>
              </div>

              <div style={{ marginTop: 24 }}>
                <p style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)', letterSpacing: '0.15em', marginBottom: 12 }}>ACTIVE GYM PROTOCOL</p>
                <div className="lookmax-checkbox-list">
                  {data.coach.currentPlan.map(ex => (
                    <div key={ex.id} className={`lookmax-check-row ${ex.done ? 'done' : ''}`} onClick={() => toggleWorkoutStep(ex.id)}>
                      <div className="lookmax-check-box">{ex.done ? '✓' : ''}</div>
                      <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{ex.name}</p>
                          <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>Intensity Splitting</p>
                        </div>
                        <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--accent-blue)', fontWeight: 700 }}>{ex.sets}×{ex.reps}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MIND */}
          {tab === 'mind' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Countdown panel */}
              <div className="lookmax-routine-card mac-ai-glass-panel" style={{ borderLeft: '4px solid var(--accent-red)' }}>
                <p style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--accent-red)', letterSpacing: '0.12em' }}>EXAM_T_MINUS_DEADLINE</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <div>
                    <span style={{ fontSize: 44, fontWeight: 900, lineHeight: 1 }}>
                      {Math.max(0, Math.ceil((new Date(data.mind.examDate) - Date.now()) / (1000 * 60 * 60 * 24)))}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, marginLeft: 8 }}>DAYS REMAINING</span>
                  </div>
                  <span style={{ fontSize: 32 }}>🎓</span>
                </div>
              </div>

              {/* Subjects progressive tracking list */}
              <div className="lookmax-routine-card mac-ai-glass-panel">
                <p style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)', letterSpacing: '0.12em', marginBottom: 14 }}>MASTERY ARCHIVE</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {data.mind.subjects.map(sub => (
                    <div key={sub.id} className="mind-subject-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{sub.name}</span>
                        <span style={{ fontSize: 10, fontFamily: 'monospace', color: sub.priority === 'high' ? 'var(--accent-red)' : 'var(--text-secondary)', fontWeight: 800, textTransform: 'uppercase' }}>
                          {sub.priority}
                        </span>
                      </div>

                      <div className="mind-progress-track">
                        <div className="mind-bar-shell">
                          <div 
                            className="mind-bar-fill" 
                            style={{ 
                              width: `${sub.progress}%`, 
                              background: sub.priority === 'high' ? 'var(--accent-red)' : 'var(--accent-blue)' 
                            }} 
                          />
                        </div>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, minWidth: 32, textAlign: 'right' }}>
                          {sub.progress}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: HUSTLE */}
          {tab === 'hustle' && (
            <div className="lookmax-routine-card mac-ai-glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--accent-green)', letterSpacing: '0.15em' }}>REVENUE MATRIX</p>
                  <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 4 }}>Hustle</h2>
                </div>
                <span style={{ fontSize: 28 }}>💼</span>
              </div>

              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)', letterSpacing: '0.1em', marginBottom: 12 }}>VENTURE DIRECTORY</p>
                <div className="lookmax-checkbox-list">
                  {data.hustle.projects.map(proj => (
                    <div key={proj.id} className={`lookmax-check-row ${proj.done ? 'done' : ''}`} onClick={() => toggleProjectStep(proj.id)}>
                      <div className="lookmax-check-box">{proj.done ? '✓' : ''}</div>
                      <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{proj.name}</p>
                          <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{proj.done ? 'Operational & Finished' : 'In Development'}</p>
                        </div>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--accent-green)', fontWeight: 800 }}>{proj.progress}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 24 }}>
                <p style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)', letterSpacing: '0.12em', marginBottom: 12 }}>SYSTEM MILESTONES</p>
                <div className="lookmax-checkbox-list">
                  {data.hustle.milestones.map(m => (
                    <div key={m.id} className={`lookmax-check-row ${m.done ? 'done' : ''}`} onClick={() => toggleMilestoneStep(m.id)}>
                      <div className="lookmax-check-box">{m.done ? '✓' : ''}</div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: m.done ? 'var(--text-secondary)' : '#fff' }}>
                        {m.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: PROFILE */}
          {tab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              <div className="profile-core-card mac-ai-glass-panel">
                <div className="profile-badge-icon">👑</div>
                <h2 style={{ fontSize: 22, fontWeight: 950 }}>{data.displayName}</h2>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>@{data.username}</p>

                <div className="profile-stats-grid">
                  <div className="profile-stat-box">
                    <div className="profile-stat-val" style={{ color: 'var(--accent-purple)' }}>{data.auraPoints}</div>
                    <div className="profile-stat-lbl">Aura</div>
                  </div>
                  <div className="profile-stat-box">
                    <div className="profile-stat-val" style={{ color: 'var(--accent-red)' }}>{data.streak}d</div>
                    <div className="profile-stat-lbl">Streak</div>
                  </div>
                  <div className="profile-stat-box">
                    <div className="profile-stat-val" style={{ color: 'var(--accent-gold)' }}>{data.grade}</div>
                    <div className="profile-stat-lbl">Grade</div>
                  </div>
                </div>
              </div>

              {/* Secondary Stats */}
              <div className="lookmax-routine-card mac-ai-glass-panel">
                <p style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)', letterSpacing: '0.12em', marginBottom: 14 }}>METRICS MATRIX</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Study Hours logged</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{data.studyHours} hours</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Workouts indexed</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{data.workoutsCompleted} lifts</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Finished books</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{data.booksRead} books</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ── PERSISTENT SLIDING HISTORY DRAWER ── */}
      <div className={`mac-ai-history-drawer ${showHistoryDrawer ? 'open' : ''}`}>
        <div className="mac-ai-drawer-header">
          <div className="mac-ai-drawer-title">Chat History</div>
          <button className="mac-ai-drawer-close" onClick={() => setShowHistoryDrawer(false)}>×</button>
        </div>

        <div className="mac-ai-drawer-content">
          {chatHistoryList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-secondary)', fontSize: 12 }}>
              No past conversations found.
            </div>
          ) : (
            chatHistoryList.map(chat => (
              <div 
                key={chat.id} 
                className="mac-ai-history-item"
                onClick={() => handleLoadChat(chat)}
              >
                <div className="mac-ai-history-item-top">
                  <span className="mac-ai-history-time">{chat.timestamp}</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span className="mac-ai-history-mode">{chat.mode}</span>
                    <button 
                      className="mac-ai-history-delete-btn" 
                      onClick={(e) => handleDeleteChat(e, chat.id)}
                      title="Delete Conversation"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <p className="mac-ai-history-preview">{chat.preview}</p>
              </div>
            ))
          )}
        </div>

        {chatHistoryList.length > 0 && (
          <div className="mac-ai-drawer-footer">
            <button className="mac-ai-clear-btn" onClick={() => setShowConfirmClear(true)}>
              Clear All Chats
            </button>
          </div>
        )}
      </div>

      {/* ── CLEAR HISTORY POPUP ── */}
      {showConfirmClear && (
        <div className="mac-ai-popup-backdrop">
          <div className="mac-ai-popup-card">
            <div className="mac-ai-popup-title" style={{ color: 'var(--accent-red)' }}>Clear History?</div>
            <p className="mac-ai-popup-desc">This action will permanently delete all past conversations from localStorage. This cannot be undone.</p>
            <div className="mac-ai-popup-buttons">
              <button className="mac-ai-popup-btn cancel" onClick={() => setShowConfirmClear(false)}>Cancel</button>
              <button className="mac-ai-popup-btn confirm" onClick={handleClearAllHistory}>Clear All</button>
            </div>
          </div>
        </div>
      )}

      {/* ── FLOATING NAVIGATION BAR ── */}
      <nav className="mac-ai-nav-pill-dock">
        <button className={`mac-ai-nav-item ${tab === 'home' ? 'active' : ''}`} onClick={() => setTab('home')}>
          <span className="mac-ai-nav-icon">🏠</span>
          <span className="mac-ai-nav-label">Swarm</span>
        </button>
        <button className={`mac-ai-nav-item ${tab === 'lookmax' ? 'active' : ''}`} onClick={() => setTab('lookmax')}>
          <span className="mac-ai-nav-icon">🧴</span>
          <span className="mac-ai-nav-label">Look</span>
        </button>
        <button className={`mac-ai-nav-item ${tab === 'body' ? 'active' : ''}`} onClick={() => setTab('body')}>
          <span className="mac-ai-nav-icon">🏋️</span>
          <span className="mac-ai-nav-label">Body</span>
        </button>
        <button className={`mac-ai-nav-item ${tab === 'mind' ? 'active' : ''}`} onClick={() => setTab('mind')}>
          <span className="mac-ai-nav-icon">🎓</span>
          <span className="mac-ai-nav-label">Mind</span>
        </button>
        <button className={`mac-ai-nav-item ${tab === 'hustle' ? 'active' : ''}`} onClick={() => setTab('hustle')}>
          <span className="mac-ai-nav-icon">💼</span>
          <span className="mac-ai-nav-label">Hustle</span>
        </button>
        <button className={`mac-ai-nav-item ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>
          <span className="mac-ai-nav-icon">👤</span>
          <span className="mac-ai-nav-label">Profile</span>
        </button>
      </nav>
    </div>
  );
}
