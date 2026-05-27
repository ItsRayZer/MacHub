# Machin Portal Scraper Backend Engine v3.0

A high-performance Python FastAPI backend and standalone CLI scraper for the **Machin** companion app, designed for students of Mar Augusthinose College (MAC), Ramapuram. It connects to the EduloomPro college portal, extracts student stats (Dashboard, Profile, Marks, Attendance, etc.), and returns clean structured JSON.

## 🚀 Key Features

*   **Fast FastAPI Server:** REST API exposing sync endpoints for your mobile/web app.
*   **Dual Mode:** Works both as an API server and as a standalone CLI script.
*   **ASP.NET Web Forms Login Handler:** Handles hidden token extraction (`__VIEWSTATE`, `__EVENTVALIDATION`) and POSTs dynamically.
*   **Hybrid Scraping with Gemini AI:** Parsed locally via BeautifulSoup. If any page structure changes, it automatically cleans the HTML and invokes **Gemini 2.5 Flash** (using your Gemini API key) to extract structured JSON data without breaking the app.
*   **Cloud Ready:** Fully pre-configured for deployment as a **Firebase Cloud Function**.

---

## 🛠️ Tech Stack & Requirements

*   **Language:** Python 3.10+
*   **Framework:** FastAPI
*   **Parsing:** BeautifulSoup4 + lxml
*   **Package Manager:** uv / pip

---

## 📦 Installation & Setup

Choose one of the two methods below to run the project.

### Method A: Using `uv` (Recommended & Super Fast)
Since `uv` is installed on your system, you don't even need to configure virtual environments manually. You can run commands directly:
```bash
# Run CLI directly (dependencies are resolved on-the-fly)
uv run --with -r requirements.txt machin_scraper.py --adm YOUR_ADM_NO --pwd YOUR_PASSWORD --out result.json

# Start FastAPI server
uv run --with -r requirements.txt uvicorn machin_scraper:app --reload --host 0.0.0.0 --port 8000
```

### Method B: Standard Python `pip`
```bash
# 1. Create and activate virtual environment
python -m venv venv
venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start local server
uvicorn machin_scraper:app --reload --host 0.0.0.0 --port 8000
```

---

## 💻 CLI Usage (Standalone Scraper)

You can run the script directly from the terminal without launching the API server.

**Full Sync (All 14 pages) saved to `result.json`:**
```bash
python machin_scraper.py --adm 12965 --pwd 12965 --out result.json
```
*(BCA students can use their Admission Number as both username and password for testing).*

**Scrape a Single Section:**
```bash
python machin_scraper.py --adm 12965 --pwd 12965 --section assessments
```
*Available sections:* `dashboard`, `profile`, `subjects`, `assessments`, `assignments`, `seminars`, `attendance`.

---

## 🔌 API Server Endpoints

All POST endpoints accept a JSON payload in the following shape:
```json
{
  "admission_no": "YOUR_ADM_NO",
  "password": "YOUR_PASSWORD"
}
```

*   `POST /api/sync` -> Full sync. All 14 pages. Returns master JSON.
*   `POST /api/dashboard` -> Dashboard counters only (fast refresh).
*   `POST /api/assessments` -> Internal marks tables.
*   `POST /api/subjects` -> Study Material subject module list.
*   `POST /api/attendance` -> Subject-wise attendance percentages.
*   `POST /api/assignments` -> Active & Expired assignments.
*   `POST /api/profile` -> Student profile details.
*   `GET /health` -> Simple status check (`{"status": "online"}`).
*   `GET /docs` -> Interactive Swagger UI documentation.

---

## 🧠 Configuring Gemini AI Fallback

If you want to customize the Gemini API key or deploy to your own project, set the environment variable:

*   **Local environment:**
    ```powershell
    $env:GEMINI_API_KEY="your_api_key_here"
    ```
*   **Firebase environment:**
    Set the environment secret `GEMINI_API_KEY` in the Firebase Console or Google Cloud Console for the Cloud Function.

If no key is configured, the engine defaults to your provided API key (`AIzaSyCab4NSZPeVgwJ4hlzjgSoxE55OnV-Nnbs`).

---

## ☁️ Deploying to Firebase Cloud Functions

The project is fully pre-configured to run serverlessly in the cloud. Hitting `/api/**` on your hosting domain will route directly to the Cloud Function.

To deploy:
```bash
# 1. Login to firebase (if needed)
firebase login

# 2. Select your project (already set to machub-6af39)
firebase use default

# 3. Deploy functions and hosting rewrites
firebase deploy --only functions,hosting
```

Once deployed, you can access your cloud scraper at:
`https://machub-6af39.web.app/docs` (interactive Swagger UI)
`https://machub-6af39.web.app/api/sync` (cloud production endpoint)
