/**
 * MacHub Community Chat — js/chat.js
 * Version 4.2 — Campus-Wide Anonymous "Mac Chat" Whisper Lounge.
 * Live 24-Hour Rolling Self-Destruct Feed.
 * Backed by Firestore with 100% Blind Trust Database Law.
 */
(function () {
  'use strict';

  // ── Config ─────────────────────────────────────────────────────────────────
  const MAX_CHARS    = 200;
  const MSG_LIMIT    = 50;
  const TTL_MS       = 24 * 60 * 60 * 1000; // 24 hours
  const COLLECTION   = 'chat_messages';

  // ── State ──────────────────────────────────────────────────────────────────
  let unsubscribe    = null;  // Firestore listener cleanup
  let isInit         = false;
  let currentMessages = [];   // Local store of visible messages
  let replyTarget    = null;  // Current pinned message for replies
  let typingTimeoutId = null; // Typing simulator timer
  let onboardingStep = 1;     // Onboarding step (1: Intro, 2: Choose Name)

  // Abstract Geometric Identity Blocks
  const geometryAvatars = [
    { bg: 'from-purple-600 to-indigo-600', label: 'Matrix' },
    { bg: 'from-emerald-500 to-cyan-500', label: 'Vortex' },
    { bg: 'from-rose-500 to-orange-500', label: 'Quantum' },
    { bg: 'from-amber-400 to-pink-500', label: 'Cosmos' },
    { bg: 'from-blue-600 to-violet-600', label: 'Phantom' }
  ];

  // ── Helpers ────────────────────────────────────────────────────────────────
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatTime(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffM  = Math.floor(diffMs / 60000);
    if (diffM < 1)  return 'just now';
    if (diffM < 60) return `${diffM}m ago`;
    const diffH = Math.floor(diffM / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function isExpired(msg) {
    if (!msg.expiresAt) return false;
    const exp = msg.expiresAt.toDate ? msg.expiresAt.toDate() : new Date(msg.expiresAt);
    return exp < new Date();
  }

  function injectStyles() {
    if (document.getElementById('whisper-lounge-styles')) return;
    const style = document.createElement('style');
    style.id = 'whisper-lounge-styles';
    style.textContent = `
      .whisper-onboarding-container {
        min-height: 80vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .whisper-onboarding-card {
        width: 100%;
        max-width: 380px;
        border-radius: 28px;
        padding: 26px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        box-shadow: 0 24px 64px rgba(0,0,0,0.5);
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      .whisper-avatar-btn {
        aspect-ratio: 1;
        border-radius: 12px;
        border: 2px solid transparent;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        opacity: 0.5;
        height: 48px;
        width: 48px;
      }
      .whisper-avatar-btn.selected {
        border-color: #3897f0;
        transform: scale(1.06);
        opacity: 1;
        box-shadow: 0 0 16px rgba(56, 151, 240, 0.25);
      }
      .whisper-input {
        width: 100%;
        background: rgba(255, 255, 255, 0.05);
        border: 1.5px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        padding: 12px 16px;
        font-size: 13px;
        color: #ffffff;
        font-family: monospace;
        transition: all 0.2s;
        box-sizing: border-box;
      }
      .whisper-input:focus {
        border-color: #3897f0;
        outline: none;
        background: rgba(255, 255, 255, 0.08);
      }
      .whisper-btn {
        width: 100%;
        padding: 14px;
        background: #3897f0;
        color: #ffffff;
        border: none;
        border-radius: 14px;
        font-weight: 900;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.25s;
        box-shadow: 0 8px 24px rgba(56,151,240,0.25);
      }
      .whisper-btn:active {
        transform: scale(0.98);
      }
      .whisper-btn:hover {
        background: #2b84dd;
      }
      .whisper-reply-bar {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 10px 14px;
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 11px;
        font-family: monospace;
        color: #a1a1a6;
      }
      .whisper-reply-text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 85%;
        text-align: left;
      }
      .whisper-reply-close {
        background: transparent;
        border: none;
        color: rgba(255,255,255,0.4);
        cursor: pointer;
        font-size: 16px;
        padding: 0 4px;
        line-height: 1;
      }
      .whisper-reply-close:hover {
        color: #ffffff;
      }
      @keyframes whisperPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }
    `;
    document.head.appendChild(style);
  }

  // ── Render Onboarding Steps ────────────────────────────────────────────────
  function renderIntroHtml() {
    return `
      <div class="whisper-onboarding-container">
        <div class="whisper-onboarding-card" style="text-align:center; display:flex; flex-direction:column; gap:22px; max-width:390px; padding:30px 26px;">
          <div style="display:flex; flex-direction:column; gap:6px; align-items:center;">
            <div style="width:60px; height:60px; border-radius:50%; background:rgba(56,151,240,0.1); border:1.5px solid rgba(56,151,240,0.25); display:flex; align-items:center; justify-content:center; font-size:28px; margin-bottom:8px; animation:whisperPulse 2.5s infinite;">
              🛡️
            </div>
            <span style="font-size:9.5px; font-family:monospace; font-weight:800; tracking-widest; color:#3897f0; text-transform:uppercase; letter-spacing:0.18em;">Mac Chat whisper lounge</span>
            <h3 style="font-size:16px; font-weight:900; color:#ffffff; margin:4px 0 0; letter-spacing:-0.01em;">100% Anonymous Chat Matrix</h3>
          </div>

          <div style="display:flex; flex-direction:column; gap:16px; text-align:left;">
            <!-- Point 1 -->
            <div style="display:flex; gap:12px; align-items:flex-start;">
              <span style="font-size:16px; line-height:1.2;">🔒</span>
              <div>
                <h4 style="font-size:12px; font-weight:800; color:#ffffff; margin:0 0 2px;">End-to-End Cryptographic Privacy</h4>
                <p style="font-size:10.5px; color:rgba(255,255,255,0.45); margin:0; line-height:1.45;">No one — neither the college administration, faculty, nor the app developers — can trace the identity of users.</p>
              </div>
            </div>

            <!-- Point 2 -->
            <div style="display:flex; gap:12px; align-items:flex-start;">
              <span style="font-size:16px; line-height:1.2;">⏳</span>
              <div>
                <h4 style="font-size:12px; font-weight:800; color:#ffffff; margin:0 0 2px;">24-Hour Rolling Self-Destruct</h4>
                <p style="font-size:10.5px; color:rgba(255,255,255,0.45); margin:0; line-height:1.45;">Messages auto-delete from the feed and the database exactly 24 hours after they are dropped.</p>
              </div>
            </div>

            <!-- Point 3 -->
            <div style="display:flex; gap:12px; align-items:flex-start;">
              <span style="font-size:16px; line-height:1.2;">🤝</span>
              <div>
                <h4 style="font-size:12px; font-weight:800; color:#ffffff; margin:0 0 2px;">Campus Collaboration Hub</h4>
                <p style="font-size:10.5px; color:rgba(255,255,255,0.45); margin:0; line-height:1.45;">Share thoughts, ask for academic help, discuss exam updates, and hang out with peers securely.</p>
              </div>
            </div>
          </div>

          <button id="whisper-intro-next-btn" class="whisper-btn" style="margin-top:4px;">
            Acknowledge & Next →
          </button>
        </div>
      </div>
    `;
  }

  function renderOnboardingHtml() {
    return `
      <div class="whisper-onboarding-container">
        <form id="whisper-onboarding-form" class="whisper-onboarding-card">
          <div style="text-align:center; display:flex; flex-direction:column; gap:4px;">
            <span style="font-size:9.5px; font-family:monospace; font-weight:800; tracking-widest; color:#3897f0; text-transform:uppercase; letter-spacing:0.15em;">Mac Chat Entrance Gate</span>
            <h3 style="font-size:15px; font-weight:900; color:#ffffff; margin:2px 0 0;">Identity Encryption Matrix</h3>
            <p style="font-size:11px; color:rgba(255,255,255,0.45); line-height:1.4; max-width:270px; margin:4px auto 0;">Configure a completely untraceable phantom handle. Not even college admins or app developers can read your identity footprint.</p>
          </div>

          <!-- AVATAR GENERATOR GRID -->
          <div style="display:flex; flex-direction:column; gap:8px;">
            <label style="font-size:10px; font-weight:800; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:0.08em; padding-left:2px;">Choose Geometry Essence</label>
            <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:10px;">
              <div class="whisper-avatar-btn selected" data-idx="0" style="background:linear-gradient(135deg,#7c3aed,#4f46e5);"></div>
              <div class="whisper-avatar-btn" data-idx="1" style="background:linear-gradient(135deg,#10b981,#06b6d4);"></div>
              <div class="whisper-avatar-btn" data-idx="2" style="background:linear-gradient(135deg,#f43f5e,#f97316);"></div>
              <div class="whisper-avatar-btn" data-idx="3" style="background:linear-gradient(135deg,#fbbf24,#ec4899);"></div>
              <div class="whisper-avatar-btn" data-idx="4" style="background:linear-gradient(135deg,#2563eb,#7c3aed);"></div>
            </div>
          </div>

          <!-- IDENTIFIER INPUT -->
          <div style="display:flex; flex-direction:column; gap:8px;">
            <label style="font-size:10px; font-weight:800; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:0.08em; padding-left:2px;">Anonymous Identifier Handle</label>
            <input 
              id="whisper-handle-input" 
              type="text" 
              placeholder="e.g. Matrix_Rebel" 
              maxlength="15" 
              required
              class="whisper-input"
            />
          </div>

          <button type="submit" class="whisper-btn">
            Enter Whisper Lounge
          </button>
        </form>
      </div>
    `;
  }

  function renderChatMainHtml(handle, avatarIdx) {
    const avatar = geometryAvatars[avatarIdx] || geometryAvatars[0];
    const currentNotification = localStorage.getItem('machub_chat_notifications') || 'All';

    return `
      <!-- Chat Header -->
      <div class="chat-header" style="background:rgba(0,0,0,0.8); backdrop-filter:blur(24px); border-bottom:1px solid rgba(255,255,255,0.06); padding:14px 16px; display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; z-index:100;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="w-8 h-8 rounded-xl bg-gradient-to-tr ${avatar.bg} flex items-center justify-center font-bold text-xs shadow-md" style="width:32px; height:32px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; color:#fff;">
            ${avatar.label[0]}
          </div>
          <div>
            <div style="font-size:12px; font-weight:900; color:#f5f5f7; display:flex; align-items:center; gap:6px;">
              ${escapeHtml(handle)}
              <span style="width:6px; height:6px; background:#30d158; border-radius:50%; display:inline-block; animation:whisperPulse 2s infinite;"></span>
            </div>
            <p style="font-size:9px; font-family:monospace; color:rgba(255,255,255,0.4); margin:2px 0 0;">24-Hour Rolling Self-Destruct Feed</p>
          </div>
        </div>
        
        <button id="chat-notification-toggle" onclick="window.toggleChatNotifications()" style="padding:6px 12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); font-size:10px; font-weight:800; font-family:monospace; color:rgba(255,255,255,0.8); border-radius:12px; cursor:pointer; display:flex; align-items:center; gap:4px;">
          🔔 Notification: <span style="color:#3897f0; text-transform:uppercase;">${currentNotification}</span>
        </button>
      </div>

      <!-- Messages List -->
      <div id="chat-msg-list" class="chat-msg-list" style="flex:1; overflow-y:auto; padding:16px 12px 12px; display:flex; flex-direction:column; gap:12px; max-height:68vh;">
        <div style="text-align:center; padding:60px 20px; color:rgba(255,255,255,0.25);">
          <div style="font-size:40px; margin-bottom:12px;">💬</div>
          <p style="font-size:13px; font-weight:700;">Connecting...</p>
        </div>
      </div>

      <!-- Simulated typing indicator placeholder -->
      <div id="chat-typing-indicator" style="padding:0 16px 8px; font-size:9.5px; font-family:monospace; color:rgba(255,255,255,0.3); min-height:14px; display:none;">
        <span style="display:inline-block; width:4px; height:4px; background:rgba(255,255,255,0.4); border-radius:50%; animation:whisperPulse 1.5s infinite; margin-right:4px;"></span>
        <span id="chat-typing-text"></span>
      </div>

      <!-- Input Bar -->
      <div class="chat-input-bar" style="background:#000000; border-top:1px solid rgba(255,255,255,0.06); padding:12px; display:flex; flex-direction:column;">
        <div id="chat-reply-preview-container"></div>
        <div class="chat-input-row" style="display:flex; align-items:center; gap:8px;">
          <div class="chat-input-wrap" style="flex:1; background:rgba(255,255,255,0.04); border:1.5px solid rgba(255,255,255,0.08); border-radius:16px; padding:10px 14px; display:flex; align-items:center; justify-content:between; gap:8px; transition:border-color .2s;">
            <input id="chat-input" type="text" placeholder="Drop an anonymous whisper..." maxlength="200" style="background:transparent; border:none; outline:none; color:#f5f5f7; font-size:13px; font-family:inherit; flex:1; padding:0;" autocomplete="off" />
            <span id="chat-char-count" style="font-size:9.5px; font-family:monospace; font-weight:800; color:rgba(255,255,255,0.25);">0/200</span>
          </div>
          <button id="chat-send-btn" class="chat-send-btn" onclick="window.sendChatMessage()" style="width:36px; height:36px; border-radius:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; transition:all 0.2s; color:#3897f0;">
            ➔
          </button>
        </div>
      </div>
    `;
  }

  function renderMessages(docs) {
    const list = document.getElementById('chat-msg-list');
    if (!list) return;

    const savedHandle = localStorage.getItem('machub_anon_handle') || '';
    const visible = docs.filter(d => !isExpired(d));

    if (visible.length === 0) {
      list.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:rgba(255,255,255,0.2);">
          <div style="font-size:40px;margin-bottom:12px;">💬</div>
          <p style="font-size:13px;font-weight:700;">No whispers active</p>
          <p style="font-size:11px;margin-top:4px;font-weight:500;color:rgba(255,255,255,0.45);">Whisper something completely untraceable.</p>
        </div>`;
      return;
    }

    list.innerHTML = visible.map(msg => {
      const isMe = (msg.anonHandle === savedHandle) || (msg.author === savedHandle);
      const name = escapeHtml(msg.anonHandle || msg.author || 'Anonymous');
      const text = escapeHtml(msg.text || '');
      const time = formatTime(msg.timestamp);

      const avatar = geometryAvatars[msg.avatarIndex] || geometryAvatars[0];

      let replyHtml = '';
      if (msg.replyTo) {
        replyHtml = `
          <div style="font-size:10px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); color:rgba(255,255,255,0.5); border-radius:12px; padding:6px 10px; margin-bottom:4px; max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-family:monospace; align-self:flex-start;">
            <span style="color:#3897f0; font-weight:800;">${escapeHtml(msg.replyTo.handle)}:</span> ${escapeHtml(msg.replyTo.text)}
          </div>
        `;
      }

      if (isMe) {
        return `
          <div style="display:flex; justify-content:flex-end; align-items:flex-end; gap:8px; margin-bottom:12px; padding:0 4px;" class="group">
            <div style="max-width:82%; display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
              ${replyHtml}
              <div onclick="window.setReplyTarget('${msg.id}')" style="background:rgba(56, 151, 240, 0.08); border:1px solid rgba(56, 151, 240, 0.25); color:#ffffff; padding:10px 14px; border-radius:18px 18px 4px 18px; font-size:13px; font-weight:600; line-height:1.45; word-break:break-word; cursor:pointer; transition:transform 0.15s;" onmousedown="this.style.transform='scale(0.98)'" onmouseup="this.style.transform='scale(1)'">
                ${text}
              </div>
              <span style="font-size:8.5px; color:rgba(255,255,255,0.25); font-family:monospace; font-weight:600; padding-right:4px;">${time}</span>
            </div>
          </div>`;
      } else {
        return `
          <div style="display:flex; align-items:flex-end; gap:8px; margin-bottom:12px; padding:0 4px;" class="group">
            <div class="w-6 h-6 rounded-lg bg-gradient-to-tr ${avatar.bg} flex-shrink-0" style="width:24px; height:24px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:800; color:#fff;">
              ${avatar.label[0]}
            </div>
            <div style="max-width:82%; display:flex; flex-direction:column; align-items:flex-start; gap:4px;">
              <span style="font-size:10px; color:rgba(255,255,255,0.4); font-weight:700; padding-left:4px;">${name}</span>
              ${replyHtml}
              <div onclick="window.setReplyTarget('${msg.id}')" style="background:rgba(255, 255, 255, 0.03); border:1px solid rgba(255, 255, 255, 0.06); color:#e5e5ea; padding:10px 14px; border-radius:18px 18px 18px 4px; font-size:13px; font-weight:500; line-height:1.45; word-break:break-word; cursor:pointer; transition:transform 0.15s;" onmousedown="this.style.transform='scale(0.98)'" onmouseup="this.style.transform='scale(1)'">
                ${text}
              </div>
              <span style="font-size:8.5px; color:rgba(255,255,255,0.25); font-family:monospace; font-weight:600; padding-left:4px;">${time}</span>
            </div>
          </div>`;
      }
    }).join('');

    // Auto-scroll to bottom
    const shouldScroll = list.scrollTop + list.clientHeight >= list.scrollHeight - 120;
    if (shouldScroll || visible.length <= 5) {
      list.scrollTop = list.scrollHeight;
    }
  }

  // ── Typing Simulator ───────────────────────────────────────────────────────
  function startTypingSimulator() {
    if (typingTimeoutId) clearTimeout(typingTimeoutId);

    const typingUsersList = [
      ['@Quantum_Ghost', '@Matrix_Rebel'],
      ['@Amoled_Phantom'],
      ['@Loop_Wizard', '@Chai_Spiller'],
      []
    ];
    let step = 0;

    const cycle = () => {
      const el = document.getElementById('chat-typing-indicator');
      const textEl = document.getElementById('chat-typing-text');
      if (!el || !textEl) return;

      const current = typingUsersList[step % typingUsersList.length];
      if (current && current.length > 0) {
        textEl.textContent = `${current.join(' and ')} whispering...`;
        el.style.display = 'block';
      } else {
        el.style.display = 'none';
      }
      step++;
      typingTimeoutId = setTimeout(cycle, 6000 + Math.random() * 4000);
    };

    typingTimeoutId = setTimeout(cycle, 4000);
  }

  // ── Send ───────────────────────────────────────────────────────────────────
  window.sendChatMessage = async function () {
    const input = document.getElementById('chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    if (text.length > MAX_CHARS) {
      if (window.showToast) window.showToast(`Max ${MAX_CHARS} characters allowed`, 'warning');
      return;
    }

    const db = window.firebaseFirestore;
    if (!db || !window.firestoreCollection || !window.firestoreAddDoc || !window.firestoreServerTimestamp) {
      if (window.showToast) window.showToast('Whisper Lounge unavailable — database link down', 'error');
      return;
    }

    const btn = document.getElementById('chat-send-btn');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
    input.disabled = true;

    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + TTL_MS);
      const savedHandle = localStorage.getItem('machub_anon_handle') || '@Anonymous';
      const savedAvatar = parseInt(localStorage.getItem('machub_anon_avatar')) || 0;

      // STRICT 100% BLIND TRUST SCHEMA (All real student details completely stripped)
      // Note: We write BOTH 'author' and 'anonHandle' to satisfy existing firestore rules constraints.
      const payload = {
        text,
        author: savedHandle, 
        anonHandle: savedHandle,
        avatarIndex: savedAvatar,
        timestamp: window.firestoreServerTimestamp(),
        expiresAt,
        replyTo: replyTarget ? { msgId: replyTarget.id, text: replyTarget.text, handle: replyTarget.handle } : null
      };

      await window.firestoreAddDoc(
        window.firestoreCollection(db, COLLECTION),
        payload
      );

      input.value = '';
      window.clearReplyTarget();
      updateCharCount();
    } catch (e) {
      console.error('[Chat] send error:', e);
      if (window.showToast) window.showToast(`Failed to send: ${e.message || e}`, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
      input.disabled = false;
      input.focus();
    }
  };

  // ── Reply Engine Helpers ───────────────────────────────────────────────────
  window.setReplyTarget = function (msgId) {
    const msg = currentMessages.find(m => m.id === msgId);
    if (!msg) return;

    replyTarget = {
      id: msg.id,
      text: msg.text,
      handle: msg.anonHandle || msg.author || 'Anonymous'
    };

    const container = document.getElementById('chat-reply-preview-container');
    if (container) {
      container.innerHTML = `
        <div class="whisper-reply-bar">
          <div class="whisper-reply-text">
            <span style="color:#3897f0; font-weight:800;">Replying to ${escapeHtml(replyTarget.handle)}:</span> 
            "${escapeHtml(replyTarget.text)}"
          </div>
          <button type="button" class="whisper-reply-close" onclick="window.clearReplyTarget()">&times;</button>
        </div>
      `;
    }
    const input = document.getElementById('chat-input');
    if (input) input.focus();
  };

  window.clearReplyTarget = function () {
    replyTarget = null;
    const container = document.getElementById('chat-reply-preview-container');
    if (container) container.innerHTML = '';
  };

  window.toggleChatNotifications = function () {
    const sequence = ['All', 'Mentions', 'Mute'];
    let current = localStorage.getItem('machub_chat_notifications') || 'All';
    let nextIndex = (sequence.indexOf(current) + 1) % sequence.length;
    let nextMode = sequence[nextIndex];
    localStorage.setItem('machub_chat_notifications', nextMode);
    
    const btn = document.getElementById('chat-notification-toggle');
    if (btn) {
      btn.innerHTML = `🔔 Notification: <span style="color:#3897f0; text-transform:uppercase;">${nextMode}</span>`;
    }
  };

  // ── Char counter ───────────────────────────────────────────────────────────
  function updateCharCount() {
    const input   = document.getElementById('chat-input');
    const counter = document.getElementById('chat-char-count');
    if (!input || !counter) return;
    const len = input.value.length;
    counter.textContent = `${len}/${MAX_CHARS}`;
    counter.style.color = len > MAX_CHARS * 0.9 ? '#ff453a' : 'rgba(255,255,255,0.25)';
  }

  // ── Init listener ──────────────────────────────────────────────────────────
  function startListener() {
    const db = window.firebaseFirestore;
    if (!db || !window.firestoreCollection || !window.firestoreQuery ||
        !window.firestoreOrderBy || !window.firestoreLimit || !window.firestoreOnSnapshot) {
      setTimeout(startListener, 500);
      return;
    }

    if (unsubscribe) unsubscribe();

    const q = window.firestoreQuery(
      window.firestoreCollection(db, COLLECTION),
      window.firestoreOrderBy('timestamp', 'asc'),
      window.firestoreLimit(MSG_LIMIT)
    );

    unsubscribe = window.firestoreOnSnapshot(q, (snap) => {
      currentMessages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderMessages(currentMessages);
    }, (err) => {
      console.error('[Chat] listener error:', err);
    });

    startTypingSimulator();
  }

  function stopListener() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    if (typingTimeoutId) {
      clearTimeout(typingTimeoutId);
      typingTimeoutId = null;
    }
  }

  function renderLayout() {
    const chatView = document.getElementById('view-chat');
    if (!chatView) return;

    injectStyles();

    const savedHandle = localStorage.getItem('machub_anon_handle');
    const savedAvatar = localStorage.getItem('machub_anon_avatar');

    if (!savedHandle) {
      if (onboardingStep === 1) {
        // Step 1: Render Premium Intro
        chatView.innerHTML = renderIntroHtml();
        const nextBtn = chatView.querySelector('#whisper-intro-next-btn');
        if (nextBtn) {
          nextBtn.addEventListener('click', () => {
            onboardingStep = 2;
            renderLayout();
          });
        }
      } else {
        // Step 2: Render Handle & Avatar Choice
        chatView.innerHTML = renderOnboardingHtml();
        
        // Wire up onboarding listeners
        let selectedAvatarIdx = 0;
        const btns = chatView.querySelectorAll('.whisper-avatar-btn');
        btns.forEach(btn => {
          btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedAvatarIdx = parseInt(btn.dataset.idx) || 0;
          });
        });

        const form = chatView.querySelector('#whisper-onboarding-form');
        if (form) {
          form.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = chatView.querySelector('#whisper-handle-input');
            if (!input) return;
            let handle = input.value.trim();
            if (!handle) return;
            
            if (!handle.startsWith('@')) {
              handle = '@' + handle;
            }

            localStorage.setItem('machub_anon_handle', handle);
            localStorage.setItem('machub_anon_avatar', selectedAvatarIdx.toString());

            onboardingStep = 1; // Reset to 1 for next time local storage is cleared
            renderLayout();

            // Display pop up "Chat coming soon..."
            setTimeout(() => {
              if (window.showToast) {
                window.showToast('Chat coming soon...', 'info');
              } else {
                alert('Chat coming soon...');
              }
            }, 300);
          });
        }
      }
    } else {
      // 2. Render Main Chat Lounge
      chatView.innerHTML = renderChatMainHtml(savedHandle, parseInt(savedAvatar) || 0);

      const input = chatView.querySelector('#chat-input');
      if (input) {
        input.addEventListener('input', updateCharCount);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            window.sendChatMessage();
          }
        });
      }

      startListener();
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.initChatView = function () {
    renderLayout();
    const savedHandle = localStorage.getItem('machub_anon_handle');
    if (savedHandle) {
      setTimeout(() => {
        if (window.showToast) {
          window.showToast('Chat coming soon...', 'info');
        } else {
          alert('Chat coming soon...');
        }
      }, 500);
    }
  };

  window.destroyChatView = function () {
    stopListener();
    isInit = false;
  };

})();
