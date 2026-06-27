/**
 * Student store — Zustand global state for admission number and student profile.
 * Persists admission number to localStorage.
 */
import { create } from 'zustand';

const STORAGE_KEY = 'machub_adm';
const UID_KEY = 'machub_uid';

export const useStudentStore = create((set, get) => ({
  admissionNumber: localStorage.getItem(STORAGE_KEY) || '',
  firebaseUid: localStorage.getItem(UID_KEY) || '',
  profile: null,
  subjects: null,
  attendanceSubjectWise: null,
  assessment: null,
  customProfile: null,
  isLoggedIn: Boolean(localStorage.getItem(STORAGE_KEY)),
  isFirstLogin: false,
  error: null,

  security: {
    isProfileClaimed: false,
    pinLength: 4,
    isUnlocked: false,
    deviceToken: localStorage.getItem('machub_device_token') || null,
    verificationQuestions: [],
    currentAdmissionNumber: null,
    loading: false,
    error: null,
  },

  setSecurityClaimed: (claimed) => set((state) => ({ security: { ...state.security, isProfileClaimed: claimed } })),
  setSecurityUnlocked: (unlocked) => set((state) => ({ security: { ...state.security, isUnlocked: unlocked } })),
  setSecurityDeviceToken: (token) => {
    if (token) localStorage.setItem('machub_device_token', token);
    else localStorage.removeItem('machub_device_token');
    set((state) => ({ security: { ...state.security, deviceToken: token } }));
  },
  setSecurityPinLength: (length) => set((state) => ({ security: { ...state.security, pinLength: length } })),
  setSecurityVerificationQuestions: (questions) => set((state) => ({ security: { ...state.security, verificationQuestions: questions } })),
  setSecurityCurrentAdmissionNumber: (id) => set((state) => ({ security: { ...state.security, currentAdmissionNumber: id } })),
  setSecurityLoading: (loading) => set((state) => ({ security: { ...state.security, loading } })),
  setSecurityError: (error) => set((state) => ({ security: { ...state.security, error } })),

  setAdmissionNumber: (adm) => {
    localStorage.setItem(STORAGE_KEY, adm);
    set({ admissionNumber: adm, isLoggedIn: true });
  },

  setFirebaseUid: (uid) => {
    localStorage.setItem(UID_KEY, uid);
    set({ firebaseUid: uid });
  },

  setProfile: (profile) => set({ profile }),
  setProfileData: (data) => set({ profile: { data } }),
  setSubjectsData: (data) => set({ subjects: { data } }),
  setAttendanceSubjectWiseData: (data) => set({ attendanceSubjectWise: { data } }),
  setAssessmentData: (data) => set({ assessment: { data } }),
  setCustomProfile: (customProfile) => set({ customProfile }),

  setFirstLogin: (isFirst) => set({ isFirstLogin: isFirst }),

  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(UID_KEY);
    set({
      admissionNumber: '',
      firebaseUid: '',
      profile: null,
      subjects: null,
      attendanceSubjectWise: null,
      assessment: null,
      customProfile: null,
      isLoggedIn: false,
      isFirstLogin: false,
      error: null,
    });
  },

  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));
