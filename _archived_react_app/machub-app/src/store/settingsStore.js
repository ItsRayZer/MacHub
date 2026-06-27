import { create } from 'zustand';

const defaultAppSettings = {
  themeMode: 'dark',
  attendanceAlerts: true,
  marksNotifications: true,
  feeDueReminders: true,
  generalAnnouncements: false,
  syncFrequency: 'hourly',
};

let toastIdCounter = 0;

export const useSettingsStore = create((set, get) => ({
  isSettingsOpen: false,
  currentSettingsView: 'root',
  previousViews: [],
  openSettings: () => set({ isSettingsOpen: true, currentSettingsView: 'root', previousViews: [] }),
  closeSettings: () => set({ isSettingsOpen: false, currentSettingsView: 'root', previousViews: [] }),
  navigateTo: (view) => {
    const state = get();
    set({
      previousViews: [...state.previousViews, state.currentSettingsView],
      currentSettingsView: view,
    });
  },
  navigateBack: () => {
    const state = get();
    const prev = state.previousViews;
    if (prev.length === 0) {
      set({ isSettingsOpen: false, currentSettingsView: 'root' });
      return;
    }
    const lastView = prev[prev.length - 1];
    set({
      currentSettingsView: lastView,
      previousViews: prev.slice(0, -1),
    });
  },
  resetToRoot: () => set({ currentSettingsView: 'root', previousViews: [] }),

  toasts: [],
  showToast: (message, type = 'info') => {
    const id = `toast-${++toastIdCounter}`;
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 3000);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  appSettings: defaultAppSettings,
  updateAppSettings: (settings) =>
    set((state) => ({ appSettings: { ...state.appSettings, ...settings } })),

  displayName: 'Pranav Suresh',
  customBio: '',
  setDisplayName: (name) => set({ displayName: name }),
  setCustomBio: (bio) => set({ customBio: bio }),

  grievanceForm: { category: '', subject: '', description: '' },
  setGrievanceForm: (form) =>
    set((state) => ({ grievanceForm: { ...state.grievanceForm, ...form } })),
  submitGrievance: () => {
    const { grievanceForm } = get();
    if (!grievanceForm.category || !grievanceForm.subject || !grievanceForm.description) {
      get().showToast('Please fill all fields', 'error');
      return null;
    }
    const submission = {
      id: `g${Date.now()}`,
      category: grievanceForm.category,
      subject: grievanceForm.subject,
      description: grievanceForm.description,
      status: 'pending',
      submittedDate: new Date().toISOString(),
    };
    set({ grievanceForm: { category: '', subject: '', description: '' } });
    get().showToast('Grievance submitted successfully', 'success');
    return submission;
  },

  passwordForm: { current: '', new: '', confirm: '' },
  setPasswordForm: (form) =>
    set((state) => ({ passwordForm: { ...state.passwordForm, ...form } })),

  isClearingCache: false,
  setClearingCache: (val) => set({ isClearingCache: val }),
}));
