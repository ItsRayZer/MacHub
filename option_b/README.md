# Option B: Node.js Express Headless Bridge API

This is the backup/fallback architecture (Option B) for the **Machub** data pipeline. It executes a direct, headless ASP.NET Web Forms login handshake and data sync completely on-demand without using GitHub Actions or Cloudflare Workers.

## How it works

1. **Client Request**: Frontend calls the Express backend via `MachubSDK.js` with the student's Admission Number.
2. **Dynamic Session Handshake**:
   - Backend performs pre-flight GET request to `/Login.aspx` to extract ASP.NET viewstate tokens.
   - Executes dynamic POST request to authenticate the session.
3. **Session Cache**: Session cookie is cached in memory with a 20-minute TTL.
4. **Concurrent Scrape**: Concurrently scrapes the Dashboard, Study Material, and Assessments using cheerio, parses the tables, and returns a unified JSON payload.
5. **Autorefresh Interceptor**: If the session expires during data fetch, Axios interceptor detects it, silently logs back in to refresh the session cookie, and retries.

---

## Quick Start (How to Run Option B)

### 1. Install Dependencies
```bash
cd option_b
npm install
```

### 2. Start the Server
```bash
npm start
```
The server will start listening on port `3000` (or `process.env.PORT`).

---

## Client Integration

### 1. Include the SDK
Include the `MachubSDK.js` file in your client-side assets:
```html
<script src="option_b/MachubSDK.js"></script>
```

### 2. Invoke Sync
Use the SDK class to trigger syncs:
```javascript
const sdk = new MachubSDK('http://localhost:3000');

try {
  const data = await sdk.syncAll('12965');
  console.log("Synced Data:", data);
} catch (error) {
  if (error.message === 'MANUAL_PASSWORD_REQUIRED') {
    // Prompt the user to enter their password manually or redirect to login
    console.error("Authentication failed: Password changed by user.");
  } else {
    console.error("Sync Failed:", error.message);
  }
}
```
