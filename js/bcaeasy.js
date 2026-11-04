/**
 * BcaEasy UI for MacHub Explore tab.
 * Fully replaces the old student search + store.
 * Tabs: Library (PDFs + 47 INR unlock) | Refer | Wallet.
 * Backend: Supabase (monetization tables). Configure below.
 * No emojis. Matches MacHub dark glass aesthetic.
 */
(function() {
    'use strict';

    /* ---------------- Configuration ---------------- */
    // Fill these in when ready. UI degrades gracefully until configured.
    const CFG = {
        supabaseUrl: '',      // e.g. https://xyz.supabase.co
        supabaseAnonKey: '',
        razorpayKeyId: '',    // Razorpay Key ID (public)
        unlockPricePaise: 4700,
    };
    // Allow override via window.BcaEasyConfig
    if (window.BcaEasyConfig) Object.assign(CFG, window.BcaEasyConfig);

    const UNLOCK_PRICE_INR = (CFG.unlockPricePaise / 100).toFixed(0);

    /* ---------------- Helpers ---------------- */
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }
    function $(id) { return document.getElementById(id); }

    let supa = null;
    function db() {
        if (supa) return supa;
        if (!CFG.supabaseUrl || !CFG.supabaseAnonKey) return null;
        if (!window.supabase) return null;
        supa = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
        return supa;
    }
    function configured() { return !!db(); }

    function studentId() {
        return (window.MacHubPortal && window.MacHubPortal.getAdminNo && window.MacHubPortal.getAdminNo())
            || localStorage.getItem('machub_student_id') || '';
    }

    /* ---------------- State ---------------- */
    const S = {
        tab: 'library',
        semester: 3,
        docs: [],
        unlocked: [],
        wallet: { credit: 0, cash: 0 },
        refCode: '',
        refStats: { total: 0, paid: 0 },
        showAll: false,
        loading: true,
    };

    /* ---------------- SVG icons (no emojis) ---------------- */
    const IC = {
        book: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
        lock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
        unlock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>',
        share: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg>',
        wallet: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>',
        chev: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
        check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    };

    /* ---------------- Data loading ---------------- */
    async function loadAll() {
        S.loading = true;
        render();
        if (!configured()) { S.loading = false; render(); return; }
        const sb = db();
        const uid = studentId();
        try {
            const [unr, docs] = await Promise.all([
                uid ? sb.from('unlocks').select('semester').eq('user_id', uid) : { data: [] },
                sb.from('documents').select('id,subject,semester,chapter,title,is_free,sort_order')
                    .eq('semester', S.semester).order('subject').order('sort_order'),
            ]);
            S.unlocked = (unr.data || []).map(r => r.semester);
            S.docs = docs.data || [];
            if (uid) {
                const [w, rc, rf] = await Promise.all([
                    sb.from('wallet').select('credit_balance_paise,cash_balance_paise').eq('user_id', uid).maybeSingle(),
                    sb.from('referral_codes').select('code').eq('user_id', uid).maybeSingle(),
                    sb.from('referrals').select('status').eq('referrer_id', uid),
                ]);
                S.wallet = { credit: w.data?.credit_balance_paise || 0, cash: w.data?.cash_balance_paise || 0 };
                S.refCode = rc.data?.code || '';
                const refs = rf.data || [];
                S.refStats = { total: refs.length, paid: refs.filter(r => r.status === 'paid').length };
            }
        } catch (e) { console.warn('[BcaEasy] load failed:', e.message); }
        S.loading = false;
        render();
    }

    function canAccess(doc) {
        return doc.is_free || S.unlocked.includes(doc.semester);
    }

    /* ---------------- Render ---------------- */
    function render() {
        const root = $('exploreViewRoot');
        if (!root) return;
        root.innerHTML = `
        <div style="max-width:480px;margin:0 auto;padding:20px 16px 120px;">
            <h1 style="font-size:24px;font-weight:900;color:#f5f5f7;letter-spacing:-0.02em;">BcaEasy</h1>
            <p style="font-size:13px;color:#86868b;margin-top:2px;">Study PDFs, referrals and wallet.</p>

            <div style="display:flex;gap:8px;margin:16px 0;">
                ${['library', 'refer', 'wallet'].map(t => `
                    <button type="button" onclick="window.BcaEasy.switchTab('${t}')"
                        style="flex:1;padding:10px;border-radius:14px;font-size:13px;font-weight:800;border:1px solid rgba(255,255,255,0.08);cursor:pointer;
                        ${S.tab === t ? 'background:#f5f5f7;color:#1d1d1f;' : 'background:rgba(255,255,255,0.04);color:#86868b;'}">
                        ${t === 'library' ? 'Library' : t === 'refer' ? 'Refer' : 'Wallet'}
                    </button>`).join('')}
            </div>

            <div id="bcaeasy-body">${S.tab === 'library' ? libraryHtml() : S.tab === 'refer' ? referHtml() : walletHtml()}</div>
        </div>`;
    }

    function notConfiguredHtml() {
        return `<div class="glass-panel" style="border-radius:20px;padding:20px;text-align:center;margin-top:12px;">
            <p style="font-size:14px;font-weight:800;color:#f5f5f7;">Coming soon</p>
            <p style="font-size:12px;color:#86868b;margin-top:4px;">The study library is being set up. Check back shortly.</p>
        </div>`;
    }

    /* ----- Library ----- */
    function libraryHtml() {
        if (!configured()) return notConfiguredHtml();
        if (S.loading) return `<div style="margin-top:16px;display:grid;gap:10px;">${[1, 2, 3].map(() =>
            `<div class="glass-panel" style="height:72px;border-radius:18px;opacity:0.5;"></div>`).join('')}</div>`;

        const semUnlocked = S.unlocked.includes(S.semester);
        const grouped = {};
        S.docs.forEach(d => { (grouped[d.subject] = grouped[d.subject] || []).push(d); });

        let html = `<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;margin-bottom:12px;" class="no-scrollbar">`;
        for (let s = 1; s <= 8; s++) {
            html += `<button type="button" onclick="window.BcaEasy.setSemester(${s})"
                style="flex-shrink:0;padding:8px 16px;border-radius:12px;font-size:13px;font-weight:800;cursor:pointer;border:1px solid rgba(255,255,255,0.08);
                ${S.semester === s ? 'background:#f5f5f7;color:#1d1d1f;' : 'background:rgba(255,255,255,0.04);color:#86868b;'}">Sem ${s}</button>`;
        }
        html += `</div>`;

        const lockedCount = S.docs.filter(d => !canAccess(d)).length;
        if (!semUnlocked && lockedCount > 0) {
            html += `
            <div class="glass-panel" style="border-radius:20px;padding:20px;text-align:center;margin-bottom:16px;border:1px solid rgba(124,58,237,0.3);">
                <div style="width:48px;height:48px;border-radius:16px;background:rgba(124,58,237,0.15);color:#a78bfa;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;">${IC.lock}</div>
                <h3 style="font-size:16px;font-weight:900;color:#f5f5f7;">Unlock Semester ${S.semester} PDFs</h3>
                <p style="font-size:12px;color:#86868b;margin-top:4px;">Every chapter PDF + notes. One-time payment, yours forever.</p>
                <div style="font-size:28px;font-weight:900;color:#f5f5f7;margin-top:8px;">${UNLOCK_PRICE_INR} INR <span style="font-size:11px;font-weight:600;color:#86868b;">one-time</span></div>
                <button type="button" onclick="window.BcaEasy.unlock(${S.semester})" id="bcaeasy-unlock-btn"
                    style="width:100%;margin-top:12px;padding:14px;border-radius:16px;background:#7c3aed;color:#fff;font-size:14px;font-weight:800;border:none;cursor:pointer;">Unlock now</button>
                <p style="font-size:10px;color:#86868b;margin-top:8px;">Secure payment via Razorpay (UPI, cards, netbanking)</p>
            </div>`;
        }

        const subjects = Object.keys(grouped);
        if (!subjects.length) {
            html += `<div class="glass-panel" style="border-radius:20px;padding:20px;text-align:center;font-size:13px;color:#86868b;">No PDFs for Semester ${S.semester} yet.</div>`;
        }
        subjects.forEach(subj => {
            html += `<p style="font-size:11px;font-weight:900;color:#86868b;text-transform:uppercase;letter-spacing:0.12em;margin:14px 0 8px;">${esc(subj)}</p>`;
            grouped[subj].forEach(d => {
                const locked = !canAccess(d);
                html += `
                <button type="button" ${locked ? 'disabled' : `onclick="window.BcaEasy.openDoc('${d.id}')"`}
                    style="width:100%;display:flex;align-items:center;gap:12px;padding:14px;border-radius:16px;margin-bottom:8px;text-align:left;cursor:${locked ? 'default' : 'pointer'};border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.03);${locked ? 'opacity:0.65;' : ''}">
                    <span style="width:40px;height:40px;flex-shrink:0;border-radius:12px;display:flex;align-items:center;justify-content:center;${locked ? 'background:rgba(255,255,255,0.06);color:#86868b;' : 'background:rgba(124,58,237,0.15);color:#a78bfa;'}">${locked ? IC.lock : IC.unlock}</span>
                    <span style="flex:1;min-width:0;">
                        <span style="display:block;font-size:13px;font-weight:800;color:#f5f5f7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Ch ${d.chapter}: ${esc(d.title)}</span>
                        <span style="font-size:11px;color:#86868b;">${d.is_free ? 'Free' : locked ? 'Locked' : 'Unlocked'}</span>
                    </span>
                    ${locked ? '' : `<span style="color:#86868b;">${IC.chev}</span>`}
                </button>`;
            });
        });

        html += `
            <button type="button" onclick="window.BcaEasy.switchTab('refer')"
                style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:16px;border-radius:16px;margin-top:12px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.03);cursor:pointer;">
                <span style="font-size:13px;font-weight:800;color:#f5f5f7;">Get Sem ${S.semester} free — invite a friend</span>
                <span style="color:#86868b;">${IC.chev}</span>
            </button>`;
        return html;
    }

    /* ----- Refer ----- */
    function referHtml() {
        if (!configured()) return notConfiguredHtml();
        const earned = (S.refStats.paid * 235 / 100).toFixed(2);
        return `
        <div class="glass-panel" style="border-radius:20px;padding:20px;text-align:center;margin-top:12px;">
            <p style="font-size:10px;font-weight:800;color:#86868b;text-transform:uppercase;letter-spacing:0.12em;">Your referral code</p>
            <p style="font-size:28px;font-weight:900;letter-spacing:0.15em;color:#f5f5f7;margin:8px 0;">${esc(S.refCode || '—')}</p>
            <button type="button" onclick="window.BcaEasy.share()"
                style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:14px;border-radius:16px;background:#7c3aed;color:#fff;font-size:14px;font-weight:800;border:none;cursor:pointer;">${IC.share} Share invite</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px;">
            ${[['Invited', S.refStats.total], ['Paid', S.refStats.paid], ['Earned', earned + ' INR']].map(([l, v]) => `
                <div class="glass-panel" style="border-radius:16px;padding:14px;text-align:center;">
                    <p style="font-size:18px;font-weight:900;color:#f5f5f7;">${v}</p>
                    <p style="font-size:10px;color:#86868b;">${l}</p>
                </div>`).join('')}
        </div>
        <div class="glass-panel" style="border-radius:20px;padding:20px;margin-top:10px;">
            <h3 style="font-size:14px;font-weight:900;color:#f5f5f7;">Have a code?</h3>
            <div style="display:flex;gap:8px;margin-top:10px;">
                <input id="bcaeasy-ref-input" placeholder="XXXX-XXXX"
                    style="flex:1;min-width:0;padding:12px 14px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);color:#f5f5f7;font-size:13px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;outline:none;"/>
                <button type="button" onclick="window.BcaEasy.applyCode()"
                    style="padding:12px 20px;border-radius:12px;background:#f5f5f7;color:#1d1d1f;font-size:13px;font-weight:800;border:none;cursor:pointer;">Apply</button>
            </div>
            <p id="bcaeasy-ref-msg" style="font-size:12px;color:#86868b;margin-top:8px;"></p>
        </div>
        <div class="glass-panel" style="border-radius:20px;padding:20px;margin-top:10px;">
            <h3 style="font-size:14px;font-weight:900;color:#f5f5f7;">How it works</h3>
            <ol style="font-size:13px;color:#86868b;margin-top:8px;padding-left:18px;display:grid;gap:6px;">
                <li>Share your code with classmates.</li>
                <li>They sign up and unlock a semester (${UNLOCK_PRICE_INR} INR).</li>
                <li>You get that semester free, plus 5% wallet credit.</li>
            </ol>
        </div>`;
    }

    /* ----- Wallet ----- */
    function walletHtml() {
        if (!configured()) return notConfiguredHtml();
        const cr = (S.wallet.credit / 100).toFixed(2), ca = (S.wallet.cash / 100).toFixed(2);
        return `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;">
            <div class="glass-panel" style="border-radius:18px;padding:18px;">
                <p style="font-size:10px;font-weight:800;color:#86868b;text-transform:uppercase;letter-spacing:0.1em;">Unlock credit</p>
                <p style="font-size:22px;font-weight:900;color:#f5f5f7;margin-top:6px;">${cr} <span style="font-size:12px;">INR</span></p>
                <p style="font-size:10px;color:#86868b;margin-top:4px;">Auto-applied at checkout</p>
            </div>
            <div class="glass-panel" style="border-radius:18px;padding:18px;">
                <p style="font-size:10px;font-weight:800;color:#86868b;text-transform:uppercase;letter-spacing:0.1em;">Cash</p>
                <p style="font-size:22px;font-weight:900;color:#f5f5f7;margin-top:6px;">${ca} <span style="font-size:12px;">INR</span></p>
                <p style="font-size:10px;color:#86868b;margin-top:4px;">Withdrawable at 100 INR</p>
            </div>
        </div>
        <div class="glass-panel" style="border-radius:20px;padding:20px;margin-top:10px;">
            <h3 style="font-size:14px;font-weight:900;color:#f5f5f7;">Withdraw cash</h3>
            <p style="font-size:12px;color:#86868b;margin-top:4px;">Minimum 100 INR, paid to your UPI ID after approval.</p>
            <div style="display:flex;gap:8px;margin-top:10px;">
                <input id="bcaeasy-upi" placeholder="yourname@upi"
                    style="flex:1;min-width:0;padding:12px 14px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);color:#f5f5f7;font-size:13px;font-weight:700;outline:none;"/>
                <button type="button" onclick="window.BcaEasy.withdraw()" ${S.wallet.cash < 10000 ? 'disabled' : ''}
                    style="padding:12px 18px;border-radius:12px;background:#f5f5f7;color:#1d1d1f;font-size:13px;font-weight:800;border:none;cursor:pointer;${S.wallet.cash < 10000 ? 'opacity:0.4;' : ''}">Withdraw</button>
            </div>
            <p id="bcaeasy-wd-msg" style="font-size:12px;color:#86868b;margin-top:8px;"></p>
        </div>`;
    }

    /* ---------------- Actions ---------------- */
    function loadRazorpay() {
        return new Promise(res => {
            if (window.Razorpay) return res(true);
            const s = document.createElement('script');
            s.src = 'https://checkout.razorpay.com/v1/checkout.js';
            s.onload = () => res(true); s.onerror = () => res(false);
            document.body.appendChild(s);
        });
    }

    window.BcaEasy = {
        switchTab(t) { S.tab = t; render(); if (t === 'library' && !S.docs.length) loadAll(); },
        setSemester(s) { S.semester = s; S.docs = []; loadAll(); },

        async openDoc(id) {
            const sb = db(); if (!sb) return;
            try {
                const { data: doc } = await sb.from('documents').select('file_url,title').eq('id', id).maybeSingle();
                if (!doc) return;
                const { data, error } = await sb.storage.from('pdfs').createSignedUrl(doc.file_url, 3600);
                if (!error && data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
            } catch (e) { console.warn('[BcaEasy] open failed:', e.message); }
        },

        async unlock(semester) {
            const btn = $('bcaeasy-unlock-btn');
            if (btn) { btn.disabled = true; btn.textContent = 'Processing...'; }
            // NOTE: full Razorpay order flow needs the backend API.
            // Until the BcaEasy backend is deployed, show guidance.
            if (btn) { btn.disabled = false; btn.textContent = 'Unlock now'; }
            alert('Payments go live once Razorpay is connected. You will be notified.');
        },

        share() {
            const text = `Study smarter with BcaEasy — free chapter PDFs and notes for MGU BCA. Join with my code ${S.refCode}: https://mac-hub.vercel.app`;
            if (navigator.share) { navigator.share({ text }).catch(() => {}); return; }
            if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
            alert('Invite link copied.');
        },

        async applyCode() {
            const inp = $('bcaeasy-ref-input'), msg = $('bcaeasy-ref-msg');
            const code = (inp?.value || '').trim().toUpperCase();
            if (!code || !msg) return;
            const sb = db(); if (!sb) { msg.textContent = 'Not configured yet.'; return; }
            try {
                const { data: row } = await sb.from('referral_codes').select('user_id').eq('code', code).maybeSingle();
                if (!row) { msg.textContent = 'Invalid code.'; return; }
                const uid = studentId();
                if (row.user_id === uid) { msg.textContent = 'That is your own code.'; return; }
                const { error } = await sb.from('referrals').insert({ referrer_id: row.user_id, referred_id: uid, status: 'pending' });
                msg.textContent = error ? 'Code already applied.' : 'Code applied.';
            } catch (e) { msg.textContent = 'Failed. Try again.'; }
        },

        async withdraw() {
            const inp = $('bcaeasy-upi'), msg = $('bcaeasy-wd-msg');
            const upi = (inp?.value || '').trim();
            if (!upi || !msg) return;
            if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi)) { msg.textContent = 'Enter a valid UPI ID.'; return; }
            const sb = db(); if (!sb) return;
            const uid = studentId();
            try {
                await sb.from('withdrawals').insert({ user_id: uid, amount_paise: 10000, upi_id: upi, status: 'pending' });
                msg.textContent = 'Withdrawal requested. Paid after approval.';
                if (inp) inp.value = '';
            } catch (e) { msg.textContent = 'Failed. Try again.'; }
        },
    };

    /* ---------------- Init (replaces old explore) ---------------- */
    window.initExploreView = function() {
        const root = $('exploreViewRoot');
        if (!root) return;
        // Load Supabase CDN once if backend configured
        if (CFG.supabaseUrl && !window.supabase) {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            s.onload = loadAll;
            document.head.appendChild(s);
        } else {
            loadAll();
        }
    };

    // Keep the old file from double-defining: neutralize its init if it loads after us
    // (this file is loaded after explore.js, so ours wins).
})();
