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
  isLoggedIn: Boolean(localStorage.getItem(STORAGE_KEY)),
  isFirstLogin: false,
  error: null,

  setAdmissionNumber: (adm) => {
    localStorage.setItem(STORAGE_KEY, adm);
    set({ admissionNumber: adm, isLoggedIn: true });
  },

  setFirebaseUid: (uid) => {
    localStorage.setItem(UID_KEY, uid);
    set({ firebaseUid: uid });
  },

  setProfile: (profile) => set({ profile }),

  setFirstLogin: (isFirst) => set({ isFirstLogin: isFirst }),

  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(UID_KEY);
    set({
      admissionNumber: '',
      firebaseUid: '',
      profile: null,
      isLoggedIn: false,
      isFirstLogin: false,
      error: null,
    });
  },

  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));
