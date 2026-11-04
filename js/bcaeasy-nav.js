/**
 * BcaEasyNav — Study mode navigation controller for MacHub.
 * Tapping Study morphs the bottom nav: Schedule isolates left, Profile
 * isolates right, 3 study tabs (Study/Mocks/Revise) spring into the center.
 * Tapping Schedule/Profile/Home exits study mode with reverse animation.
 */
(function() {
    'use strict';

    let inStudy = false;
    let activeStudyTab = 'home';

    function pill() { return document.getElementById('navPill'); }

    function setActiveStudyTabUI(tab) {
        ['home', 'mocks', 'revise'].forEach(t => {
            const el = document.getElementById('tab-study-' + t);
            if (el) el.classList.toggle('active', t === tab);
        });
    }

    window.BcaEasyNav = {
        isStudyMode() { return inStudy; },

        enterStudy() {
            const p = pill();
            if (inStudy) { this.studyTab('home'); return; }
            inStudy = true;
            activeStudyTab = 'home';
            if (p) p.classList.add('study-mode');
            setActiveStudyTabUI('home');
            // Switch to explore view with enter animation
            if (typeof switchView === 'function') switchView('view-explore');
            const v = document.getElementById('view-explore');
            if (v) {
                v.classList.remove('study-enter');
                void v.offsetWidth; // restart animation
                v.classList.add('study-enter');
            }
            if (window.BcaEasy && window.BcaEasy.showStudy) window.BcaEasy.showStudy('home');
            else if (window.initExploreView) window.initExploreView();
        },

        exitStudy() {
            if (!inStudy) return;
            inStudy = false;
            const p = pill();
            if (p) p.classList.remove('study-mode');
            ['home', 'mocks', 'revise'].forEach(t => {
                const el = document.getElementById('tab-study-' + t);
                if (el) el.classList.remove('active');
            });
        },

        studyTab(tab) {
            if (!inStudy) { this.enterStudy(); }
            activeStudyTab = tab;
            setActiveStudyTabUI(tab);
            if (window.BcaEasy && window.BcaEasy.showStudy) window.BcaEasy.showStudy(tab);
        },
    };
})();
