/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   MACHUB — EXPLORE TAB ENGINE (v2: Smart Filters + Dark Mode)    ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

(function() {
    'use strict';

    /* ---------- Dark Palette Tokens ---------- */
    const ACCENT   = '#7C93B3';
    const INK      = '#F2F1ED';
    const SUBTLE   = 'rgba(242,241,237,0.55)';
    const FAINT    = 'rgba(242,241,237,0.38)';
    const PAPER    = '#121211';
    const SURFACE  = '#1C1B19';
    const HAIRLINE = 'rgba(242,241,237,0.08)';

    /* ---------- Real Data Providers ---------- */
    function getRealStudents() {
        if (window.STUDENTS_DB && Array.isArray(window.STUDENTS_DB) && window.STUDENTS_DB.length > 0) {
            return window.STUDENTS_DB.map((s, idx) => ({
                id: s.adminNo || s.regNo || `s_${idx}`,
                name: s.name,
                batch: s.classGroup || `${s.department || 'BCA'} Batch`,
                division: s.classNo ? `Class ${s.classNo}` : (s.semester || 'Sem 2'),
                myBatch: (s.classGroup === 'BCA A' || s.department === 'BCA'),
                rankOptIn: idx < 5,
                rank: idx < 5 ? idx + 1 : null
            }));
        }
        return [
            { id: "12965", name: "ABEN SOJAN", batch: "BCA A", division: "Class 3202", myBatch: true, rankOptIn: true, rank: 1 },
            { id: "12727", name: "AAVANY SUNIL", batch: "BCA A", division: "Class 3201", myBatch: true, rankOptIn: true, rank: 2 },
            { id: "12728", name: "ABHIJITH SHIJU", batch: "BCA A", division: "Class 3203", myBatch: true, rankOptIn: true, rank: 3 },
            { id: "12966", name: "ABHINAV KRISHNA S", batch: "BCA A", division: "Class 3204", myBatch: true, rankOptIn: true, rank: 4 },
            { id: "12886", name: "ABHINAV MATHEW", batch: "BCA A", division: "Class 3205", myBatch: true, rankOptIn: true, rank: 5 },
            { id: "12790", name: "ABHIRAM V NAIR", batch: "BCA A", division: "Class 3206", myBatch: true, rankOptIn: false },
            { id: "12791", name: "ABHISHEK G NAIR", batch: "BCA A", division: "Class 3207", myBatch: true, rankOptIn: false },
            { id: "12887", name: "ABHISHEK RAJENDRAN", batch: "BCA A", division: "Class 3208", myBatch: true, rankOptIn: false },
            { id: "12967", name: "ABHISHEKH A K", batch: "BCA A", division: "Class 3209", myBatch: true, rankOptIn: false },
            { id: "12792", name: "ABY BIJO", batch: "BCA A", division: "Class 3211", myBatch: true, rankOptIn: false },
            { id: "13006", name: "ACHSAH BABU", batch: "BCA A", division: "Class 3212", myBatch: true, rankOptIn: false },
            { id: "12808", name: "ADARSH R NAIR", batch: "BCA A", division: "Class 3213", myBatch: true, rankOptIn: false },
            { id: "12889", name: "ADHIL KABEER", batch: "BCA A", division: "Class 3214", myBatch: true, rankOptIn: false },
            { id: "12890", name: "ADITHYAN P J", batch: "BCA B", division: "Class 3215", myBatch: false, rankOptIn: false },
            { id: "12968", name: "AISWARYA RAJESH", batch: "BCA B", division: "Class 3216", myBatch: false, rankOptIn: false },
            { id: "12793", name: "ALAN CYRIL", batch: "BCA B", division: "Class 3221", myBatch: false, rankOptIn: false }
        ];
    }

    function getRealStoreItems() {
        return [
            { id: "store_pdf_1", type: "pdf", title: "MGU Data Structures & Algorithms — FYUGP Notes", category: "Study PDFs", price: 49, description: "Official Mar Augusthinose College module notes, data structure diagrams, and C/C++ algorithms." },
            { id: "store_pdf_2", type: "pdf", title: "Operating Systems & Linux Shell — Solved PYQs (2022-2025)", category: "Study PDFs", price: 39, description: "Solved university question paper answers with step-by-step shell script explanations." },
            { id: "store_pdf_3", type: "pdf", title: "DBMS & SQL Normalization Complete Exam Guide", category: "Study PDFs", price: 45, description: "Comprehensive relational algebra, SQL queries, and 1NF to 3NF normalization problem solutions." },
            { id: "store_pdf_4", type: "pdf", title: "Discrete Mathematics & Graph Theory Question Bank", category: "Study PDFs", price: 29, description: "Curated problem set and previous year exam solutions for MGU mathematics paper." },

            { id: "store_course_1", type: "course", title: "Full-Stack Web Dev (React + Node + Tailwind)", category: "Courses", price: 499, description: "Complete project-based course building high-performance modern web apps from scratch." },
            { id: "store_course_2", type: "course", title: "Python Programming & Data Science Masterclass", category: "Courses", price: 399, description: "Master Python fundamentals, NumPy, Pandas, data visualization, and machine learning basics." },
            { id: "store_course_3", type: "course", title: "MGU FYUGP Cyber Security & Ethical Hacking", category: "Courses", price: 299, description: "Hands-on security course covering network protocols, vulnerability scanning, and defense." },

            { id: "store_print_1", type: "print", title: "MGU BCA Lab Record Printing & Spiral Binding", category: "Print Orders", price: 120, description: "Same-day laser printing of your lab record with heavy-duty transparent cover and spiral binding." },
            { id: "store_print_2", type: "print", title: "Semester Main Project Hardcover Leatherette Binding", category: "Print Orders", price: 250, description: "Gold foil embossed hardcover binding meeting Mar Augusthinose College submission guidelines." },
            { id: "store_print_3", type: "print", title: "Seminar Paper & Synopsis Laser Print Pack (30 Pages)", category: "Print Orders", price: 75, description: "High resolution color laser printouts of seminar slides and document report copies." },

            { id: "store_prem_1", type: "premium", title: "Machub Portfolio — 15+ Custom Designer Fonts Pack", category: "Premium", price: 99, description: "Unlock Archivo, JetBrains Mono, Syne, Instrument Serif, and 12 luxury designer fonts for your canvas." },
            { id: "store_prem_2", type: "premium", title: "Machub Verified Pro Student Badge & Custom Public Slug", category: "Premium", price: 149, description: "Claim a verified badge on your profile and reserve your custom handle e.g. machub.app/p/yourname." }
        ];
    }

    /* Filter configuration with explicit scopes */
    const FILTERS = [
        { key: "all", label: "All", scope: "both" },
        { key: "myBatch", label: "My Batch", scope: "people" },
        { key: "seniors", label: "Seniors", scope: "people" },
        { key: "studyPdfs", label: "Study PDFs", scope: "store" },
        { key: "courses", label: "Courses", scope: "store" }
    ];

    /* Component State */
    let searchQuery = '';
    let activeFilterKey = 'all';
    let debouncedTimer = null;
    let activeDetailView = null; // null | { type: 'student', data: obj } | { type: 'store', data: obj }

    function escapeHtml(str) {
        if (typeof str !== 'string') return str;
        return str.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#039;');
    }

    window.initExploreView = function() {
        const root = document.getElementById('exploreViewRoot');
        if (!root) return;
        renderExploreView();
    };

    window.setExploreSearchQuery = function(val) {
        searchQuery = val;
        clearTimeout(debouncedTimer);
        debouncedTimer = setTimeout(() => {
            renderExploreView(true);
        }, 150);
    };

    window.setExploreFilter = function(filterKey) {
        activeFilterKey = filterKey;
        renderExploreView(false);
    };

    window.openExploreStudentDetail = function(studentId) {
        const students = getRealStudents();
        const student = students.find(s => s.id === studentId) || { id: studentId, name: 'Student Profile' };
        activeDetailView = { type: 'student', data: student };
        renderExploreView(false);

        // If public profile loader exists, trigger read-only canvas load
        if (typeof window.loadPublicProfileView === 'function') {
            const slug = localStorage.getItem('machub_public_slug') || 'student-4f2a';
            setTimeout(() => {
                const container = document.getElementById('exploreDetailCanvasFrame');
                if (container) {
                    container.innerHTML = `
                        <div class="w-full p-4 text-center">
                            <iframe src="public.html?p=${slug}" class="w-full h-[580px] rounded-3xl border border-white/10" title="Public Canvas"></iframe>
                        </div>
                    `;
                }
            }, 100);
        }
    };

    window.openExploreStoreDetail = function(itemId) {
        const storeItems = getRealStoreItems();
        const item = storeItems.find(i => i.id === itemId);
        if (!item) return;
        activeDetailView = { type: 'store', data: item };
        renderExploreView(false);
    };

    window.closeExploreDetail = function() {
        activeDetailView = null;
        renderExploreView(false);
    };

    window.triggerItemPurchase = function(itemId) {
        const storeItems = getRealStoreItems();
        const item = storeItems.find(i => i.id === itemId);
        if (!item) return;

        const actionText = item.type === 'print' ? 'Place Print Order' : 'Buy Now';
        if (window.showToast) {
            window.showToast(`✨ Initiated ${actionText} for ₹${item.price}: "${item.title}"`, 'success');
        } else {
            alert(`Order Created!\n${item.title}\nAmount: ₹${item.price}`);
        }
    };

    function renderExploreView(partial = false) {
        const root = document.getElementById('exploreViewRoot');
        if (!root) return;

        const realStudents = getRealStudents();
        const realStore = getRealStoreItems();

        // ── Full-Screen Detail Pages Render ──
        if (activeDetailView) {
            if (activeDetailView.type === 'student') {
                const student = activeDetailView.data;
                root.innerHTML = `
                    <div style="min-height:100vh; background:${PAPER}; color:${INK}; padding:20px 16px 60px; font-family:'Archivo', sans-serif;">
                        <button onclick="window.closeExploreDetail()" style="padding:8px 18px; border-radius:100px; border:1px solid ${HAIRLINE}; background:${SURFACE}; color:${INK}; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px;" class="spring active:scale-95">
                            ← Explore
                        </button>

                        <div style="margin-top:28px;">
                            <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px;">
                                <div style="width:70px; height:70px; border-radius:50%; background:linear-gradient(155deg, #35332E 0%, #26241F 100%); border:2px solid ${ACCENT}; display:grid; place-items:center; font-size:24px;">👤</div>
                                <div>
                                    <h2 style="font-family:'Archivo Expanded', sans-serif; font-weight:800; font-size:24px; color:${INK}; line-height:1.1; margin:0;">${escapeHtml(student.name)}</h2>
                                    <p style="font-family:'JetBrains Mono', monospace; font-size:11px; color:${FAINT}; margin-top:6px;">${escapeHtml(student.batch || 'Batch 1')} · Division ${escapeHtml(student.division || 'A')}</p>
                                </div>
                            </div>

                            <div style="padding:14px 18px; border-radius:20px; background:${SURFACE}; border:1px solid ${HAIRLINE}; font-size:12px; color:${SUBTLE}; line-height:1.5; margin-bottom:24px;">
                                Read-only public profile canvas — showing verified student achievements, academic performance, and links.
                            </div>

                            <div id="exploreDetailCanvasFrame" style="width:100%; min-height:500px;"></div>
                        </div>
                    </div>
                `;
                return;
            }

            if (activeDetailView.type === 'store') {
                const item = activeDetailView.data;
                const typeIcon = { pdf: "📄", course: "🎓", print: "🖨️", premium: "✺" }[item.type] || "🛍️";
                const btnLabel = item.type === "print" ? "Place Print Order" : "Buy Now";

                root.innerHTML = `
                    <div style="min-height:100vh; background:${PAPER}; color:${INK}; padding:20px 16px 80px; font-family:'Archivo', sans-serif;">
                        <button onclick="window.closeExploreDetail()" style="padding:8px 18px; border-radius:100px; border:1px solid ${HAIRLINE}; background:${SURFACE}; color:${INK}; font-size:12px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px;" class="spring active:scale-95">
                            ← Explore
                        </button>

                        <div style="margin-top:28px;">
                            <div style="width:100%; height:180px; border-radius:24px; background:linear-gradient(155deg, #29271F 0%, #201E19 100%); border:1px solid ${HAIRLINE}; display:flex; align-items:center; justify-content:center; font-size:54px; margin-bottom:24px; shadow:0 20px 50px rgba(0,0,0,0.6);">
                                ${typeIcon}
                            </div>

                            <div style="font-family:'JetBrains Mono', monospace; font-size:11px; letter-spacing:0.1em; color:${FAINT}; text-transform:uppercase; margin-bottom:8px;">
                                ${escapeHtml(item.category)}
                            </div>

                            <h2 style="font-family:'Archivo Expanded', sans-serif; font-weight:800; font-size:26px; color:${INK}; line-height:1.15; margin:0 0 14px;">
                                ${escapeHtml(item.title)}
                            </h2>

                            <p style="font-size:13px; color:${SUBTLE}; line-height:1.6; margin-bottom:28px;">
                                ${escapeHtml(item.description)}
                            </p>

                            <div style="padding:20px; border-radius:24px; background:${SURFACE}; border:1px solid ${HAIRLINE}; display:flex; align-items:center; justify-content:between; margin-bottom:30px;">
                                <div>
                                    <div style="font-size:10px; font-weight:700; color:${FAINT}; text-transform:uppercase; letter-spacing:0.1em;">Price</div>
                                    <div style="font-family:'JetBrains Mono', monospace; font-size:30px; font-weight:700; color:${ACCENT}; line-height:1; margin-top:4px;">
                                        ₹${item.price}
                                    </div>
                                </div>
                                <div style="font-size:11px; color:${SUBTLE}; text-align:right;">
                                    Instant Access · Verified
                                </div>
                            </div>

                            <button onclick="window.triggerItemPurchase('${item.id}')" style="width:100%; padding:18px 0; border-radius:100px; border:none; background:${INK}; color:${PAPER}; font-family:'Archivo', sans-serif; font-weight:800; font-size:15px; cursor:pointer; shadow:0 12px 30px rgba(242,241,237,0.15);" class="spring active:scale-95">
                                ${btnLabel} — ₹${item.price}
                            </button>
                        </div>
                    </div>
                `;
                return;
            }
        }

        // ── Main Explore View Filtering Logic ──
        const filterConfig = FILTERS.find(f => f.key === activeFilterKey) || FILTERS[0];

        // Filter Students
        let filteredStudents = realStudents;
        if (activeFilterKey === 'myBatch') filteredStudents = filteredStudents.filter(s => s.myBatch);
        if (activeFilterKey === 'seniors') filteredStudents = filteredStudents.filter(s => !s.myBatch);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            filteredStudents = filteredStudents.filter(s => s.name.toLowerCase().includes(q));
        }

        // Filter Store Items
        let filteredStore = realStore;
        if (activeFilterKey === 'studyPdfs') filteredStore = filteredStore.filter(i => i.category === 'Study PDFs');
        if (activeFilterKey === 'courses') filteredStore = filteredStore.filter(i => i.category === 'Courses');
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            filteredStore = filteredStore.filter(i => i.title.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
        }

        // Section Scope Gating Rules
        const peopleAllowed = filterConfig.scope !== 'store';
        const storeAllowed  = filterConfig.scope !== 'people';

        const showPeople = peopleAllowed && filteredStudents.length > 0;
        const showStore  = storeAllowed && filteredStore.length > 0;
        const isSearching = searchQuery.trim().length > 0;

        // Group Store Items by Category
        const storeGroups = {};
        for (const item of filteredStore) {
            if (!storeGroups[item.category]) storeGroups[item.category] = [];
            storeGroups[item.category].push(item);
        }

        // ── Build Partial Results HTML ──
        let resultsHtml = '';

        // ── People Section ──
        if (showPeople) {
            const ranked = realStudents.filter(s => s.rankOptIn).sort((a, b) => a.rank - b.rank);
            const showLeaderboard = !isSearching && activeFilterKey !== 'seniors' && ranked.length > 0;

            resultsHtml += `
                <div style="margin-bottom:30px;">
                    <div style="font-family:'Archivo Expanded', sans-serif; font-weight:800; font-size:20px; color:${INK}; margin-bottom:14px; letter-spacing:-0.01em;">
                        People
                    </div>

                    ${showLeaderboard ? `
                        <div style="margin-bottom:18px;">
                            <div style="font-family:'JetBrains Mono', monospace; font-size:10px; letter-spacing:0.1em; color:${FAINT}; margin-bottom:8px; text-transform:uppercase;">
                                TOP THIS SEMESTER
                            </div>
                            <div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:4px;" class="no-scrollbar">
                                ${ranked.map(s => `
                                    <div onclick="window.openExploreStudentDetail('${s.id}')"
                                         style="flex-shrink:0; width:135px; padding:12px; border-radius:18px; background:${SURFACE}; border:1px solid ${HAIRLINE}; cursor:pointer;"
                                         class="spring active:scale-95">
                                        <div style="font-family:'JetBrains Mono', monospace; font-size:10px; font-weight:700; color:${ACCENT}; margin-bottom:6px;">
                                            #${s.rank} LEADER
                                        </div>
                                        <div style="font-family:'Archivo', sans-serif; font-weight:700; font-size:13px; color:${INK}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                            ${escapeHtml(s.name)}
                                        </div>
                                        <div style="font-family:'JetBrains Mono', monospace; font-size:10px; color:${FAINT}; margin-top:2px;">
                                            ${escapeHtml(s.batch || 'BCA')}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <div style="display:flex; flex-direction:column; gap:8px;">
                        ${filteredStudents.map(s => `
                            <div onclick="window.openExploreStudentDetail('${s.id}')"
                                 style="padding:14px 16px; border-radius:18px; background:${SURFACE}; border:1px solid ${HAIRLINE}; display:flex; align-items:center; justify-content:space-between; cursor:pointer;"
                                 class="spring active:scale-95">
                                <div style="display:flex; align-items:center; gap:12px;">
                                    <div style="width:36px; height:36px; border-radius:50%; background:#29271F; border:1px solid ${HAIRLINE}; display:grid; place-items:center; font-size:14px;">👤</div>
                                    <div>
                                        <div style="font-family:'Archivo', sans-serif; font-weight:700; font-size:14px; color:${INK};">
                                            ${escapeHtml(s.name)}
                                        </div>
                                        <div style="font-family:'JetBrains Mono', monospace; font-size:10px; color:${FAINT}; margin-top:2px;">
                                            ${escapeHtml(s.batch || 'BCA A')} · ${escapeHtml(s.division || 'Class 3202')}
                                        </div>
                                    </div>
                                </div>
                                <div style="font-size:12px; color:${FAINT};">→</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // ── Store Section ──
        if (showStore) {
            resultsHtml += `
                <div>
                    <div style="font-family:'Archivo Expanded', sans-serif; font-weight:800; font-size:20px; color:${INK}; margin-bottom:14px; letter-spacing:-0.01em;">
                        Store Catalog
                    </div>

                    ${Object.keys(storeGroups).map(cat => `
                        <div style="margin-bottom:24px;">
                            <div style="font-family:'JetBrains Mono', monospace; font-size:10px; letter-spacing:0.1em; color:${FAINT}; margin-bottom:10px; text-transform:uppercase;">
                                ${escapeHtml(cat)}
                            </div>
                            <div class="responsive-card-row" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:12px;">
                                ${storeGroups[cat].map(item => {
                                    const icon = { pdf: "📄", course: "🎓", print: "🖨️", premium: "✺" }[item.type] || "🛍️";
                                    return `
                                        <div onclick="window.openExploreStoreDetail('${item.id}')"
                                             style="padding:14px; border-radius:20px; background:${SURFACE}; border:1px solid ${HAIRLINE}; cursor:pointer;"
                                             class="spring active:scale-95">
                                            <div style="font-size:22px; margin-bottom:10px;">${icon}</div>
                                            <!-- CRITICAL: Store cards NEVER show price here -->
                                            <div style="font-family:'Archivo', sans-serif; font-weight:600; font-size:13px; color:${INK}; line-height:1.3; height:34px; overflow:hidden; text-overflow:ellipsis;">
                                                ${escapeHtml(item.title)}
                                            </div>
                                            <div style="font-family:'JetBrains Mono', monospace; font-size:10px; color:${FAINT}; margin-top:6px;">
                                                ${escapeHtml(item.category)}
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // ── Empty State ──
        if (!showPeople && !showStore) {
            resultsHtml += `
                <div style="text-align:center; padding:60px 0; font-family:'Archivo', sans-serif; font-size:14px; color:${FAINT};">
                    ${isSearching ? `No results for "${escapeHtml(searchQuery)}"` : 'No matching results found.'}
                </div>
            `;
        }

        const resultsContainer = document.getElementById('exploreResultsContainer');
        if (partial && resultsContainer) {
            resultsContainer.innerHTML = resultsHtml;
            return;
        }

        // ── Full Layout Build ──
        let html = `
            <div style="width:100%; min-height:100vh; background:${PAPER}; font-family:'Archivo', sans-serif; color:${INK}; padding:16px 16px 100px; max-w-md; margin:0 auto;">
                
                <!-- Search Bar -->
                <div style="display:flex; align-items:center; gap:10px; background:${SURFACE}; border:1px solid ${HAIRLINE}; border-radius:100px; padding:12px 18px; margin-bottom:14px; box-shadow:0 8px 24px rgba(0,0,0,0.4);">
                    <span style="font-size:16px; opacity:0.5;">🔍</span>
                    <input type="text"
                           value="${escapeHtml(searchQuery)}"
                           oninput="window.setExploreSearchQuery(this.value)"
                           placeholder="Search people, PDFs, courses..."
                           style="border:none; outline:none; flex:1; font-family:'Archivo', sans-serif; font-size:14px; color:${INK}; background:transparent;" />
                </div>

                <!-- Filter Chips Row -->
                <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:18px;" class="no-scrollbar">
                    ${FILTERS.map(f => `
                        <button onclick="window.setExploreFilter('${f.key}')"
                                style="flex-shrink:0; padding:8px 16px; border-radius:100px; border:1px solid ${activeFilterKey === f.key ? 'transparent' : HAIRLINE}; background:${activeFilterKey === f.key ? INK : SURFACE}; color:${activeFilterKey === f.key ? PAPER : SUBTLE}; font-family:'Archivo', sans-serif; font-size:12px; font-weight:600; cursor:pointer;"
                                class="spring active:scale-95">
                            ${f.label}
                        </button>
                    `).join('')}
                </div>

                <div id="exploreResultsContainer">
                    ${resultsHtml}
                </div>
            </div>
        `;
        root.innerHTML = html;
        root.innerHTML = html;
    }

    // Auto-initialize on load if Explore is active view
    if (typeof window.addEventListener === 'function') {
        window.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                const currentView = localStorage.getItem('machub_current_view');
                const exploreView = document.getElementById('view-explore');
                if (exploreView && (exploreView.classList.contains('is-active') || currentView === 'view-explore')) {
                    window.initExploreView();
                }
            }, 50);
        });
    }

})();
