/**
 * MacHub — Performance module (perf.js)
 *
 * 1. Boot splash: replaces the black screen during boot with a branded loader.
 *    Hidden automatically when body gets .app-ready.
 * 2. Background preloading: after first paint, warms the portal cache for the
 *    most-visited sections at idle priority, so views open instantly.
 * 3. Skeleton shimmer: reusable .mh-skeleton class for loading states.
 *
 * Tiny and dependency-free. Loaded early (defer) — no lazy loading.
 */
(function () {
    'use strict';

    /* ── 1. Boot splash hide ─────────────────────────────────────────── */
    function hideSplash() {
        var el = document.getElementById('bootSplash');
        if (el) {
            el.classList.add('boot-splash-hide');
            setTimeout(function () { el.remove(); }, 600);
        }
    }
    if (document.body.classList.contains('app-ready')) {
        hideSplash();
    } else {
        var mo = new MutationObserver(function () {
            if (document.body.classList.contains('app-ready')) {
                mo.disconnect();
                // Small delay so the home view is actually painted first
                setTimeout(hideSplash, 250);
            }
        });
        mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        // Failsafe: never trap the user on the splash
        setTimeout(hideSplash, 12000);
    }

    /* ── 2. Background preloading ────────────────────────────────────── */
    function idle(fn) {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(fn, { timeout: 8000 });
        } else {
            setTimeout(fn, 3000);
        }
    }

    function preload() {
        try {
            var portal = window.MacHubPortal;
            if (!portal || typeof portal.fetchSection !== 'function') return;
            var adminNo = (typeof portal.getAdminNo === 'function' && portal.getAdminNo())
                || localStorage.getItem('machub_student_id');
            if (!adminNo) return; // not logged in — nothing to warm
            if (window.isPortalLocked) return;

            var sem = '';
            try {
                if (typeof getStudentSemNumber === 'function') sem = String(getStudentSemNumber());
            } catch (e) {}

            // Warm cache only (force=false): hits local/Firestore cache, no
            // portal hammering. Sections ordered by how often they're opened.
            var jobs = [
                ['Attendance', false, ''],
                ['InternalMark', false, sem],
                ['Assessment', false, sem],
            ];
            var chain = Promise.resolve();
            jobs.forEach(function (j) {
                chain = chain.then(function () {
                    return portal.fetchSection(j[0], j[1], j[2]).catch(function () {});
                });
            });
            // Also warm the MGU exam list (tiny JSON, cached 6h in worker)
            chain.then(function () {
                return fetch('https://machub-proxy.mrabensojan.workers.dev/api/mgu/exam-list')
                    .then(function (r) { return r.json(); }).catch(function () {});
            });
        } catch (e) { /* never break the app for a preload */ }
    }

    // Start preloading once the app is interactive
    function kickoff() { idle(preload); }
    if (document.body.classList.contains('app-ready')) {
        kickoff();
    } else {
        var mo2 = new MutationObserver(function () {
            if (document.body.classList.contains('app-ready')) {
                mo2.disconnect();
                setTimeout(kickoff, 1500);
            }
        });
        mo2.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    /* ── 3. Skeleton helper ──────────────────────────────────────────── */
    // Usage: el.innerHTML = window.mhSkeleton(3);
    window.mhSkeleton = function (rows) {
        rows = rows || 3;
        var h = '<div class="mh-skel-wrap">';
        for (var i = 0; i < rows; i++) {
            h += '<div class="mh-skeleton" style="height:' + (i === 0 ? 56 : 44) + 'px"></div>';
        }
        return h + '</div>';
    };
})();
