# MacHub - Exam Management & Seating System

MacHub is an Apple-inspired single-page web app that helps students track their exam timetables, find their seating arrangements, and manage their academic schedules.

## Key Features

- **Student Finder:** Type your name, Admin No, or Reg No and your profile loads straight away, already synced.
- **Exam Timetables:** Tracks completed, live, and upcoming exams, and counts down to the next one automatically.
- **Seating Locator:** A visual map of exam halls, blocks, and rows, so you can find your exact seat. Gesture-based navigation.
- **Apple-Inspired UI:** Liquid-glass look, spring animations, floating navigation pills, and dark mode support.
- **Daily Notification:** A warning popup about seating arrangements, shown once a day when you open the exam seating view.

## Tech Stack

- **Frontend:** HTML5, Vanilla JavaScript, CSS (Custom styling + Tailwind CSS for utility classes)
- **Data Management:** LocalStorage for caching user profiles and states.
- **Backend (Optional/Scraper):** Node.js scraper (Playwright) located in `MAC-EXAM-Hub-Scraper/` to fetch live data from the college portal.

## Project Structure

- `index.html`: The main SPA shell containing all views (Home, Timetable, Seats, Resources).
- `js/`: Core application logic.
  - `app.js`: Main UI interactions, routing, countdowns, and rendering logic.
  - `onboarding.js`: Handles the Student Finder and profile setup.
  - `seats.js`: Generates the seating arrangement UI.
- `styles/`: CSS stylesheets.
  - `base.css`: Core design system, animations, and typography.
  - `tailwind.css`: Utility classes.
- `data/`: Static data files for testing and offline usage.
  - `timetable_bca.js`, `timetable_bba.js`: Department-specific schedules.
  - `student_names.js`, `students_db.js`: Mock databases for the Student Finder.
- `MAC-EXAM-Hub-Scraper/`: The backend scraper system for live data.

## Recent Updates & Bug Fixes

- **Removed Profile & Academic Sheets:** Stripped out the "Edit Profile" and "Academic Info" bottom sheets to streamline the UI and simplify user flow. Removed all associated entry points (buttons and hamburger menus).
- **Cleaned Exam Navigation:** Removed the generic "Resources" tab from the Exam sub-navigation menu to prevent confusing double-routing.
- **Theory Completed Message:** Removed the "Theory Completed / Practical Exams Switch" panel from the timetable view to reduce visual clutter.
- **Fixed Exam Card Overflows:** Adjusted CSS grid and flex layouts so that exam subjects fit perfectly inside their cards without clipping on mobile screens.
- **Grid Layout Adjustments:** Updated the home dashboard layout so the "Location" card smoothly spans across two columns after removing the profile card.
- **Daily Note Popup:** Refined the seat warning notification to only appear once per day when the user specifically accesses the seating map.

## Instructions to Update Data

### Updating Timetables
To update the exam schedule for a department:
1. Open the corresponding file in the `data/` folder (e.g., `data/timetable_bca.js`).
2. Update the array of exam objects.
   ```javascript
   {
       date: '2026-05-15T09:30:00+05:30', // Use IST timezone
       title: 'New Subject Name',
       code: 'SUB101',
       type: 'theory' // or 'practical'
   }
   ```
3. The app will automatically read this data and update the countdowns and UI markers based on the current live time.

### Updating Student Data for Student Finder
1. Open `data/students_db.js` or `data/student_names.js`.
2. Add or modify student entries in the JSON array. Make sure the `name`, `regNo`, and `adminNo` fields are accurate so the Student Finder can index them.

### Running the App Locally
Since it's a Vanilla JS app without a heavy framework, you can simply serve the directory using any local web server:
- Using Python: `python -m http.server 8000`
- Using Node.js: `npx serve .`

Open `http://localhost:8000` (or the port provided) in your browser.

## Student Ledger Sync

The project has a sync engine (`sync_ledger.py`) with a GitHub Actions workflow (`.github/workflows/annual_sync.yml`) that keeps Firestore data up to date.

### How it runs
- **Walks both ways:** Starting from a pivot admission number, the script walks backwards and forwards to discover and parse student records.
- **Stops on its own:** The walker stops in a direction after hitting **50 consecutive invalid logins**, so it can't scan forever.

### Passed-out (graduated) students
- **Year check:** The sync engine leaves out passed-out students. After scraping a student's profile, it checks their `batch` end year (e.g., `2021 - 2024` ends in 2024).
- **The rule:** If the batch end year is before the current calendar year (e.g., `2024 < 2026`), the student counts as graduated, and their records are **skipped** instead of being written to Cloud Firestore.

## Maintenance Notes
- **UI Modifications:** If you add new buttons or cards to `index.html`, make sure to add the `.spring` and `.liquid-button` (or `.glass-panel`) classes to maintain the Apple-inspired animations and styling.
- **Mobile Optimization:** The app relies heavily on `max-w-md mx-auto` to simulate a mobile app feel on desktop browsers. Always test UI changes on smaller viewport widths (e.g., 375px or 390px).
