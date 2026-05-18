# MacHub - Exam Management & Seating System

MacHub is a premium, Apple-inspired single-page web application (SPA) designed to help students track their exam timetables, find their seating arrangements, and manage their academic schedules. 

## 🌟 Key Features

- **Smart Unified Student Finder:** Seamless onboarding experience where students can type their name, Admin No, or Reg No to instantly find and sync their profile.
- **Dynamic Exam Timetables:** Tracks completed, live, and upcoming exams. Automatically computes the countdown to the next exam.
- **Seating Locator:** Beautiful visual map of exam halls, blocks, and rows. Helps students find their exact seat with easy gesture-based navigation.
- **Apple-Inspired UI:** Features liquid-glass aesthetics, spring animations, floating navigation pills, and dark mode support.
- **Daily Notification System:** Displays a friendly warning popup regarding seating arrangements once a day when the user accesses the exam seating view.

## 🛠 Tech Stack

- **Frontend:** HTML5, Vanilla JavaScript, CSS (Custom styling + Tailwind CSS for utility classes)
- **Data Management:** LocalStorage for caching user profiles and states.
- **Backend (Optional/Scraper):** Node.js scraper (Playwright) located in `MAC-EXAM-Hub-Scraper/` to fetch live data from the college portal.

## 📁 Project Structure

- `index.html`: The main SPA shell containing all views (Home, Timetable, Seats, Resources).
- `js/`: Core application logic.
  - `app.js`: Main UI interactions, routing, countdowns, and rendering logic.
  - `onboarding.js`: Handles the Smart Finder and profile setup.
  - `seats.js`: Generates the seating arrangement UI.
- `styles/`: CSS stylesheets.
  - `base.css`: Core design system, animations, and typography.
  - `tailwind.css`: Utility classes.
- `data/`: Static data files for testing and offline usage.
  - `timetable_bca.js`, `timetable_bba.js`: Department-specific schedules.
  - `student_names.js`, `students_db.js`: Mock databases for the Smart Finder.
- `MAC-EXAM-Hub-Scraper/`: The backend scraper system for live data.

## 📝 Recent Updates & Bug Fixes

- **Removed Profile & Academic Sheets:** Stripped out the "Edit Profile" and "Academic Info" bottom sheets to streamline the UI and simplify user flow. Removed all associated entry points (buttons and hamburger menus).
- **Cleaned Exam Navigation:** Removed the generic "Resources" tab from the Exam sub-navigation menu to prevent confusing double-routing.
- **Theory Completed Message:** Removed the "Theory Completed / Practical Exams Switch" panel from the timetable view to reduce visual clutter.
- **Fixed Exam Card Overflows:** Adjusted CSS grid and flex layouts so that exam subjects fit perfectly inside their cards without clipping on mobile screens.
- **Grid Layout Adjustments:** Updated the home dashboard layout so the "Location" card smoothly spans across two columns after removing the profile card.
- **Daily Note Popup:** Refined the seat warning notification to only appear once per day when the user specifically accesses the seating map.

## 🔄 Instructions to Update Data

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

### Updating Student Data for Smart Finder
1. Open `data/students_db.js` or `data/student_names.js`.
2. Add or modify student entries in the JSON array. Make sure the `name`, `regNo`, and `adminNo` fields are accurate so the Smart Finder can index them.

### Running the App Locally
Since it's a Vanilla JS app without a heavy framework, you can simply serve the directory using any local web server:
- Using Python: `python -m http.server 8000`
- Using Node.js: `npx serve .`

Open `http://localhost:8000` (or the port provided) in your browser.

## 🤝 Maintenance Notes
- **UI Modifications:** If you add new buttons or cards to `index.html`, make sure to add the `.spring` and `.liquid-button` (or `.glass-panel`) classes to maintain the Apple-inspired animations and styling.
- **Mobile Optimization:** The app relies heavily on `max-w-md mx-auto` to simulate a mobile app feel on desktop browsers. Always test UI changes on smaller viewport widths (e.g., 375px or 390px).
