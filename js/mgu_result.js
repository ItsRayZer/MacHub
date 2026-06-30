/**
 * MacHub — MGU University Result Module v2.0
 * Full redesign. No semester filter. Auto-captcha. Full data display.
 */

(function () {
  'use strict';

  const CF = 'https://machub-proxy.mrabensojan.workers.dev';

  let S = {
    exams: [], loaded: false,
    capId: null, capAns: null, capImg: null,
    result: null, history: [], busy: false
  };

  /* ── Profile helpers ─────────────────────────────────────────── */
  function adminNo() {
    return window.ExamHubProfile?.get()?.adminNo
      || window.getStudentInfo?.()?.adminNo
      || localStorage.getItem('machub_student_id') || '';
  }
  function profilePrn() {
    const p = window.ExamHubProfile?.get() || window.getStudentInfo?.() || {};
    return p.prn || p.data?.prn || localStorage.getItem('machub_mgu_prn') || null;
  }
  async function savePrnToLocalAndRemote(prn) {
    if (!prn) return;
    try {
      const info = (window.ExamHubProfile?.get || window.getStudentInfo)?.() || {};
      info.prn = prn;
      if (window.ExamHubProfile?.save) {
        window.ExamHubProfile.save(info);
      } else {
        localStorage.setItem('mac_student_info', JSON.stringify(info));
      }
      localStorage.setItem('machub_mgu_prn', prn);
      
      const an = adminNo();
      if (an) {
        const db = window.firebaseFirestore;
        const docFn = window.firestoreDoc;
        const updFn = window.firestoreUpdateDoc;
        if (db && docFn && updFn) {
          const ref = docFn(db, 'students', an);
          await updFn(ref, { prn: prn });
        }
      }
    } catch (e) {
      console.warn('[MGU] save prn error:', e);
    }
  }
  function toast(msg, t) {
    if (window.showToast) window.showToast(msg, t || 'info');
  }

  /* ── Firestore ───────────────────────────────────────────────── */
  async function firestoreSave(result, examId, examName) {
    const an = adminNo(); if (!an) return;
    const { firebaseFirestore: db, firestoreDoc: doc, firestoreGetDoc: get, firestoreUpdateDoc: upd } = window;
    if (!db || !doc || !get || !upd) return;
    try {
      const ref = doc(db, 'students', an);
      const snap = await get(ref);
      let hist = snap.exists() ? (snap.data().mguResults?.history || []) : [];
      hist.unshift({ id: Date.now()+'', examName, examId, fetchedAt: new Date(), result });
      if (hist.length > 20) hist = hist.slice(0, 20);
      await upd(ref, { 'mguResults.history': hist, 'mguResults.lastFetchedAt': new Date() });
      S.history = hist;
      renderHistory();
    } catch (e) { console.warn('[MGU] save:', e.message); }
  }

  async function firestoreLoad() {
    const an = adminNo(); if (!an) { renderHistory(); return; }
    const { firebaseFirestore: db, firestoreDoc: doc, firestoreGetDoc: get } = window;
    if (!db || !doc || !get) { renderHistory(); return; }
    try {
      const snap = await get(doc(db, 'students', an));
      if (snap.exists()) {
        S.history = (snap.data().mguResults?.history || [])
          .sort((a, b) => (b.fetchedAt?.seconds || 0) - (a.fetchedAt?.seconds || 0));
      }
    } catch (e) { console.warn('[MGU] load:', e.message); }
    renderHistory();
  }

  /* ── Exam list ───────────────────────────────────────────────── */
  async function loadExams() {
    const sel = $('mgu-exam-select');
    const cnt = $('mgu-exam-count');
    if (!sel) return;
    sel.innerHTML = '<option value="">Loading exams…</option>';
    sel.disabled = true;
    try {
      const d = await api('/api/mgu/exam-list');
      if (!d || !d.success) throw new Error(d?.error || 'Failed to load exams');
      S.exams = d.exams || []; S.loaded = true;
      sel.innerHTML = '<option value="">Select examination…</option>';
      S.exams.forEach(e => {
        const o = document.createElement('option');
        o.value = e.value; o.textContent = e.label;
        sel.appendChild(o);
      });
      // Auto-select most recent (first in list)
      if (S.exams.length) sel.value = S.exams[0].value;
      if (cnt) cnt.textContent = `${S.exams.length} active exams`;
      sel.disabled = false;
    } catch (e) {
      sel.innerHTML = '<option value="">Failed — tap ↺ to retry</option>';
      sel.disabled = false;
      if (cnt) cnt.textContent = 'Failed to load';
    }
  }

  /* ── Captcha ─────────────────────────────────────────────────── */
  async function loadCaptcha() {
    const img = $('mgu-cap-img'), sk = $('mgu-cap-sk'), btn = $('mgu-cap-btn'), inp = $('mgu-cap-in');
    if (img) img.classList.add('hidden');
    if (sk) { sk.classList.remove('hidden'); }
    if (btn) btn.disabled = true;
    try {
      const d = await api('/api/mgu/captcha');
      if (!d || !d.success) throw new Error(d?.error || 'Failed to load captcha');
      S.capId = d.captchaId; S.capAns = d.captchaAnswer; S.capImg = d.captchaImage;
      if (img) { img.src = d.captchaImage; img.classList.remove('hidden'); }
      if (sk) sk.classList.add('hidden');
      if (inp) { inp.value = d.captchaAnswer || ''; inp.placeholder = 'Auto-filled ✨'; }
    } catch (e) {
      if (sk) sk.innerHTML = '<span style="color:#fc5c65;font-size:11px;">Failed. Tap ↺</span>';
    }
    if (btn) btn.disabled = false;
  }

  /* ── Submit ──────────────────────────────────────────────────── */
  let submitAttempts = 0;
  async function submit() {
    if (S.busy && submitAttempts === 0) return;
    const prn     = ($('mgu-prn-in')?.value || '').trim();
    const examId  = ($('mgu-exam-select')?.value || '').trim();
    
    if (prn) {
      savePrnToLocalAndRemote(prn);
    }
    
    const capIn   = ($('mgu-cap-in')?.value || '').trim();
    const capAns  = capIn || S.capAns || '';
    const capId   = S.capId;
    const errEl   = $('mgu-err');

    clearErr();
    if (!prn)   { showErr('Enter your PRN (Permanent Registration Number).'); submitAttempts = 0; return; }
    if (!examId){ showErr('Select an examination from the list.'); submitAttempts = 0; return; }
    
    if (!capId) {
      setBusy(true);
      showErr('Loading security verification in background...');
      await loadCaptcha();
    }
    
    const finalCapId = S.capId;
    const finalCapAns = ($('mgu-cap-in')?.value || '').trim() || S.capAns || '';
    
    if (!finalCapId || !finalCapAns) {
      showErr('Security check failed to load. Please refresh.');
      setBusy(false);
      submitAttempts = 0;
      return;
    }

    setBusy(true);
    const examName = $('mgu-exam-select')?.options[$('mgu-exam-select').selectedIndex]?.text || examId;
    try {
      const d = await api('/api/mgu/fetch-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prn, examId, captchaAnswer: finalCapAns, captchaId: finalCapId })
      });
      if (!d.success) {
        if (d.error === 'CAPTCHA_WRONG') {
          submitAttempts++;
          if (submitAttempts <= 5) {
            showErr(`Verification code incorrect. Retrying automatically (${submitAttempts}/5)...`);
            await loadCaptcha();
            setTimeout(submit, 1000);
            return;
          } else {
            showErr('Verification failed repeatedly. Please enter captcha manually.');
            const capCard = $('mgu-cap-card-container');
            if (capCard) capCard.style.display = 'block';
            submitAttempts = 0;
            return;
          }
        }
        if (d.error === 'NO_RESULT_FOUND' || d.error === 'RESULT_NOT_FOUND' || d.error === 'RECORD_NOT_FOUND') {
          showErr('Result data not found. Please check and select the correct examination from the list.');
          submitAttempts = 0;
          return;
        }
        showErr(d.error || 'Something went wrong. Please try again.');
        submitAttempts = 0;
        return;
      }
      submitAttempts = 0;
      d.result.examName = examName;
      S.result = d.result;
      await firestoreSave(d.result, examId, examName);
      showResultView(d.result);
    } catch (e) {
      console.error('[MGU] submit error:', e);
      const errMsg = e.message || '';
      if (errMsg.includes('NO_RESULT_FOUND') || errMsg.includes('RESULT_NOT_FOUND') || errMsg.includes('RECORD_NOT_FOUND') || errMsg.includes('not found') || errMsg.includes('Status 500')) {
        showErr('Result data not found. Please check and select the correct examination from the list.');
      } else {
        showErr('Network error. Check your connection and try again.');
      }
      submitAttempts = 0;
    } finally {
      if (submitAttempts === 0) {
        setBusy(false);
      }
    }
  }

  /* ── Helpers ─────────────────────────────────────────────────── */
  function $(id) { return document.getElementById(id); }
  async function api(path, opts) {
    const r = await fetch(CF + path, opts);
    if (!r.ok) {
      let errText = r.statusText;
      try {
        const errJson = await r.json();
        errText = errJson.error || errJson.message || errText;
      } catch(_) {}
      throw new Error(errText || `Server returned status ${r.status}`);
    }
    return await r.json();
  }
  function setBusy(v) {
    S.busy = v;
    const btn = $('mgu-submit-btn');
    if (!btn) return;
    btn.disabled = v;
    btn.innerHTML = v
      ? `<span class="mgu2-spin"></span> Fetching…`
      : `<span>🎓</span> Fetch My Result`;
  }
  function showErr(msg) { const e = $('mgu-err'); if (e) { e.textContent = msg; e.style.display = 'block'; } }
  function clearErr()   { const e = $('mgu-err'); if (e) { e.textContent = ''; e.style.display = 'none'; } }

  /* ── Views ───────────────────────────────────────────────────── */
  function showFormView() {
    S.result = null;
    const fv = $('mgu-form-view'), rv = $('mgu-result-view');
    if (fv) fv.style.display = 'block';
    if (rv) rv.style.display = 'none';
    clearErr();
    loadCaptcha();
    const pc = document.getElementById('view-seats');
    if (pc) pc.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showResultView(result) {
    const fv = $('mgu-form-view'), rv = $('mgu-result-view');
    if (fv) fv.style.display = 'none';
    if (rv) { rv.style.display = 'block'; renderResult(result); }
    const pc = document.getElementById('view-seats');
    if (pc) pc.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ── Result Render ───────────────────────────────────────────── */
  function renderResult(r) {
    const rv = $('mgu-result-view'); if (!rv) return;
    const pass = (r.overallResult || '').toUpperCase().includes('PASS');
    const pc = pass ? '#30d158' : '#ff453a';
    const pb = pass ? 'rgba(48,209,88,0.12)' : 'rgba(255,69,58,0.12)';

    const localProfile = window.getStudentInfo?.() || {};
    const localName = localProfile.name || localProfile.studentName || '';
    const studentNameVal = (r.studentName || localName || 'ABEN SOJAN').toUpperCase();

    const subjects = (r.subjects || []);
    const rows = subjects.map(s => {
      const sp = (s.result || '').toUpperCase().includes('PASS');
      const sc = sp ? '#30d158' : '#ff453a';
      
      const intObt = s.theoryInternal !== '' ? s.theoryInternal : (s.practInternal !== '' ? s.practInternal : '—');
      const intMax = s.theoryInternalMax !== '' ? s.theoryInternalMax : (s.practInternalMax !== '' ? s.practInternalMax : '');
      const intMark = intMax ? `${intObt}/${intMax}` : intObt;
      
      const extObt = s.theoryExternal !== '' ? s.theoryExternal : (s.practExternal !== '' ? s.practExternal : '—');
      const extMax = s.theoryExternalMax !== '' ? s.theoryExternalMax : (s.practExternalMax !== '' ? s.practExternalMax : '');
      const extMark = extMax ? `${extObt}/${extMax}` : extObt;

      const tot      = s.totalMark || '—';
      const totMax   = s.totalMarkMax ? `/${s.totalMarkMax}` : '';
      const creditsStr = (s.acquiredCredits !== undefined && s.totalCredits !== undefined) 
        ? `${s.acquiredCredits}/${s.totalCredits}` 
        : (s.credits || '—');
      const gp = s.gradePoints || '—';
      const cp = s.creditPoint || '—';

      return `<tr>
        <td class="mgu2-tc" style="padding:11px 10px;">
          <div style="font-weight:700;color:#f5f5f7;font-size:12px;">${s.code || '—'}</div>
          <div style="font-size:10px;color:#86868b;margin-top:2px;">${s.category || ''}</div>
        </td>
        <td class="mgu2-tc" style="padding:11px 10px;color:#f5f5f7;font-size:12px;">${s.name || '—'}</td>
        <td class="mgu2-tc mgu2-tc-r" style="padding:11px 10px;font-weight:600;color:#e5e7eb;">${creditsStr}</td>
        <td class="mgu2-tc mgu2-tc-r" style="padding:11px 10px;">${intMark}</td>
        <td class="mgu2-tc mgu2-tc-r" style="padding:11px 10px;">${extMark}</td>
        <td class="mgu2-tc mgu2-tc-r" style="padding:11px 10px;font-weight:800;color:#f5f5f7;">${tot}${totMax}</td>
        <td class="mgu2-tc mgu2-tc-r" style="padding:11px 10px;font-weight:800;color:#3897f0;">${s.grade || '—'}</td>
        <td class="mgu2-tc mgu2-tc-r" style="padding:11px 10px;color:#e5e7eb;">${gp}</td>
        <td class="mgu2-tc mgu2-tc-r" style="padding:11px 10px;color:#e5e7eb;">${cp}</td>
        <td class="mgu2-tc mgu2-tc-r" style="padding:11px 10px;font-weight:900;color:${sc};">${sp ? 'PASS' : 'FAIL'}</td>
      </tr>`;
    }).join('');

    // Credit summary
    const totalCredits = subjects.reduce((a, s) => a + (parseFloat(s.totalCredits) || 0), 0);
    const acqCredits   = subjects.reduce((a, s) => a + (parseFloat(s.acquiredCredits) || 0), 0);

    rv.innerHTML = `
      <!-- Back btn -->
      <div style="margin-bottom:20px;">
        <button onclick="window.mguShowForm()" style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#f5f5f7;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer;">
          ← Back to Lookup
        </button>
      </div>

      <!-- Hero result card -->
      <div style="background:linear-gradient(135deg,rgba(99,102,241,0.15) 0%,rgba(168,85,247,0.1) 100%);border:1px solid rgba(99,102,241,0.25);border-radius:24px;padding:24px;margin-bottom:16px;position:relative;overflow:hidden;">
        <div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;background:radial-gradient(circle,rgba(99,102,241,0.2),transparent);border-radius:50%;"></div>
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div>
            <div style="font-size:11px;font-weight:800;color:#818cf8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">MGU University Result</div>
            <div style="font-size:22px;font-weight:900;color:#f5f5f7;line-height:1.2;">${studentNameVal}</div>
            <div style="margin-top:8px;display:flex;flex-direction:column;gap:3px;">
              ${r.prn ? `<div style="font-size:12px;color:#86868b;font-weight:600;">PRN: <span style="color:#d1d5db;">${r.prn}</span></div>` : ''}
              ${r.registerNumber ? `<div style="font-size:12px;color:#86868b;font-weight:600;">Reg No: <span style="color:#d1d5db;">${r.registerNumber}</span></div>` : ''}
              <div style="font-size:11px;color:#86868b;font-weight:600;margin-top:2px;">${r.examName || ''}</div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex-shrink:0;">
            <span style="display:inline-block;padding:7px 18px;border-radius:30px;font-size:14px;font-weight:900;color:${pc};background:${pb};border:1.5px solid ${pc}60;">${pass ? '✓ PASS' : '✗ FAIL'}</span>
          </div>
        </div>

        <!-- SGPA / CGPA / Credits -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:20px;">
          <div style="text-align:center;background:rgba(0,0,0,0.25);border-radius:14px;padding:14px 8px;">
            <div style="font-size:28px;font-weight:900;color:#3897f0;line-height:1;">${r.sgpa || '—'}</div>
            <div style="font-size:9px;font-weight:800;color:#86868b;text-transform:uppercase;letter-spacing:0.08em;margin-top:4px;">SGPA</div>
          </div>
          <div style="text-align:center;background:rgba(0,0,0,0.25);border-radius:14px;padding:14px 8px;">
            <div style="font-size:28px;font-weight:900;color:#3897f0;line-height:1;">${r.cgpa || '—'}</div>
            <div style="font-size:9px;font-weight:800;color:#86868b;text-transform:uppercase;letter-spacing:0.08em;margin-top:4px;">CGPA</div>
          </div>
          <div style="text-align:center;background:rgba(0,0,0,0.25);border-radius:14px;padding:14px 8px;">
            <div style="font-size:22px;font-weight:900;color:#30d158;line-height:1;">${acqCredits}<span style="font-size:13px;color:#86868b;">/${totalCredits}</span></div>
            <div style="font-size:9px;font-weight:800;color:#86868b;text-transform:uppercase;letter-spacing:0.08em;margin-top:4px;">Credits</div>
          </div>
        </div>
      </div>

      <!-- Subject marks table -->
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:20px;margin-bottom:16px;overflow:hidden;">
        <div style="padding:14px 16px 10px;border-bottom:1px solid rgba(255,255,255,0.06);">
          <span style="font-size:10px;font-weight:800;color:#86868b;text-transform:uppercase;letter-spacing:0.1em;">Subject-wise Marks</span>
        </div>
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
          <table style="width:100%;border-collapse:collapse;min-width:700px;">
            <thead>
              <tr style="background:rgba(255,255,255,0.02);">
                <th class="mgu2-th">Code</th>
                <th class="mgu2-th">Subject</th>
                <th class="mgu2-th mgu2-th-r">Credits</th>
                <th class="mgu2-th mgu2-th-r">Internal</th>
                <th class="mgu2-th mgu2-th-r">External</th>
                <th class="mgu2-th mgu2-th-r">Total</th>
                <th class="mgu2-th mgu2-th-r">Grade</th>
                <th class="mgu2-th mgu2-th-r">GP</th>
                <th class="mgu2-th mgu2-th-r">CP</th>
                <th class="mgu2-th mgu2-th-r">Result</th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="10" style="padding:20px;text-align:center;color:#86868b;font-size:13px;">No subject data available</td></tr>'}</tbody>
          </table>
        </div>
      </div>

      <!-- Action buttons -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;">
        <button onclick="window.mguDownloadPdf()" style="flex:1;min-width:120px;display:inline-flex;align-items:center;justify-content:center;gap:6px;background:#3897f0;color:#fff;border:none;border-radius:12px;padding:12px 16px;font-size:13px;font-weight:800;cursor:pointer;">
          📄 Download PDF
        </button>
        <button onclick="window.mguShare()" style="flex:1;min-width:100px;display:inline-flex;align-items:center;justify-content:center;gap:6px;background:rgba(255,255,255,0.07);color:#f5f5f7;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:12px 16px;font-size:13px;font-weight:800;cursor:pointer;">
          🔗 Share
        </button>
        <button onclick="window.mguShowForm()" style="flex:1;min-width:120px;display:inline-flex;align-items:center;justify-content:center;gap:6px;background:rgba(255,255,255,0.07);color:#f5f5f7;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:12px 16px;font-size:13px;font-weight:800;cursor:pointer;">
          🔄 Check Another
        </button>
      </div>`;
  }

  /* ── History Render ─────────────────────────────────────────── */
  function renderHistory() {
    const el = $('mgu-history'); if (!el) return;
    if (!S.history.length) {
      el.innerHTML = `<p style="text-align:center;color:#86868b;font-size:13px;padding:20px 0;">No results fetched yet.</p>`;
      return;
    }
    el.innerHTML = S.history.map((h, i) => {
      const r = h.result || {};
      const pass = (r.overallResult || '').toUpperCase().includes('PASS');
      const pc = pass ? '#30d158' : '#ff453a';
      const date = h.fetchedAt?.seconds
        ? new Date(h.fetchedAt.seconds * 1000).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
        : '—';
      return `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:800;color:#f5f5f7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${h.examName || '—'}</div>
          <div style="font-size:11px;color:#86868b;margin-top:3px;font-weight:600;">SGPA ${r.sgpa || '—'} &nbsp;·&nbsp; ${date}</div>
        </div>
        <span style="font-size:11px;font-weight:900;color:${pc};background:${pc}18;border:1px solid ${pc}40;padding:3px 10px;border-radius:20px;flex-shrink:0;">${pass ? 'PASS' : 'FAIL'}</span>
        <button onclick="window.mguViewHist(${i})" style="flex-shrink:0;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f5f5f7;font-size:11px;font-weight:700;padding:5px 10px;cursor:pointer;">View</button>
      </div>`;
    }).join('');
  }

  /* ── PDF ────────────────────────────────────────────────────── */
  function buildPdf(r) {
    const pass = (r.overallResult || '').toUpperCase().includes('PASS');
    const localProfile = window.getStudentInfo?.() || {};
    const localName = localProfile.name || localProfile.studentName || '';
    const studentNameVal = (r.studentName || localName || 'ABEN SOJAN').toUpperCase();
    const logoUrl = window.location.origin + '/assets/img/mgu_logo.png';

    const rows = (r.subjects || []).map(s => {
      const hasTheory = s.type === 'T' || s.type === 'B';
      const hasPractical = s.type === 'P' || s.type === 'B';

      const creditsT = hasTheory ? (s.credits || '4') : '-';
      const creditsP = hasPractical ? (s.totalCredits ? String(parseFloat(s.totalCredits) - parseFloat(s.credits || 0)) : '1') : '-';

      const tCCA = hasTheory && s.theoryInternal !== '' ? s.theoryInternal : '-';
      const tCCAMax = hasTheory && s.theoryInternalMax !== '' ? s.theoryInternalMax : '-';
      const tESE = hasTheory && s.theoryExternal !== '' ? s.theoryExternal : '-';
      const tESEMax = hasTheory && s.theoryExternalMax !== '' ? s.theoryExternalMax : '-';
      const tScore = hasTheory && s.theoryTotal !== '' ? s.theoryTotal : '-';
      const tMax = hasTheory && s.theoryTotalMax !== '' ? s.theoryTotalMax : '-';
      const tResult = hasTheory ? (s.theoryResult || 'Pass') : '-';

      const pCCA = hasPractical && s.practInternal !== '' ? s.practInternal : '-';
      const pCCAMax = hasPractical && s.practInternalMax !== '' ? s.practInternalMax : '-';
      const pESE = hasPractical && s.practExternal !== '' ? s.practExternal : '-';
      const pESEMax = hasPractical && s.practExternalMax !== '' ? s.practExternalMax : '-';
      const pScore = hasPractical && s.practTotal !== '' ? s.practTotal : '-';
      const pMax = hasPractical && s.practTotalMax !== '' ? s.practTotalMax : '-';
      const pResult = hasPractical ? (s.practResult || 'Pass') : '-';

      const totMarks = s.totalMark || '-';
      const totMax = s.totalMarkMax || '-';
      const grade = s.grade || '-';
      const gp = s.gradePoints || '-';
      const acqCredits = s.acquiredCredits !== undefined ? s.acquiredCredits : '-';
      const cp = s.creditPoint || '-';
      const overRes = s.result || 'Pass';

      return `<tr>
        <td>${s.category || 'CCR'}</td>
        <td class="left-align">${s.code || ''} - ${s.name || ''}</td>
        <td>${creditsT}</td>
        <td>${creditsP}</td>
        
        <td>${tCCA}</td>
        <td>${tCCAMax}</td>
        <td>${tESE}</td>
        <td>${tESEMax}</td>
        <td>${tScore}</td>
        <td>${tMax}</td>
        <td>${tResult}</td>

        <td>${pCCA}</td>
        <td>${pCCAMax}</td>
        <td>${pESE}</td>
        <td>${pESEMax}</td>
        <td>${pScore}</td>
        <td>${pMax}</td>
        <td>${pResult}</td>

        <td>${totMarks}</td>
        <td>${totMax}</td>
        <td>${grade}</td>
        <td>${gp}</td>
        <td>${acqCredits}</td>
        <td>${cp}</td>
        <td>${overRes}</td>
      </tr>`;
    }).join('');

    const formattedExamName = (r.examName || 'SECOND SEMESTER MGU-BBA(HONOURS)/MGU-BCA (HONOURS) REGULAR EXAMINATION').toUpperCase();
    const formattedDate = new Date().toLocaleDateString('en-GB') + ', ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>MGU Result — ${studentNameVal}</title>
  <style>
    @media print {
      body { padding: 0; margin: 0; }
      .no-print { display: none !important; }
    }
    body {
      font-family: Arial, sans-serif;
      color: #000;
      background: #fff;
      padding: 20px;
      line-height: 1.2;
      font-size: 11px;
    }
    .header-container {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 15px;
      position: relative;
    }
    .header-logo {
      position: absolute;
      left: 10px;
      height: 80px;
      width: auto;
    }
    .header-text {
      text-align: center;
    }
    .header-text h1 {
      font-size: 16px;
      margin: 0 0 3px 0;
      font-weight: bold;
      letter-spacing: 0.5px;
    }
    .header-text h2 {
      font-size: 10px;
      margin: 0 0 3px 0;
      font-weight: normal;
    }
    .header-text h3 {
      font-size: 10px;
      margin: 0 0 5px 0;
      font-weight: normal;
    }
    .header-text h4 {
      font-size: 11px;
      margin: 0;
      font-weight: bold;
    }
    .meta-section {
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      padding: 8px 0;
      margin-bottom: 15px;
      font-size: 12px;
      line-height: 1.5;
    }
    .meta-line {
      font-weight: bold;
    }
    table.result-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
      margin-bottom: 15px;
    }
    table.result-table th, table.result-table td {
      border: 1px solid #888;
      padding: 5px 3px;
      text-align: center;
      vertical-align: middle;
    }
    table.result-table th {
      background: #fff;
      font-weight: bold;
      font-size: 9px;
    }
    table.result-table td.left-align {
      text-align: left;
      padding-left: 5px;
    }
    .footnote-section {
      font-size: 9px;
      color: #000;
      line-height: 1.3;
      margin-bottom: 30px;
    }
    .footnote-section p {
      margin: 3px 0;
    }
    .footer-container {
      text-align: center;
      font-size: 9px;
      color: #444;
      border-top: 1px solid #ccc;
      padding-top: 8px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="header-container">
    <img src="${logoUrl}" class="header-logo" alt="MGU Logo">
    <div class="header-text">
      <h1>MAHATMA GANDHI UNIVERSITY</h1>
      <h2>(Established by Kerala State Legislature by Notification No.3431/Leg.C1/B5/Law, dated 17th April 1985)</h2>
      <h3>Kottayam, Kerala</h3>
      <h4>${formattedExamName}</h4>
    </div>
  </div>

  <div class="meta-section">
    <div class="meta-line">Name: ${studentNameVal} | PRN: ${r.prn || '—'}</div>
    <div class="meta-line">College : ${r.college || 'Mar Augusthinose College, Ramapuram Bazar P.O'}</div>
    <div class="meta-line">Programme : ${r.programme || 'Bachelor in Computer Applications (Honours)'}</div>
  </div>

  <table class="result-table">
    <thead>
      <tr>
        <th rowspan="2">Category</th>
        <th rowspan="2" style="width: 20%;">Course</th>
        <th colspan="2">Credits</th>
        <th colspan="7">Theory</th>
        <th colspan="7">Practical</th>
        <th rowspan="2">Candidate Total Marks</th>
        <th rowspan="2">Maximum marks</th>
        <th rowspan="2">Grade</th>
        <th rowspan="2">Grade Points</th>
        <th rowspan="2">Acquired Credits</th>
        <th rowspan="2">Credit Point</th>
        <th rowspan="2">Overall Result</th>
      </tr>
      <tr>
        <th>T</th>
        <th>P</th>
        <th>CCA</th>
        <th>CCA Max</th>
        <th>ESE</th>
        <th>ESE Max</th>
        <th>Candidate Score</th>
        <th>Theory Maximum</th>
        <th>Theory Result</th>
        <th>CCA</th>
        <th>CCA Max</th>
        <th>ESE</th>
        <th>ESE Max</th>
        <th>Candidate Score</th>
        <th>Practical Maximum</th>
        <th>Practical Result</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="footnote-section">
    <p>Grade : A+-Excellent, A-Very Good, B+-Good, B-Above Average, C+-Average, C-Satisfactory, D-Pass, F-Failure, Ab-Absent</p>
    <p>*The results presented on this webpage are provisional. If discrepancies are found during the verification of qualifying certificates provided by the student, the published results will be considered invalid.</p>
    <p>* The results available through the web are intended only to provide immediate information to the examinees. They are not a substitute for the original mark lists/ grade sheets issued to the candidates. Mahatma Gandhi University reserves the right to update the contents of the web pages without notice.</p>
  </div>

  <div class="footer-container">
    <p>© Mahatma Gandhi University, Priyadarsini Hills, Kottayam, Kerala, India - 686560</p>
    <p>System Generated Report | ${formattedDate}</p>
  </div>
</body>
</html>`;
  }

  /* ── Public API ─────────────────────────────────────────────── */
  window.mguShowForm    = showFormView;
  window.mguViewHist    = (i) => { const h = S.history[i]; if (h) { S.result = h.result; showResultView(h.result); } };
  window.mguDownloadPdf = () => {
    if (!S.result) return;
    const w = window.open('', '_blank');
    if (!w) { toast('Allow popups to download PDF', 'error'); return; }
    w.document.write(buildPdf(S.result)); w.document.close(); w.focus();
    setTimeout(() => w.print(), 400);
  };
  window.mguShare = () => {
    const r = S.result; if (!r) return;
    const txt = `📊 MGU Result — ${r.examName}\n👤 ${r.studentName} (PRN: ${r.prn})\n📈 SGPA: ${r.sgpa}  CGPA: ${r.cgpa}\n${(r.overallResult||'').toUpperCase().includes('PASS') ? '✅ PASS' : '❌ FAIL'}\n\nChecked via MacHub`;
    if (navigator.share) navigator.share({ title: 'MGU Result', text: txt }).catch(() => {});
    else navigator.clipboard.writeText(txt).then(() => toast('Result copied to clipboard!', 'success'));
  };
  window.mguLoadCaptcha = loadCaptcha;
  window.mguSubmit      = submit;
  window.mguSavePrnOnInput = savePrnToLocalAndRemote;
  window.mguManualSave  = async () => {
    const en = $('mgu-manual-exam')?.value?.trim() || '';
    const sg = $('mgu-manual-sgpa')?.value?.trim() || '';
    const cg = $('mgu-manual-cgpa')?.value?.trim() || '';
    const ov = $('mgu-manual-result')?.value || 'PASS';
    if (!en) { toast('Enter the exam name', 'error'); return; }
    const btn = $('mgu-manual-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    const r = { examName: en, sgpa: sg, cgpa: cg, overallResult: ov, subjects: [], studentName: '', prn: profilePrn() || '', registerNumber: '' };
    await firestoreSave(r, '', en);
    toast('Result saved!', 'success');
    ['mgu-manual-exam','mgu-manual-sgpa','mgu-manual-cgpa'].forEach(id => { const el = $(id); if (el) el.value = ''; });
    if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
  };

  /* ── Page Init ─────────────────────────────────────────────── */
  window.initMguPage = async function () {
    if (S.result) {
      showResultView(S.result);
      return;
    }
    // Reset to form view
    showFormView();

    // PRN auto-fill
    const prn = profilePrn();
    const prnIn = $('mgu-prn-in');
    const prnHint = $('mgu-prn-hint');
    if (prnIn) {
      if (prn) {
        prnIn.value = prn;
        if (prnHint) { prnHint.textContent = '✓ Auto-filled from your college profile'; prnHint.style.color = '#30d158'; }
      } else {
        prnIn.placeholder = 'Enter your PRN';
        if (prnHint) { prnHint.textContent = 'PRN not found in profile — enter manually'; prnHint.style.color = '#86868b'; }
      }
    }

    // Load in parallel
    await Promise.all([loadExams(), loadCaptcha(), firestoreLoad()]);
  };

  // Keep backward compat
  window.initMguResultPage = window.initMguPage;

})();
