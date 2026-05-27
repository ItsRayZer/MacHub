/**
 * MachubSDK - JavaScript Client for Option B Headless Bridge API
 */
class MachubSDK {
  /**
   * @param {string} baseURL - Base URL of the running server.js instance (e.g., http://localhost:3000)
   */
  constructor(baseURL = "http://localhost:3000") {
    this.baseURL = baseURL.replace(/\/$/, "");
  }

  /**
   * Calls POST /api/sync, returns the Master JSON or throws a typed error.
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
      const response = await fetch(`${this.baseURL}/api/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ admissionNo })
      });

      if (response.status === 403) {
        throw new Error("MANUAL_PASSWORD_REQUIRED");
      }

      if (response.status === 502) {
        throw new Error("PORTAL_UNREACHABLE");
      }

      if (!response.ok) {
        throw new Error("NETWORK_ERROR");
      }

      const data = await response.json();
      
      // Cache success result in localStorage
      try {
        localStorage.setItem(`machub_cache_${admissionNo}`, JSON.stringify(data));
      } catch (e) {
        console.warn("[MachubSDK] localStorage cache write failed:", e.message);
      }

      return data;
    } catch (error) {
      console.error(`[MachubSDK] [ERROR] Sync failed for student ${admissionNo}:`, error.message);
      throw error;
    }
  }

  /**
   * Returns cached last sync result (stored in memory or localStorage).
   * 
   * @param {string} admissionNo - The student's college admission number.
   * @returns {Object|null} Cached Master JSON payload or null.
   */
  getLastSync(admissionNo) {
    try {
      const cached = localStorage.getItem(`machub_cache_${admissionNo}`);
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      console.warn("[MachubSDK] localStorage cache read failed:", e.message);
      return null;
    }
  }

  /**
   * Clears local cache for an admission number.
   * 
   * @param {string} admissionNo - The student's college admission number.
   */
  clearCache(admissionNo) {
    try {
      localStorage.removeItem(`machub_cache_${admissionNo}`);
    } catch (e) {
      console.warn("[MachubSDK] localStorage cache clear failed:", e.message);
    }
  }
}

// Export for ES modules or attach to window in browser
if (typeof module !== "undefined" && module.exports) {
  module.exports = MachubSDK;
} else {
  window.MachubSDK = MachubSDK;
}
