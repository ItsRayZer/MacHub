# 🛠️ MacHub Engineering & Maintenance Guide

Follow these instructions strictly to maintain the project's "Perfect" organizational state.

---

## 📂 Finalized Directory Schema
| Path | Purpose | Update Frequency |
| :--- | :--- | :--- |
| `/assets/img` | Brand assets, icons, and UI images. | Rarely |
| `/assets/docs` | Public academic documents (PDFs). | Per Exam Season |
| `/data/common` | Core DBs (Student names, global timetables). | Monthly |
| `/data/DD_MM_YYYY` | Date-specific seating maps. | Daily (During Exams) |
| `/js` | Modular application logic. | During Dev |
| `/docs` | Documentation and Dev-Utilities. | Every Change |

---

## 🚀 How to Add New Seating Data (Step-by-Step)
1. **Create the Folder**: Build a new directory inside `/data` using the format `DD_MM_YYYY`.
2. **Prepare the Script**: Create `all_depts.js` inside that folder.
3. **Format the Data**: Use the unified object format:
   ```javascript
   (function() {
       window.ALL_DEPTS_DATA = [
           { h: "Hall 1", aud: "Aud A", c: 1, r: 1, l: { d: "BCA", r: "MG..." } }
       ];
   })();
   ```
4. **Register the Day**: Open `js/app.js` and add the new date to the `EXAM_DAYS` constant at the top of the file.

---

## 🎨 UI Consistency Rules
- **Margins/Padding**: Always use Tailwind classes (`p-4`, `mb-6`) inside `index.html`.
- **Transparency**: Every logo MUST use `.logo` or `.brand-logo` classes with `mix-blend-mode: screen`.
- **Transitions**: Every interactive element MUST have the `.spring` class for the Apple-style physical feedback.

---

## 🧹 Maintenance Workflow (The "Perfection" Rule)
Each time you finish a coding session, you **MUST**:
1. Check for any stray files in the root directory.
2. Update `docs/CHANGELOG.md` with timestamps.
3. If a bug was fixed, log it in `docs/BUGS.md`.
4. Ensure `index.html` scripts are ordered: `firebase -> data -> logic -> app -> bootstrap`.
