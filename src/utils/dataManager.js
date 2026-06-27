(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.dataManager = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TIERS = {
    tier1: ['profile', 'allotmentMemo', 'hallTicket'],
    tier2: ['subjects', 'internalMarks', 'modelExam', 'internalUniversity', 'examResult'],
    tier3: ['attendanceSubjectWise', 'attendanceDetails', 'assignments', 'seminars', 'onlineExam', 'feePayment', 'feedback'],
    tier4: ['customProfile', 'mguResults', 'myRankings']
  };

  const TTL_MS = {
    attendanceSubjectWise: 1800000,
    attendanceDetails:     1800000,
    assignments:           3600000,
    seminars:              86400000,
    onlineExam:            900000,
    feePayment:            86400000,
    feedback:              86400000,
    examResultNormal:      86400000,
    examResultSeason:      3600000
  };

  function normalizeSemester(str) {
    if (!str) return '';
    let s = String(str).toUpperCase().trim();
    s = s.replace(/[^A-Z0-9]/g, ' ');
    if (s.includes('FIRST') || s.includes('1ST') || s === '1' || s === 'SEM 1' || s.endsWith(' 1')) return 'FIRST SEMESTER';
    if (s.includes('SECOND') || s.includes('2ND') || s === '2' || s === 'SEM 2' || s.endsWith(' 2')) return 'SECOND SEMESTER';
    if (s.includes('THIRD') || s.includes('3RD') || s === '3' || s === 'SEM 3' || s.endsWith(' 3')) return 'THIRD SEMESTER';
    if (s.includes('FOURTH') || s.includes('4TH') || s === '4' || s === 'SEM 4' || s.endsWith(' 4')) return 'FOURTH SEMESTER';
    if (s.includes('FIFTH') || s.includes('5TH') || s === '5' || s === 'SEM 5' || s.endsWith(' 5')) return 'FIFTH SEMESTER';
    if (s.includes('SIXTH') || s.includes('6TH') || s === '6' || s === 'SEM 6' || s.endsWith(' 6')) return 'SIXTH SEMESTER';
    return s;
  }

  function getTierOfSection(key) {
    if (TIERS.tier1.includes(key)) return 1;
    if (TIERS.tier2.includes(key)) return 2;
    if (TIERS.tier3.includes(key)) return 3;
    if (TIERS.tier4.includes(key)) return 4;
    return 3;
  }

  function mapSectionToSchemaKey(section) {
    if (!section) return '';
    const s = section.toLowerCase();
    if (s === 'profile') return 'profile';
    if (s === 'attendance') return 'attendance';
    if (s === 'assessment') return 'subjects';
    if (s === 'internalmark') return 'internalMarks';
    if (s === 'modelexam') return 'modelExam';
    if (s === 'internaluniversity') return 'internalUniversity';
    if (s === 'examresult') return 'examResult';
    if (s === 'hallticket') return 'hallTicket';
    if (s === 'allotmentmemo') return 'allotmentMemo';
    if (s === 'assignment') return 'assignments';
    if (s === 'seminar') return 'seminars';
    if (s === 'onlineexam') return 'onlineExam';
    if (s === 'feepay' || s === 'feepayment') return 'feePayment';
    if (s === 'feedback') return 'feedback';
    return section;
  }

  function getRawData(section, data) {
    if (data && typeof data === 'object') {
      if ('payload' in data) return data.payload;
      if ('data' in data) return data.data;
    }
    return data;
  }

  function isStale(section, firestoreData, resultSeasonActive = false) {
    const key = mapSectionToSchemaKey(section);
    const wrapper = firestoreData ? firestoreData[key] : null;

    if (!wrapper || !wrapper.cachedAt) return true;

    const tier = getTierOfSection(key);
    if (tier === 1) return false;
    if (tier === 2 && wrapper.frozen === true) return false;

    if (tier === 2) {
      if (key === 'examResult') {
        if (wrapper.published === true || wrapper.data !== null) return false;
        const ttl = resultSeasonActive ? TTL_MS.examResultSeason : TTL_MS.examResultNormal;
        const elapsed = Date.now() - new Date(wrapper.cachedAt).getTime();
        return elapsed > ttl;
      }
      if (wrapper.data !== null && wrapper.data !== undefined) return false;
      const elapsed = Date.now() - new Date(wrapper.cachedAt).getTime();
      return elapsed > 86400000;
    }

    if (tier === 3) {
      let ttl = 1800000;
      if (key === 'attendanceSubjectWise' || key === 'attendanceDetails' || key === 'attendance') {
        ttl = TTL_MS.attendanceSubjectWise;
      } else if (key === 'assignments') {
        ttl = TTL_MS.assignments;
      } else if (key === 'seminars') {
        ttl = TTL_MS.seminars;
      } else if (key === 'onlineExam') {
        ttl = TTL_MS.onlineExam;
      } else if (key === 'feePayment') {
        ttl = TTL_MS.feePayment;
      } else if (key === 'feedback') {
        ttl = TTL_MS.feedback;
      }
      const elapsed = Date.now() - new Date(wrapper.cachedAt).getTime();
      return elapsed > ttl;
    }

    return false;
  }

  function shouldSweepWrite(section, firestoreData) {
    const key = mapSectionToSchemaKey(section);
    const tier = getTierOfSection(key);

    if (tier === 3 || tier === 4) return false;

    const sectionWrapper = firestoreData ? firestoreData[key] : null;
    if (sectionWrapper && sectionWrapper.frozen === true) return false;

    const ds = firestoreData && firestoreData.dataSources ? firestoreData.dataSources[key] : null;
    if (ds && ds.source === 'student_login') {
      const writtenAt = ds.writtenAt ? new Date(ds.writtenAt).getTime() : 0;
      const days = (Date.now() - writtenAt) / (1000 * 60 * 60 * 24);
      if (days < 180) return false;
    }

    return true;
  }

  function detectSemesterChange(storedProfile, portalProfile) {
    if (!storedProfile || !portalProfile) return false;
    const storedSem = storedProfile.semester || (storedProfile.data && storedProfile.data.semester) || '';
    const portalSem = portalProfile.semester || (portalProfile.data && portalProfile.data.semester) || '';
    if (!storedSem || !portalSem) return false;
    return normalizeSemester(storedSem) !== normalizeSemester(portalSem);
  }

  function isPassedOut(profileData) {
    if (!profileData) return false;
    const batch = profileData.batch || '';
    if (batch) {
      const match = batch.match(/\d{4}\s*[-]\s*(\d{4})/);
      if (match) {
        const endYear = parseInt(match[1]);
        const currentYear = new Date().getFullYear();
        if (endYear < currentYear) {
          return true;
        }
      }
    }
    return false;
  }

  async function deleteStudentRecords(admissionNumber, db) {
    const isNode = typeof db.collection === 'function';
    if (isNode) {
      const docRef = db.collection('students').doc(admissionNumber);
      const snap = await docRef.get();
      if (snap.exists) {
        const data = snap.data();
        const studentName = data.studentName || data.name;
        if (studentName) {
          await db.collection('students_by_name').doc(studentName).delete();
        }
      }
      // Delete semester marks doc if any
      await db.collection('marks').doc(admissionNumber).delete();
      await docRef.delete();
    } else {
      const docRef = window.firestoreDoc(db, 'students', admissionNumber);
      const snap = await window.firestoreGetDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        const studentName = data.studentName || data.name;
        if (studentName) {
          const docRefName = window.firestoreDoc(db, 'students_by_name', studentName);
          await window.firestoreSetDoc(docRefName, null);
        }
      }
      await window.firestoreSetDoc(docRef, null);
    }
  }

  async function archiveSemesterData(admissionNumber, db, newSemester = '') {
    const isNode = typeof db.collection === 'function';
    let currentData = null;
    let docRef;

    if (isNode) {
      docRef = db.collection('students').doc(admissionNumber);
      const snap = await docRef.get();
      if (snap.exists) currentData = snap.data();
    } else {
      docRef = window.firestoreDoc(db, 'students', admissionNumber);
      const snap = await window.firestoreGetDoc(docRef);
      if (snap.exists()) currentData = snap.data();
    }

    if (!currentData) return { archived: false, reason: 'No student data found' };

    const storedProfile = currentData.profile || {};
    const storedProfileData = storedProfile.data || {};
    const oldSemester = normalizeSemester(storedProfileData.semester || currentData.semester || 'UNKNOWN SEMESTER');

    const semesterHistory = currentData.semesterHistory || {};
    semesterHistory[oldSemester] = {
      subjects:           currentData.subjects?.data || null,
      internalMarks:      currentData.internalMarks?.data || null,
      modelExam:          currentData.modelExam?.data || null,
      internalUniversity: currentData.internalUniversity?.data || null,
      examResult:         currentData.examResult?.data || null,
      archivedAt:         new Date().toISOString()
    };

    const update = {
      semesterHistory,
      subjects: { data: null, cachedAt: new Date().toISOString(), semester: '', tier: 2 },
      internalMarks: { data: null, cachedAt: new Date().toISOString(), semester: '', tier: 2, frozen: false },
      modelExam: { data: null, cachedAt: new Date().toISOString(), semester: '', tier: 2, frozen: false },
      internalUniversity: { data: null, cachedAt: new Date().toISOString(), semester: '', tier: 2, frozen: false },
      examResult: { data: null, cachedAt: new Date().toISOString(), semester: '', tier: 2, published: false, frozen: false },

      attendanceSubjectWise: { data: null, cachedAt: new Date().toISOString(), tier: 3, ttl: 1800000 },
      attendanceDetails: { data: null, cachedAt: new Date().toISOString(), tier: 3, ttl: 1800000 },
      assignments: { data: null, cachedAt: new Date().toISOString(), tier: 3, ttl: 3600000 },
      seminars: { data: null, cachedAt: new Date().toISOString(), tier: 3, ttl: 86400000 }
    };

    if (newSemester) {
      update.profile = {
        ...storedProfile,
        data: {
          ...storedProfileData,
          semester: newSemester
        },
        cachedAt: new Date().toISOString()
      };
      update.semester = newSemester;
    }

    if (isNode) {
      await docRef.set(update, { merge: true });
    } else {
      await window.firestoreSetDoc(docRef, update, { merge: true });
    }

    return { archived: true, oldSemester, newSemester };
  }

  async function freezeSection(admissionNumber, section, db) {
    const isNode = typeof db.collection === 'function';
    const key = mapSectionToSchemaKey(section);
    const update = { [key]: { frozen: true } };

    if (isNode) {
      await db.collection('students').doc(admissionNumber).set(update, { merge: true });
    } else {
      const docRef = window.firestoreDoc(db, 'students', admissionNumber);
      await window.firestoreSetDoc(docRef, update, { merge: true });
    }
    return { frozen: true };
  }

  function getPayloadForSchema(section, data) {
    const s = section.toLowerCase();
    if (s === 'attendance') {
      return {
        attendanceSubjectWise: {
          data: data.subjectSummary || data.subjectWise || data.rows || null,
          cachedAt: new Date().toISOString(),
          tier: 3,
          ttl: 1800000
        },
        attendanceDetails: {
          data: data.detailsLog || data.details || null,
          cachedAt: new Date().toISOString(),
          tier: 3,
          ttl: 1800000
        }
      };
    }

    const key = mapSectionToSchemaKey(section);
    const tier = getTierOfSection(key);
    const wrapper = {
      data: data,
      cachedAt: new Date().toISOString(),
      tier: tier
    };

    if (key === 'subjects' || key === 'internalMarks' || key === 'modelExam' || key === 'internalUniversity' || key === 'examResult') {
      wrapper.semester = '';
    }
    if (key === 'examResult') {
      wrapper.published = data !== null;
      wrapper.frozen = false;
    }
    if (key === 'internalMarks' || key === 'modelExam' || key === 'internalUniversity' || key === 'hallTicket') {
      wrapper.frozen = false;
    }
    if (key === 'attendanceSubjectWise' || key === 'attendanceDetails') {
      wrapper.ttl = 1800000;
    }
    if (key === 'assignments') {
      wrapper.ttl = 3600000;
    }
    if (key === 'seminars') {
      wrapper.ttl = 86400000;
    }
    if (key === 'onlineExam') {
      wrapper.ttl = 900000;
    }
    if (key === 'feePayment') {
      wrapper.ttl = 86400000;
    }
    if (key === 'feedback') {
      wrapper.ttl = 86400000;
    }

    return { [key]: wrapper };
  }

  async function writeWithConflictCheck(admissionNumber, section, data, source, db) {
    const isNode = typeof db.collection === 'function';
    let existingData = null;
    let docRef;

    if (isNode) {
      docRef = db.collection('students').doc(admissionNumber);
      const snap = await docRef.get();
      if (snap.exists) existingData = snap.data();
    } else {
      docRef = window.firestoreDoc(db, 'students', admissionNumber);
      const snap = await window.firestoreGetDoc(docRef);
      if (snap.exists()) existingData = snap.data();
    }

    const key = mapSectionToSchemaKey(section);

    // Auto remove passout students check
    const rawData = getRawData(section, data);
    if (key === 'profile' && rawData) {
      const profileData = rawData.sections?.[0]?.data || rawData;
      if (isPassedOut(profileData)) {
        await deleteStudentRecords(admissionNumber, db);
        return { written: false, deleted: true, reason: 'Passed out student auto-removed' };
      }
    }

    // Check frozen status
    const existingSection = existingData ? existingData[key] : null;
    if (existingSection && existingSection.frozen === true && source !== 'admin_force' && source !== 'admin_unfreeze') {
      return { written: false, reason: 'Section is frozen' };
    }

    // Check sweep rules
    if (source === 'sweep') {
      const tier = getTierOfSection(key);
      if (tier === 3 || tier === 4) {
        return { written: false, reason: 'Sweep cannot write Tier 3 or Tier 4 sections' };
      }

      const ds = existingData && existingData.dataSources ? existingData.dataSources[key] : null;
      if (ds && ds.source === 'student_login') {
        const writtenAt = ds.writtenAt ? new Date(ds.writtenAt).getTime() : 0;
        const days = (Date.now() - writtenAt) / (1000 * 60 * 60 * 24);
        if (days < 180) {
          return { written: false, reason: 'Protected by student_login within 180 days' };
        }
      }
    }

    // Prepare payload
    const payloads = getPayloadForSchema(section, rawData);
    const currentSem = existingData?.profile?.data?.semester || existingData?.semester || '';
    const nowStr = new Date().toISOString();

    for (const k in payloads) {
      if (payloads[k] && 'semester' in payloads[k]) {
        payloads[k].semester = currentSem;
      }
    }

    if (key === 'examResult' && rawData !== null) {
      payloads.examResult.published = true;
      payloads.examResult.frozen = true; // freeze on publication
    }

    if (key === 'hallTicket' && rawData && rawData.status === 'generated') {
      payloads.hallTicket.frozen = true;
    }

    const dataSources = existingData?.dataSources || {};
    for (const k in payloads) {
      dataSources[k] = {
        source: source === 'admin_force' ? 'student_login' : source,
        writtenAt: nowStr
      };
    }

    // Handle student info top level helper properties
    let studentName = existingData?.studentName || existingData?.name || '';
    let dept = existingData?.department || '';
    let semester = existingData?.semester || '';
    
    if (key === 'profile' && rawData) {
      const profileData = rawData.sections?.[0]?.data || rawData;
      studentName = profileData.name || studentName;
      dept = profileData.department || profileData.course || dept;
      semester = profileData.semester || semester;
    }

    const update = {
      ...payloads,
      dataSources,
      admissionNumber
    };

    if (studentName) {
      update.studentName = studentName;
      update.name = studentName;
    }
    if (dept) update.department = dept;
    if (semester) update.semester = semester;

    if (!existingData || !existingData.createdAt) {
      update.createdAt = nowStr;
    }

    if (source === 'student_login') {
      update.lastStudentLoginAt = nowStr;
    }

    if (source === 'sweep') {
      const sweepData = existingData?.sweepData || {};
      sweepData.discoveredAt = sweepData.discoveredAt || nowStr;
      sweepData.sweepCompletedAt = nowStr;
      sweepData.source = sweepData.source ? (sweepData.source === 'student_login' ? 'both' : sweepData.source) : 'sweep';

      const completedSections = sweepData.completedSections || {};
      for (const k in payloads) {
        completedSections[k] = true;
      }
      sweepData.completedSections = completedSections;
      update.sweepData = sweepData;
    }

    if (isNode) {
      await docRef.set(update, { merge: true });
      if (studentName) {
        await db.collection('students_by_name').doc(studentName).set(update, { merge: true });
      }
    } else {
      await window.firestoreSetDoc(docRef, update, { merge: true });
      if (studentName) {
        const docRefName = window.firestoreDoc(db, 'students_by_name', studentName);
        await window.firestoreSetDoc(docRefName, update, { merge: true });
      }
    }

    return { written: true, key, data: rawData };
  }

  return {
    normalizeSemester: normalizeSemester,
    isStale: isStale,
    shouldSweepWrite: shouldSweepWrite,
    detectSemesterChange: detectSemesterChange,
    isPassedOut: isPassedOut,
    deleteStudentRecords: deleteStudentRecords,
    archiveSemesterData: archiveSemesterData,
    freezeSection: freezeSection,
    writeWithConflictCheck: writeWithConflictCheck,
    mapSectionToSchemaKey: mapSectionToSchemaKey
  };
}));
