/**
 * Machin SDK - JavaScript Client for Option B Headless Bridge API
 */
class MachinSDK {
    /**
     * @param {string} baseUrl - Base URL of the running server.js instance (e.g., http://localhost:5000)
     */
    constructor(baseUrl = 'http://localhost:5000') {
        this.baseUrl = baseUrl.replace(/\/$/, '');
    }

    /**
     * Syncs all academic data (Dashboard, Profile, Subjects, and Assessments) for a student.
     * 
     * @param {string} admissionNo - The student's college admission number.
     * @returns {Promise<Object>} The unified Master JSON payload containing synced portal records.
     * @throws {Error} Throws custom errors such as "MANUAL_PASSWORD_REQUIRED" or portal unreachable details.
     */
    async syncAll(admissionNo) {
        if (!admissionNo) {
            throw new Error("admissionNo is required to initiate sync.");
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ admissionNo })
            });

            if (!response.ok) {
                let errMessage = `HTTP error! Status: ${response.status}`;
                try {
                    const errData = await response.json();
                    if (errData.error) {
                        errMessage = errData.error; // Return the custom error (e.g. "MANUAL_PASSWORD_REQUIRED")
                    }
                } catch {
                    // Fail silently and keep status text
                }
                throw new Error(errMessage);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`[MachinSDK] Sync failed for student ${admissionNo}:`, error.message);
            throw error;
        }
    }
}

// Export for ES modules or attach to window in browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MachinSDK;
} else {
    window.MachinSDK = MachinSDK;
}
