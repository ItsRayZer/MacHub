// js/resources.js - Resources workspace manager
(function () {
    // 1. Database of academic resource categories and file structures
    const RESOURCE_DATABASE = {
        // High-fidelity mock files generated per subject category
        files: {
            "Notes": [
                { name: "Module 1 - Foundational Lectures.pdf", size: "1.4 MB", type: "PDF" },
                { name: "Module 2 - Core Methodologies & Architecture.pdf", size: "2.8 MB", type: "PDF" },
                { name: "Module 3 - Advanced Implementations.pdf", size: "2.1 MB", type: "PDF" },
                { name: "Syllabus Micro-Notes & Formula Reference.pdf", size: "950 KB", type: "PDF" }
            ],
            "PYQs": [
                { name: "MGU University Exam Paper - Nov 2025.pdf", size: "850 KB", type: "PDF" },
                { name: "MGU Model Supplementary Question Paper.pdf", size: "740 KB", type: "PDF" },
                { name: "Class Internal Assessment Test - 2026.pdf", size: "450 KB", type: "PDF" },
                { name: "Department Sample Model Paper.pdf", size: "620 KB", type: "PDF" }
            ],
            "Lab Manual": [
                { name: "Official Department Laboratory Record.pdf", size: "2.4 MB", type: "PDF" },
                { name: "Lab Experiment Compilation & Solutions.pdf", size: "3.8 MB", type: "PDF" },
                { name: "Viva Laboratory Quick Guide.pdf", size: "480 KB", type: "PDF" }
            ],
            "Assignments": [
                { name: "Assignment 1 - Theoretical Practice.pdf", size: "680 KB", type: "PDF" },
                { name: "Assignment 2 - Practical Applications & Logic.pdf", size: "1.2 MB", type: "PDF" },
                { name: "Mid-Term Written Project Report Guide.pdf", size: "540 KB", type: "PDF" }
            ],
            "Viva Questions": [
                { name: "Comprehensive Viva Voce Question Bank.pdf", size: "410 KB", type: "PDF" },
                { name: "Frequently Asked External Examiner Queries.pdf", size: "390 KB", type: "PDF" },
                { name: "Subject Concepts Quick Oral Review.pdf", size: "320 KB", type: "PDF" }
            ]
        }
    };

    // 2. Database of academic Protocols (MGU & MAC)
    const CAMPUS_PROTOCOLS = [
        {
            title: "MGU-UGP 2024 Honours Regulations",
            desc: "Official Mahatma Gandhi University Academic Framework, credit thresholds, and exit pathways.",
            url: "https://mgu.ac.in/"
        },
        {
            title: "MAC Institutional Code of Conduct",
            desc: "Mar Augusthinose College campus directives, physical decorum, and behavioral mandates.",
            url: "https://maraugusthinosecollege.org/"
        },
        {
            title: "MAC Hostel Rules & Leave Policies",
            desc: "Standard operating guidelines for St. Paul and Carmel Jyothi boarders.",
            url: "https://maraugusthinosecollege.org/"
        },
        {
            title: "MGU Attendance & Condonation Policy",
            desc: "Official guidelines on the 75% minimum attendance rule and medical exemptions.",
            url: "https://mgu.ac.in/"
        },
        {
            title: "MAC Central Library OPAC Guides",
            desc: "Borrowing limits, penalty rates, and Koha online search manuals.",
            url: "https://maraugusthinosecollege.org/"
        }
    ];

    // 3. Tab Navigation switcher
    window.switchResourcesTab = function(tab) {
        const btnSubjects = document.getElementById('btn-resource-subjects');
        const btnProtocols = document.getElementById('btn-resource-protocols');
        const viewSubjects = document.getElementById('resources-subjects-container');
        const viewProtocols = document.getElementById('resources-protocols-container');

        if (!btnSubjects || !btnProtocols || !viewSubjects || !viewProtocols) return;

        if (tab === 'subjects') {
            btnSubjects.classList.add('is-active');
            btnProtocols.classList.remove('is-active');
            viewSubjects.classList.remove('hidden');
            viewProtocols.classList.add('hidden');
            renderSubjectsView();
        } else {
            btnSubjects.classList.remove('is-active');
            btnProtocols.classList.add('is-active');
            viewSubjects.classList.add('hidden');
            viewProtocols.classList.remove('hidden');
            renderProtocolsView();
        }
    };

    // 4. Render Subjects list downward
    function renderSubjectsView() {
        const container = document.getElementById('resource-subjects-list');
        if (!container) return;

        const info = getStudentInfo();
        const dept = info ? (info.dept || 'BCA').toUpperCase() : 'BCA';
        const subjectsKey = `CLASS_SUBJECTS_${dept}`;
        const subjects = window[subjectsKey] || [];

        if (subjects.length === 0) {
            container.innerHTML = `
                <div class="text-center py-6 text-[#86868b] font-bold text-xs">
                    No subjects found for department ${dept}. Please setup your profile.
                </div>
            `;
            return;
        }

        let html = '';
        subjects.forEach((s, idx) => {
            html += `
                <div class="class-subject-card rounded-2xl overflow-hidden border border-white/10 dark:border-white/5 shadow-sm" id="resource-card-${idx}">
                    <!-- Card Header / Collapsible trigger -->
                    <button type="button" onclick="toggleResourceAccordion(${idx})" class="w-full flex items-center justify-between p-4.5 text-left transition-all hover:bg-black/5 dark:hover:bg-white/5">
                        <div class="flex items-center gap-3">
                            <span class="text-xl">📘</span>
                            <div>
                                <h4 class="text-sm font-extrabold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight leading-tight">${s.title}</h4>
                                <p class="text-[9px] font-black text-[#86868b] uppercase tracking-widest mt-0.5">${s.code} • ${s.credits} Credits</p>
                            </div>
                        </div>
                        <span class="card-chevron text-xs text-[#86868b] transform transition-transform" id="resource-chevron-${idx}">▼</span>
                    </button>

                    <!-- Folders Content Accordion -->
                    <div class="card-syllabus-content max-h-0 overflow-hidden bg-black/5 dark:bg-white/5" id="resource-content-${idx}">
                        <div class="p-3.5 space-y-2 border-t border-white/10 dark:border-white/5">
                            <p class="text-[9px] font-black text-[#86868b] uppercase tracking-[0.15em] mb-2 px-1">Resource Categories</p>
                            
                            <button type="button" onclick="openResourceCategoryDetail('${s.title}', 'Notes')" class="w-full flex items-center justify-between p-3 bg-white dark:bg-[#1c1c1e] rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-all shadow-sm border border-white/5">
                                <span class="text-xs font-extrabold text-[#1d1d1f] dark:text-[#f5f5f7]">📁 Notes & Lectures</span>
                                <span class="text-[9px] font-black text-[var(--mac-blue)] uppercase tracking-wider">Open Folder</span>
                            </button>

                            <button type="button" onclick="openResourceCategoryDetail('${s.title}', 'PYQs')" class="w-full flex items-center justify-between p-3 bg-white dark:bg-[#1c1c1e] rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-all shadow-sm border border-white/5">
                                <span class="text-xs font-extrabold text-[#1d1d1f] dark:text-[#f5f5f7]">📁 Previous Year Papers (PYQs)</span>
                                <span class="text-[9px] font-black text-[var(--mac-blue)] uppercase tracking-wider">Open Folder</span>
                            </button>

                            <button type="button" onclick="openResourceCategoryDetail('${s.title}', 'Lab Manual')" class="w-full flex items-center justify-between p-3 bg-white dark:bg-[#1c1c1e] rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-all shadow-sm border border-white/5">
                                <span class="text-xs font-extrabold text-[#1d1d1f] dark:text-[#f5f5f7]">📁 Lab Manual & Code Records</span>
                                <span class="text-[9px] font-black text-[var(--mac-blue)] uppercase tracking-wider">Open Folder</span>
                            </button>

                            <button type="button" onclick="openResourceCategoryDetail('${s.title}', 'Assignments')" class="w-full flex items-center justify-between p-3 bg-white dark:bg-[#1c1c1e] rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-all shadow-sm border border-white/5">
                                <span class="text-xs font-extrabold text-[#1d1d1f] dark:text-[#f5f5f7]">📁 Assignments & Tasks</span>
                                <span class="text-[9px] font-black text-[var(--mac-blue)] uppercase tracking-wider">Open Folder</span>
                            </button>

                            <button type="button" onclick="openResourceCategoryDetail('${s.title}', 'Viva Questions')" class="w-full flex items-center justify-between p-3 bg-white dark:bg-[#1c1c1e] rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-all shadow-sm border border-white/5">
                                <span class="text-xs font-extrabold text-[#1d1d1f] dark:text-[#f5f5f7]">📁 Viva Questions Bank</span>
                                <span class="text-[9px] font-black text-[var(--mac-blue)] uppercase tracking-wider">Open Folder</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    // 5. Collapsible accordion engine
    window.toggleResourceAccordion = function(idx) {
        const content = document.getElementById(`resource-content-${idx}`);
        const chevron = document.getElementById(`resource-chevron-${idx}`);
        const card = document.getElementById(`resource-card-${idx}`);

        if (!content || !chevron || !card) return;

        const isExpanded = card.classList.contains('is-expanded');

        // Collapse all other cards first to keep layout compact
        document.querySelectorAll('.class-subject-card').forEach((el, index) => {
            if (index !== idx) {
                el.classList.remove('is-expanded');
                const otherContent = document.getElementById(`resource-content-${index}`);
                const otherChevron = document.getElementById(`resource-chevron-${index}`);
                if (otherContent) otherContent.style.maxHeight = '0px';
                if (otherChevron) otherChevron.style.transform = 'rotate(0deg)';
            }
        });

        if (isExpanded) {
            card.classList.remove('is-expanded');
            content.style.maxHeight = '0px';
            chevron.style.transform = 'rotate(0deg)';
        } else {
            card.classList.add('is-expanded');
            content.style.maxHeight = content.scrollHeight + 'px';
            chevron.style.transform = 'rotate(180deg)';
        }
    };

    // 6. Open detailed resources folder inside Bottom Drawer
    window.openResourceCategoryDetail = function(subjectTitle, category) {
        const drawer = document.getElementById('detailDrawer');
        const backdrop = document.getElementById('timetableExamBackdrop');
        const drawerContent = document.getElementById('drawerDetailsContent');

        if (!drawer || !drawerContent) return;

        const files = RESOURCE_DATABASE.files[category] || [];

        let filesHtml = `
            <div class="px-1">
                <div class="flex items-center justify-between mb-5">
                    <div>
                        <h4 class="text-lg font-black text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight leading-none">${category}</h4>
                        <p class="text-[9px] font-black text-[#86868b] uppercase tracking-widest mt-1">${subjectTitle}</p>
                    </div>
                    <span class="text-xl">📁</span>
                </div>
                
                <div class="space-y-3">
        `;

        if (files.length === 0) {
            filesHtml += `<p class="text-xs text-[#86868b] font-bold text-center py-6">No files currently uploaded for this category.</p>`;
        } else {
            files.forEach(f => {
                filesHtml += `
                    <div class="p-3.5 bg-black/5 dark:bg-white/5 rounded-2xl flex items-center justify-between border border-white/5">
                        <div class="flex items-center gap-3">
                            <span class="text-xl">📄</span>
                            <div>
                                <h5 class="text-xs font-extrabold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight max-w-[200px] truncate leading-tight">${f.name}</h5>
                                <p class="text-[9px] font-black text-[#86868b] uppercase tracking-wider mt-0.5">${f.type} • ${f.size}</p>
                            </div>
                        </div>
                        <button type="button" onclick="triggerFileDownload('${f.name}')" class="px-3.5 py-1.5 bg-[var(--mac-blue)] hover:bg-[#0071e3]/80 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all spring active:scale-95 shadow-sm">
                            Download
                        </button>
                    </div>
                `;
            });
        }

        filesHtml += `
                </div>
            </div>
        `;

        drawerContent.innerHTML = filesHtml;

        // Show Drawer
        drawer.classList.remove('translate-y-full');
        if (backdrop) backdrop.classList.remove('hidden');
    };

    // 7. Simulating File Downloading feedback
    window.triggerFileDownload = function(fileName) {
        showGlobalToast(`Downloading: ${fileName}`);
        
        // Dynamic simulating completion toast
        setTimeout(() => {
            showGlobalToast(`Successfully downloaded: ${fileName}! 📥`);
        }, 1500);
    };

    // 8. Render Protocols view
    function renderProtocolsView() {
        const container = document.getElementById('resource-protocols-list');
        if (!container) return;

        let html = '';
        CAMPUS_PROTOCOLS.forEach(p => {
            html += `
                <div class="p-4 bg-white dark:bg-[#1c1c1e] rounded-2xl border border-white/10 dark:border-white/5 shadow-sm flex flex-col gap-2">
                    <div class="flex items-start justify-between">
                        <div>
                            <h4 class="text-sm font-extrabold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight leading-tight">${p.title}</h4>
                            <p class="text-xs font-bold text-[#86868b] mt-1 leading-snug">${p.desc}</p>
                        </div>
                        <span class="text-xl">📜</span>
                    </div>
                    <button type="button" onclick="openProtocolEmbedded('${p.url}', '${p.title}')" class="mt-2 w-full py-2.5 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-xs font-extrabold text-[#1d1d1f] dark:text-[#f5f5f7] rounded-xl border border-white/5 transition-all text-center tracking-tight">
                        Read Official Guidelines ➔
                    </button>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    // 9. Open protocol in embedded view
    window.openProtocolEmbedded = function(url, title) {
        if (window.openExternalApp) {
            window.openExternalApp(url, title);
        } else {
            window.open(url, '_blank');
        }
    };

    // Helper functions
    function getStudentInfo() {
        if (window.ExamHubProfileApi) return window.ExamHubProfileApi.getStudentInfo();
        try {
            return JSON.parse(localStorage.getItem('mac_student_info'));
        } catch (error) {
            return null;
        }
    }

    function showGlobalToast(message) {
        // Find existing or create
        let toast = document.getElementById('global-resource-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'global-resource-toast';
            toast.className = 'fixed bottom-24 left-1/2 transform -translate-x-1/2 z-[350] bg-black/85 dark:bg-white/90 text-white dark:text-[#1d1d1f] px-5 py-3 rounded-full text-xs font-extrabold tracking-tight transition-all duration-300 shadow-2xl pointer-events-none opacity-0 scale-90 flex items-center gap-2 border border-white/10';
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.classList.remove('opacity-0', 'scale-90');
        toast.classList.add('opacity-100', 'scale-100');

        clearTimeout(window.globalToastTimer);
        window.globalToastTimer = setTimeout(() => {
            toast.classList.remove('opacity-100', 'scale-100');
            toast.classList.add('opacity-0', 'scale-90');
        }, 2500);
    }

    // Init resources on window load or view switch trigger
    window.initResourcesWorkspace = function() {
        // Check active resources tab and render
        const btnSubjects = document.getElementById('btn-resource-subjects');
        if (btnSubjects && btnSubjects.classList.contains('is-active')) {
            renderSubjectsView();
        } else {
            renderProtocolsView();
        }
    };

    // Auto initialize if elements exist
    document.addEventListener('DOMContentLoaded', () => {
        // Hook into standard view rendering
        const originalSwitchView = window.switchView;
        if (originalSwitchView) {
            window.switchView = function(viewId) {
                originalSwitchView(viewId);
                if (viewId === 'view-resources') {
                    window.initResourcesWorkspace();
                }
            };
        }
    });
})();
