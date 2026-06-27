/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║   MAC Exam Hub — Firebase Cloud Functions                        ║
 * ║   yearlyCleanup, onDemandScrape, backgroundAutoScrape            ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp();
const db = admin.firestore();

// ─── Configuration ──────────────────────────────────────────────────────────
const WORKER_URL = "https://machub-proxy.mrabensojan.workers.dev";
const WORKER_SECRET = functions.config().worker?.secret || "";

// ─── Helper: Recursive Delete ───────────────────────────────────────────────
async function recursiveDelete(docRef) {
  const subcollections = await docRef.listCollections();
  for (const subcol of subcollections) {
    const docs = await subcol.listDocuments();
    for (const doc of docs) {
      await recursiveDelete(doc);
      await doc.delete();
    }
  }
  await docRef.delete();
}

// ─── Helper: Get batch data for a student ───────────────────────────────────
async function getBatchForStudent(studentDoc) {
  const student = studentDoc.data();
  const divisionId = student.divisionId;

  if (!divisionId) return null;

  // Support both string ID and Firestore reference
  const divId = typeof divisionId === "string" ? divisionId : divisionId.id;
  const divisionSnap = await db.collection("divisions").doc(divId).get();
  if (!divisionSnap.exists) return null;

  const batchId = divisionSnap.data().batchId;
  const batId = typeof batchId === "string" ? batchId : batchId.id;
  const batchSnap = await db.collection("batches").doc(batId).get();
  if (!batchSnap.exists) return null;

  return batchSnap.data();
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 1: yearlyCleanup
// Trigger: August 1st at midnight IST every year
// Stages:
//   1. Graduate active seniors → alumni + delete their cache
//   2. Hard delete pending users unclaimed for >1 year
//   3. Absolute purge for data older than 5 years
// ═══════════════════════════════════════════════════════════════════════════════

exports.yearlyCleanup = functions
  .region("asia-south1")
  .pubsub.schedule("0 0 1 8 *")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
    const currentYear = new Date().getFullYear();
    console.log(`[yearlyCleanup] Starting for year ${currentYear}...`);

    let cacheDeletions = 0;
    let alumniUpdates = 0;
    let pendingDeletions = 0;
    let ancientDeletions = 0;

    // ── STAGE 1: Graduate seniors → alumni ──────────────────────────────────
    const activeQuery = await db.collection("students")
      .where("status", "==", "active")
      .get();

    const stage1Batch = db.batch();

    for (const doc of activeQuery.docs) {
      const batchData = await getBatchForStudent(doc);
      if (!batchData) continue;

      if (batchData.endYear < currentYear) {
        // Delete portal data cache
        stage1Batch.delete(db.collection("portalDataCache").doc(doc.id));
        cacheDeletions++;

        // Update student to alumni
        stage1Batch.update(doc.ref, {
          "status": "alumni",
          "security.isProfileClaimed": false,
          "security.deviceTokens": [],
          "updatedAt": admin.firestore.FieldValue.serverTimestamp(),
        });
        alumniUpdates++;
      }
    }

    if (alumniUpdates > 0) {
      await stage1Batch.commit();
    }

    console.log(`[yearlyCleanup] Stage 1: ${alumniUpdates} alumni, ${cacheDeletions} caches deleted`);

    // ── STAGE 2: Delete stale pending users ─────────────────────────────────
    const oneYearAgo = new Date(currentYear - 1, 7, 1); // Aug 1st last year
    const pendingQuery = await db.collection("students")
      .where("status", "==", "pending")
      .where("createdAt", "<", admin.firestore.Timestamp.fromDate(oneYearAgo))
      .get();

    const stage2Batch = db.batch();

    for (const doc of pendingQuery.docs) {
      const batchData = await getBatchForStudent(doc);
      if (!batchData) continue;

      if (batchData.startYear < currentYear - 1) {
        stage2Batch.delete(doc.ref);
        stage2Batch.delete(db.collection("portalDataCache").doc(doc.id));
        stage2Batch.delete(db.collection("notificationPrefs").doc(doc.id));
        pendingDeletions++;
      }
    }

    if (pendingDeletions > 0) {
      await stage2Batch.commit();
    }

    console.log(`[yearlyCleanup] Stage 2: ${pendingDeletions} pending users deleted`);

    // ── STAGE 3: Absolute purge (>5 years) ──────────────────────────────────
    const allStudents = await db.collection("students")
      .where("status", "in", ["active", "alumni", "pending"])
      .get();

    for (const doc of allStudents.docs) {
      const batchData = await getBatchForStudent(doc);
      if (!batchData) continue;

      if (batchData.endYear < currentYear - 5) {
        await recursiveDelete(doc.ref);
        // Also clean up related collections
        const cacheRef = db.collection("portalDataCache").doc(doc.id);
        const cacheSnap = await cacheRef.get();
        if (cacheSnap.exists) await cacheRef.delete();

        const notifRef = db.collection("notificationPrefs").doc(doc.id);
        const notifSnap = await notifRef.get();
        if (notifSnap.exists) await notifRef.delete();

        ancientDeletions++;
      }
    }

    console.log(`[yearlyCleanup] Stage 3: ${ancientDeletions} ancient records purged`);
    console.log(`[yearlyCleanup] ✅ Complete: ${cacheDeletions} caches, ${alumniUpdates} alumni, ` +
      `${pendingDeletions} pending, ${ancientDeletions} ancient`);

    return null;
  });


// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 2: onDemandScrape
// HTTP Callable — triggered by client when user wants fresh data
// Rate limited: max 3 attempts per admission per hour
// ═══════════════════════════════════════════════════════════════════════════════

exports.onDemandScrape = functions
  .region("asia-south1")
  .runWith({ timeoutSeconds: 120, memory: "256MB" })
  .https.onCall(async (data, context) => {
    const { admissionNumber, target, customPassword } = data;

    if (!admissionNumber) {
      throw new functions.https.HttpsError("invalid-argument", "admissionNumber is required");
    }

    const validTargets = ["attendance", "marks", "subjects", "full", "profile",
      "examResult", "internalMark", "assessment", "assignment", "seminar",
      "studyMaterial", "hallTicket", "allotmentMemo", "feePayment",
      "feedback", "grievance", "concession", "graceMark"];
    const scrapeTarget = target || "full";

    if (!validTargets.includes(scrapeTarget)) {
      throw new functions.https.HttpsError("invalid-argument", `Invalid target: ${scrapeTarget}`);
    }

    // ── Rate Limiting ─────────────────────────────────────────────────────────
    const oneHourAgo = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 60 * 60 * 1000),
    );

    const recentLogs = await db.collection("scrapeLogs")
      .where("admissionNumber", "==", admissionNumber)
      .where("timestamp", ">", oneHourAgo)
      .get();

    if (recentLogs.size >= 3) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        "Too many attempts. Try again in 1 hour.",
      );
    }

    // ── Get Student Doc ───────────────────────────────────────────────────────
    const studentRef = db.collection("students").doc(admissionNumber);
    let studentSnap = await studentRef.get();

    if (!studentSnap.exists) {
      // Auto-create student document shell for manual setup
      const newStudent = {
        name: "",
        status: "active",
        credentialStatus: "valid",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        security: {
          isProfileClaimed: false,
          deviceTokens: []
        }
      };
      await studentRef.set(newStudent);
      studentSnap = await studentRef.get();
    }

    const student = studentSnap.data();
    let passwordToTry;

    if (customPassword) {
      passwordToTry = customPassword;
    } else if (student.security?.portalPasswordEncrypted) {
      // Decrypt stored password via Worker
      try {
        const decryptRes = await fetch(`${WORKER_URL}/api/auth/decrypt-password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Worker-Secret": WORKER_SECRET,
          },
          body: JSON.stringify({ encrypted: student.security.portalPasswordEncrypted }),
        });
        const decryptData = await decryptRes.json();
        if (!decryptData.success) {
          throw new Error("Decryption failed");
        }
        passwordToTry = decryptData.password;
      } catch (err) {
        console.error(`[onDemandScrape] Decrypt failed: ${err.message}`);
        // Fall back to admission number
        passwordToTry = admissionNumber;
      }
    } else {
      // First time — try admission number as password
      passwordToTry = admissionNumber;
    }

    // ── Call Worker Scraper ──────────────────────────────────────────────────
    const startTime = Date.now();
    let scrapeData;

    try {
      if (scrapeTarget === "full") {
        // Scrape all major sections
        const sections = ["profile", "attendance", "examResult", "internalMark",
          "assessment", "assignment", "seminar"];
        const results = {};

        for (const section of sections) {
          try {
            const sectionRes = await fetch(`${WORKER_URL}/api/scrape/${section}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                admissionNumber,
                password: passwordToTry,
              }),
            });
            const sectionData = await sectionRes.json();
            if (sectionData.success) {
              results[section] = sectionData.data || sectionData;
            }
          } catch (sectionErr) {
            console.warn(`[onDemandScrape] Section ${section} failed: ${sectionErr.message}`);
          }
        }

        scrapeData = { success: Object.keys(results).length > 0, data: results };
      } else {
        // Single section scrape
        const scrapeRes = await fetch(`${WORKER_URL}/api/scrape/${scrapeTarget}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            admissionNumber,
            password: passwordToTry,
            target: scrapeTarget,
          }),
        });
        scrapeData = await scrapeRes.json();
      }
    } catch (fetchErr) {
      // Log the failure
      await db.collection("scrapeLogs").add({
        admissionNumber,
        target: scrapeTarget,
        status: "failed",
        errorMessage: fetchErr.message,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        responseTimeMs: Date.now() - startTime,
      });

      throw new functions.https.HttpsError("internal", "Scraping failed: " + fetchErr.message);
    }

    // ── Log Attempt ─────────────────────────────────────────────────────────
    await db.collection("scrapeLogs").add({
      admissionNumber,
      target: scrapeTarget,
      status: scrapeData.success ? "success" : "failed",
      errorMessage: scrapeData.error || "",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      responseTimeMs: Date.now() - startTime,
    });

    // ── Handle Failure ──────────────────────────────────────────────────────
    if (!scrapeData.success) {
      if (scrapeData.error === "INVALID_CREDENTIALS" ||
          scrapeData.error?.includes("LOGIN_FAILED")) {
        await studentRef.update({
          credentialStatus: "invalid",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        throw new functions.https.HttpsError("unauthenticated", "Invalid portal credentials");
      }
      throw new functions.https.HttpsError("internal", "Scraping failed");
    }

    // ── SUCCESS — Save Data to portalDataCache ──────────────────────────────
    const cacheRef = db.collection("portalDataCache").doc(admissionNumber);
    const cacheSnap = await cacheRef.get();

    const newCacheData = {
      admissionNumber,
      ...scrapeData.data,
      lastScrapedAt: admin.firestore.FieldValue.serverTimestamp(),
      nextAutoScrapeAt: admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours later
      ),
    };

    if (cacheSnap.exists) {
      await cacheRef.update(newCacheData);
    } else {
      await cacheRef.set(newCacheData);
    }

    // ── First-time success with default password → save encrypted ───────────
    if (!student.security?.portalPasswordEncrypted && passwordToTry === admissionNumber) {
      try {
        const encryptRes = await fetch(`${WORKER_URL}/api/auth/encrypt-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: admissionNumber }),
        });
        const encryptData = await encryptRes.json();

        if (encryptData.success) {
          await studentRef.update({
            "security.portalPasswordEncrypted": encryptData.encrypted,
            "status": "active",
            "credentialStatus": "valid",
            "updatedAt": admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      } catch (encErr) {
        console.error(`[onDemandScrape] Encrypt save failed: ${encErr.message}`);
      }
    }

    // ── Custom password provided and success → save it ──────────────────────
    if (customPassword && scrapeData.success) {
      try {
        const encryptRes = await fetch(`${WORKER_URL}/api/auth/encrypt-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: customPassword }),
        });
        const encryptData = await encryptRes.json();

        if (encryptData.success) {
          await studentRef.update({
            "security.portalPasswordEncrypted": encryptData.encrypted,
            "credentialStatus": "valid",
            "updatedAt": admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      } catch (encErr) {
        console.error(`[onDemandScrape] Custom password save failed: ${encErr.message}`);
      }
    }

    return { success: true, data: scrapeData.data };
  });


// ═══════════════════════════════════════════════════════════════════════════════
// FUNCTION 3: backgroundAutoScrape
// Pub/Sub Scheduled — every 15 minutes
// Finds stale portalDataCache docs and re-scrapes them
// ═══════════════════════════════════════════════════════════════════════════════

exports.backgroundAutoScrape = functions
  .region("asia-south1")
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .pubsub.schedule("*/15 * * * *")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
    console.log("[backgroundAutoScrape] Starting scan for stale caches...");

    const now = admin.firestore.Timestamp.now();

    // Find caches that are due for refresh
    const staleQuery = await db.collection("portalDataCache")
      .where("nextAutoScrapeAt", "<=", now)
      .limit(50)
      .get();

    if (staleQuery.empty) {
      console.log("[backgroundAutoScrape] No stale caches found");
      return null;
    }

    console.log(`[backgroundAutoScrape] Found ${staleQuery.size} stale caches`);

    let successCount = 0;
    let failCount = 0;

    for (const doc of staleQuery.docs) {
      const admissionNumber = doc.id;

      // Check student exists and has valid credentials
      const studentRef = db.collection("students").doc(admissionNumber);
      const studentSnap = await studentRef.get();

      if (!studentSnap.exists) {
        console.warn(`[backgroundAutoScrape] Student ${admissionNumber} not found, skipping`);
        continue;
      }

      const student = studentSnap.data();

      if (student.credentialStatus === "invalid") {
        console.warn(`[backgroundAutoScrape] ${admissionNumber} has invalid creds, skipping`);
        // Push next auto-scrape far into the future
        await doc.ref.update({
          nextAutoScrapeAt: admin.firestore.Timestamp.fromDate(
            new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          ),
        });
        continue;
      }

      if (student.status !== "active") {
        continue;
      }

      // Get decrypted password
      const encryptedPassword = student.security?.portalPasswordEncrypted;
      if (!encryptedPassword) {
        console.warn(`[backgroundAutoScrape] ${admissionNumber} has no stored password, skipping`);
        continue;
      }

      let password;
      try {
        const decryptRes = await fetch(`${WORKER_URL}/api/auth/decrypt-password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Worker-Secret": WORKER_SECRET,
          },
          body: JSON.stringify({ encrypted: encryptedPassword }),
        });
        const decryptData = await decryptRes.json();
        if (!decryptData.success) throw new Error("Decryption failed");
        password = decryptData.password;
      } catch (err) {
        console.error(`[backgroundAutoScrape] Decrypt failed for ${admissionNumber}: ${err.message}`);
        failCount++;
        continue;
      }

      // Scrape attendance + profile (most important sections)
      try {
        const scrapeRes = await fetch(`${WORKER_URL}/api/scrape/attendance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ admissionNumber, password }),
        });
        const scrapeData = await scrapeRes.json();

        if (scrapeData.success) {
          // Update cache
          await doc.ref.update({
            attendance: scrapeData.data || scrapeData,
            lastScrapedAt: admin.firestore.FieldValue.serverTimestamp(),
            nextAutoScrapeAt: admin.firestore.Timestamp.fromDate(
              new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
            ),
          });

          // Log success
          await db.collection("scrapeLogs").add({
            admissionNumber,
            target: "attendance",
            status: "success",
            errorMessage: "",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            responseTimeMs: 0,
          });

          successCount++;
        } else {
          if (scrapeData.error?.includes("LOGIN_FAILED") ||
              scrapeData.error === "INVALID_CREDENTIALS") {
            await studentRef.update({
              credentialStatus: "invalid",
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          await db.collection("scrapeLogs").add({
            admissionNumber,
            target: "attendance",
            status: "failed",
            errorMessage: scrapeData.error || "Unknown error",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });

          failCount++;
        }
      } catch (err) {
        console.error(`[backgroundAutoScrape] Scrape failed for ${admissionNumber}: ${err.message}`);
        failCount++;

        await db.collection("scrapeLogs").add({
          admissionNumber,
          target: "attendance",
          status: "failed",
          errorMessage: err.message,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Small delay between scrapes to be gentle on the portal
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log(`[backgroundAutoScrape] ✅ Complete: ${successCount} success, ${failCount} failed`);
    return null;
  });
