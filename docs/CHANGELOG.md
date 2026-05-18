# 📝 MacHub Changelog: The Definitive Log

All notable changes to the MacHub project are tracked here with precision timestamps.

---

## [v1.2.0] - 2026-05-19
### 📂 Major Structural Reorganization (Final Perfection)
- **[01:27:14 AM]** Created centralized `/assets` directory to house all non-code resources.
- **[01:27:15 AM]** Created `/assets/img` and migrated all logos from the legacy `/Logo` folder.
- **[01:27:16 AM]** Created `/assets/docs` and migrated academic PDF documents for better isolation.
- **[01:27:18 AM]** Created `/data/common` and migrated all global data scripts (timetables, student DBs) to clean up the data root.
- **[01:37:42 AM]** Created `/docs/dev-utilities` and migrated all developer scripts (formerly in `/scratch`).
- **[01:40:05 AM]** Universal path patching in `index.html`: Updated 15+ links to match the new optimized directory structure.
- **[01:42:00 AM]** Full Cleanup: Deleted empty legacy directories (`/Logo`, `/scratch`, `/Exam full detailed time table`).

---

## [v1.1.0] - 2026-05-18
### 🏗️ Architecture & Navigation
- **[11:32:04 PM]** Unified "Exam Hub": Merged separate Timetable and Seating views into a single, high-performance DOM container.
- **[11:35:12 PM]** Implemented `switchExamTab()`: A custom JS engine that swaps content instantly inside the main glass panel without re-rendering the whole page.
- **[11:38:45 PM]** Integrated dynamic "Result" placeholder view to prevent broken links in the exam sub-navigation.

### 🛡️ Core Reliability & Bug Fixes
- **[11:45:22 PM]** Fixed critical syntax error in `js/app.js` (extra closing bracket) that was bricking the entire JS execution.
- **[11:48:10 PM]** Refactored `applyUserProfile()`: Added defensive coding to handle "Guest" or incomplete profiles without UI artifacts.

### ✨ Branding & Aesthetics
- **[10:15:30 PM]** Replaced 100% of text-based "MacHub" logos with the high-resolution transparent PNG.
- **[10:20:45 PM]** Centered and scaled home page logo to exactly 160px for a premium mobile-first look.
- **[10:33:49 PM]** Set custom Apple-standard app icon and enabled standalone PWA meta-tags for iOS.

---

## [v1.0.0] - 2026-05-17 (Baseline)
- Initial deployment of the Apple-inspired Exam Seating & Student Information System.
- Basic support for BCA/BBA/BSW seating arrangements.
