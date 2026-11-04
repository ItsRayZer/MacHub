/**
 * MacHub - Lazy view-script loader (perf)
 *
 * First paint used to parse ~1MB of JS (profile.js 272KB, app.v2.js 288KB,
 * resources.js, mac_ai.js, chat.js, explore.js, mgu_result.js ...). Now only
 * the boot-critical scripts load up front; heavy per-view scripts load the
 * first time their view opens, via the switchView() hook below.
 *
 * Same format, same features - scripts just arrive later. Everything is
 * defensive: if a script fails to load, navigation still proceeds.
 */

(function () {
    'use strict';

    // viewId -> scripts needed before that view can render
    var VIEW_SCRIPTS = {
        'view-profile': ['js/profile.js', 'js/qr_id.js'],
        'view-profile-edit': ['js/profile.js', 'js/qr_id.js'],
        'view-exam-resources': ['js/resources.js'],
        'view-resources': ['js/resources.js'],
        'view-results': ['js/mgu_result.js'],
        'view-chat': ['js/chat.js'],
        'view-explore': ['js/bcaeasy.js'],
        'view-ai': ['js/mac_ai.js'],
    };

    var loaded = {};
    var inflight = {};

    function loadScript(src) {
        if (loaded[src]) return Promise.resolve();
        if (inflight[src]) return inflight[src];
        inflight[src] = new Promise(function (resolve) {
            var el = document.createElement('script');
            el.src = src;
            el.async = false; // keep execution order among lazy scripts
            el.onload = function () { loaded[src] = true; resolve(); };
            el.onerror = function () {
                loaded[src] = true; // don't retry-loop; let the view render anyway
                resolve();
            };
            document.head.appendChild(el);
        }).finally(function () { delete inflight[src]; });
        return inflight[src];
    }

    /**
     * Called as the first line of switchView(). Returns true when every
     * script for viewId is already loaded (navigation continues), or false
     * after kicking off an async load + re-dispatch (navigation pauses).
     */
    window.__machubEnsureViewScripts = function (viewId) {
        var list = VIEW_SCRIPTS[viewId] || [];
        var pending = list.filter(function (s) { return !loaded[s] && !inflight[s]; });
        // also wait for scripts that are currently loading
        var waiting = list.filter(function (s) { return inflight[s]; });
        if (!pending.length && !waiting.length) return true;

        var chain = Promise.resolve();
        pending.forEach(function (src) {
            chain = chain.then(function () { return loadScript(src); });
        });
        // wait for in-flight ones too
        Promise.all(waiting.map(function (s) { return inflight[s]; }))
            .then(function () { return chain; })
            .then(function () {
                if (typeof window.switchView === 'function') {
                    window.switchView(viewId);
                }
            });
        return false;
    };

    // Stub so the floating MacAI button never throws before mac_ai.js arrives.
    // The real handler in mac_ai.js overwrites this on load.
    if (typeof window.handleMacAiBtnClick !== 'function') {
        window.handleMacAiBtnClick = function (event) {
            if (event && event.preventDefault) event.preventDefault();
            if (typeof window.switchView === 'function') {
                window.switchView('view-ai');
            }
        };
    }
})();
