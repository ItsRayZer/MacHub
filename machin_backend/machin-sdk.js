/**
 * MachinSDK - JavaScript client-side ES module SDK to interface with
 * the Machin Scraper Backend Engine.
 * 
 * Works seamlessly with local servers or deployed Firebase Cloud Functions.
 */
class MachinSDK {
  /**
   * Initialize SDK with the backend's base URL.
   * @param {string} baseUrl - e.g., 'http://localhost:8000' or 'https://machub-6af39.web.app'
   */
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, ""); // Strip trailing slash
  }

  /**
   * Helper function to perform authenticated POST requests.
   * @private
   */
  async _post(path, admNo, password) {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        admission_no: admNo,
        password: password,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.detail || `HTTP error! status: ${response.status}`;
      throw new Error(message);
    }

    return response.json();
  }

  /**
   * Trigger a full data sync. Fetches all 14 pages on the portal.
   * @param {string} admNo - Student Admission Number
   * @param {string} password - Student Portal Password
   * @returns {Promise<Object>} Master sync JSON
   */
  async syncAll(admNo, password) {
    return this._post("/api/sync", admNo, password);
  }

  /**
   * Fetch dashboard card counters only.
   * @param {string} admNo
   * @param {string} password
   */
  async getDashboard(admNo, password) {
    return this._post("/api/dashboard", admNo, password);
  }

  /**
   * Fetch internal marks assessments only.
   * @param {string} admNo
   * @param {string} password
   */
  async getAssessments(admNo, password) {
    return this._post("/api/assessments", admNo, password);
  }

  /**
   * Fetch study material subject lists only.
   * @param {string} admNo
   * @param {string} password
   */
  async getSubjects(admNo, password) {
    return this._post("/api/subjects", admNo, password);
  }

  /**
   * Fetch attendance stats only.
   * @param {string} admNo
   * @param {string} password
   */
  async getAttendance(admNo, password) {
    return this._post("/api/attendance", admNo, password);
  }

  /**
   * Fetch active/expired assignments only.
   * @param {string} admNo
   * @param {string} password
   */
  async getAssignments(admNo, password) {
    return this._post("/api/assignments", admNo, password);
  }

  /**
   * Fetch student profile details only.
   * @param {string} admNo
   * @param {string} password
   */
  async getProfile(admNo, password) {
    return this._post("/api/profile", admNo, password);
  }

  /**
   * Simple ping health check.
   * @returns {Promise<Object>} {"status": "online"}
   */
  async ping() {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error("Backend server is offline");
    }
    return response.json();
  }
}

export default MachinSDK;

/* =========================================================================
   REACT INTEGRATION EXAMPLE
   =========================================================================

   import React, { useState } from 'react';
   import MachinSDK from './machin-sdk';

   // Initialize the SDK with your Firebase Hosting URL or Local Dev server
   const sdk = new MachinSDK(process.env.REACT_APP_API_URL || 'http://localhost:8000');

   export function LoginScreen() {
     const [username, setUsername] = useState('');
     const [password, setPassword] = useState('');
     const [loading, setLoading] = useState(false);
     const [error, setError] = useState(null);
     const [studentData, setStudentData] = useState(null);

     const handleLoginSubmit = async (e) => {
       e.preventDefault();
       setLoading(true);
       setError(null);

       try {
         // Call syncAll to log in and pull all data in a single request
         const result = await sdk.syncAll(username, password);
         
         // Destructure values from response
         const {
           meta: { student_name },
           dashboard: { assessment: assessmentCount },
           subjects,
           assessments
         } = result;

         // Cache it locally
         setStudentData({
           studentName: student_name,
           assessmentCount: assessmentCount,
           subjectsLength: subjects.length,
           assessments: assessments
         });

         alert(`Welcome back, ${student_name}! Data synced.`);
       } catch (err) {
         setError(err.message);
       } finally {
         setLoading(false);
       }
     };

     return (
       <div className="login-container" style={{ padding: 24, fontFamily: 'sans-serif' }}>
         <h2>Machin Portal Login</h2>
         <form onSubmit={handleLoginSubmit}>
           <input 
             type="text" 
             placeholder="Admission Number" 
             value={username} 
             onChange={e => setUsername(e.target.value)} 
             style={{ display: 'block', margin: '8px 0', padding: 8 }}
             required
           />
           <input 
             type="password" 
             placeholder="Password" 
             value={password} 
             onChange={e => setPassword(e.target.value)} 
             style={{ display: 'block', margin: '8px 0', padding: 8 }}
             required
           />
           <button type="submit" disabled={loading} style={{ padding: '8px 16px', cursor: 'pointer' }}>
             {loading ? 'Syncing...' : 'Sync Portal Data'}
           </button>
         </form>

         {error && <p style={{ color: 'red' }}>Error: {error}</p>}

         {studentData && (
           <div className="data-box" style={{ marginTop: 24, padding: 16, border: '1px solid #ccc' }}>
             <h3>Profile: {studentData.studentName}</h3>
             <p>Active Subject Modules: {studentData.subjectsLength}</p>
             <p>Internal Assessments: {studentData.assessmentCount}</p>
             
             <h4>Live Internal Mark List:</h4>
             <ul>
               {studentData.assessments.map((ass, i) => (
                 <li key={i}>
                   <strong>{ass.subject}</strong> - {ass.assessment_type}: {ass.score}/{ass.max_mark} (Pass: {ass.pass_mark}) - 
                   <span style={{ color: ass.status === 'PASS' || ass.status === 'Pass' ? 'green' : 'red' }}> {ass.status}</span>
                 </li>
               ))}
             </ul>
           </div>
         )}
       </div>
     );
   }
*/
