# 🐛 MacHub Bug & Resolution Tracker

A detailed history of every technical issue found and the exact steps taken to ensure it never returns.

---

## 🛠️ Resolved Issues

### BUG-0001: Onboarding Crash (JS Bricked)
- **Date Found:** 18-05-2026 @ 11:43:10 PM
- **Status:** ✅ Fixed & Verified
- **Severity:** 🔥 Critical
- **Issue Description:** Clicking the "Skip" button did nothing. The entire onboarding flow was non-responsive.
- **Steps to Reproduce:** Open `index.html` as a new user (empty local storage) and try to click any interactive button.
- **Root Cause:** A stray `});` was left at the tail end of `js/app.js` during a code injection. Browsers (Chrome/Safari) aborted script execution immediately upon encountering the syntax error.
- **Resolution:**
  1. Performed a surgical read of the file tail.
  2. Identified the unbalanced closing brace.
  3. Replaced the corrupted block with a cleaned function closing.
- **Fixed By:** Gemini AI
- **Date Fixed:** 18-05-2026 @ 11:45:22 PM

### BUG-0002: Guest UI Rendering Error
- **Date Found:** 18-05-2026 @ 11:47:05 PM
- **Status:** ✅ Fixed
- **Severity:** ⚠️ Medium
- **Issue Description:** Users who skipped onboarding saw "undefined" or empty placeholders for Department and Hall.
- **Root Cause:** `applyUserProfile` was accessing properties on `getStudentInfo()` without checking if the object existed or had those keys (e.g., `info.dept`).
- **Resolution:** 
  - Injected ternary fallbacks in `js/app.js`: `info.dept || 'General'`.
  - Added CSS opacity logic to dim "Not set" fields.
- **Fixed By:** Gemini AI
- **Date Fixed:** 18-05-2026 @ 11:48:10 PM

### BUG-0003: Logo Image Padding Overflow
- **Date Found:** 18-05-2026 @ 10:18:12 PM
- **Status:** ✅ Fixed
- **Severity:** 🟢 Low
- **Issue Description:** The original logo had massive black gutters, making the header look disproportionately large.
- **Resolution:** 
  - Requested a tightly cropped PNG.
  - Updated global `.brand-logo` CSS to `mix-blend-mode: screen` and set hard widths.
- **Fixed By:** Gemini AI
- **Date Fixed:** 18-05-2026 @ 10:20:45 PM

---

## 📝 Bug Reporting Protocol
When adding a new bug, you **MUST** include:
1. Exact timestamp of discovery.
2. The "Resolution" section must specify which lines in which files were changed.
3. If a bug is recurring, it must be escalated to a Architectural Refactor.
