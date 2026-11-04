/**
 * BcaEasyNav — Study mode navigation for MacHub.
 *
 * TAP STUDY: bottom nav morphs Apple-style —
 *   Home + Study-entry collapse inward and vanish,
 *   Schedule isolates to the left edge, Profile to the right edge,
 *   Study / Mocks / Revise spring into the center with stagger.
 *   The study view zooms in, isolated and full-screen.
 *
 * TAP Schedule / Profile / Home: everything melts back to normal.
 */
(function () {
    'use strict';

    let inStudy = false;
    let activeTab = 'home';
    let switching = false;

    function pill() { return document.getElementById('navPill'); }

    function setActiveUI(tab) {
        ['home', 'mocks', 'revise'].forEach(t => {
            const el = document.getElementById('tab-study-' + t);
            if (el) el.classList.toggle('active', t === tab);
        });
    }

    function animateContentEnter() {
        const v = document.getElementById('view-explore');
        if (!v) return;
        v.classList.remove('study-enter', 'study-exit');
        void v.offsetWidth;
        v.classList.add('study-enter');
    }

    function animateContentSwitch() {
        const r = document.getElementById('exploreViewRoot');
        if (!r) return;
        r.classList.remove('study-tab-switch');
        void r.offsetWidth;
        r.classList.add('study-tab-switch');
    }

    /* Wait for the lazy BcaEasy script, then render. Poll up to 3s. */
    function whenReady(fn) {
        let n = 30;
        (function tick() {
            if (window.BcaEasy && window.BcaEasy.showStudy) return fn();
            if (n-- > 0) return setTimeout(tick, 100);
            console.warn('[BcaEasyNav] study script failed to load');
        })();
    }

    window.BcaEasyNav = {
        isStudy() { return inStudy; },

        enterStudy() {
            if (switching) return;
            if (inStudy) { this.studyTab('home'); return; }
            switching = true;
            inStudy = true;
            activeTab = 'home';

            const p = pill();
            if (p) p.classList.add('study-mode');
            setActiveUI('home');

            if (typeof switchView === 'function') switchView('view-explore');
            animateContentEnter();

            whenReady(() => {
                window.BcaEasy.showStudy('home');
                switching = false;
            });
            // Safety: never leave the user stuck
            setTimeout(() => { switching = false; }, 3500);
        },

        studyTab(tab) {
            if (!inStudy || switching) return;
            activeTab = tab;
            setActiveUI(tab);
            animateContentSwitch();
            if (window.BcaEasy && window.BcaEasy.showStudy) {
                window.BcaEasy.showStudy(tab);
            }
        },

        exitStudy() {
            if (!inStudy || switching) return;
            switching = true;
            inStudy = false;

            const v = document.getElementById('view-explore');
            if (v) {
                v.classList.remove('study-enter');
                v.classList.add('study-exit');
            }
            const p = pill();
            // Melt the nav back after the content starts zooming out
            setTimeout(() => {
                if (p) p.classList.remove('study-mode');
                setActiveUI('home');
                if (v) v.classList.remove('study-exit');
                switching = false;
            }, 180);
        },
    };
})();
