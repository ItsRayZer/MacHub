import { create } from 'zustand';
import type { SettingsView, Toast, AppSettings, GrievanceSubmission } from '@/types';
import { defaultAppSettings } from '@/data/mockData';

interface MacHubStore {
  isSettingsOpen: boolean;
  currentSettingsView: SettingsView;
  previousViews: SettingsView[];
  openSettings: () => void;
  closeSettings: () => void;
  navigateTo: (view: SettingsView) => void;
  navigateBack: () => void;
  resetToRoot: () => void;
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  appSettings: AppSettings;
  updateAppSettings: (settings: Partial<AppSettings>) => void;
  displayName: string;
  customBio: string;
  setDisplayName: (name: string) => void;
  setCustomBio: (bio: string) => void;
  grievanceForm: { category: string; subject: string; description: string };
  setGrievanceForm: (form: Partial<{ category: string; subject: string; description: string }>) => void;
  submitGrievance: () => GrievanceSubmission | null;
  passwordForm: { current: string; new: string; confirm: string };
  setPasswordForm: (form: Partial<{ current: string; new: string; confirm: string }>) => void;
  isClearingCache: boolean;
  setClearingCache: (val: boolean) => void;
}

let toastIdCounter = 0;

export const useStore = create<MacHubStore>((set, get) => ({
  isSettingsOpen: false,
  currentSettingsView: 'root',
  previousViews: [],
  openSettings: () => set({ isSettingsOpen: true, currentSettingsView: 'root', previousViews: [] }),
  closeSettings: () => set({ isSettingsOpen: false, currentSettingsView: 'root', previousViews: [] }),
  navigateTo: (view: SettingsView) => {
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
  showToast: (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `toast-${++toastIdCounter}`;
    set((state: MacHubStore) => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((state: MacHubStore) => ({ toasts: state.toasts.filter((t: Toast) => t.id !== id) }));
    }, 3000);
  },
  removeToast: (id: string) =>
    set((state: MacHubStore) => ({ toasts: state.toasts.filter((t: Toast) => t.id !== id) })),

  appSettings: defaultAppSettings,
  updateAppSettings: (settings: Partial<AppSettings>) =>
    set((state: MacHubStore) => ({ appSettings: { ...state.appSettings, ...settings } })),

  displayName: 'Pranav Suresh',
  customBio: '',
  setDisplayName: (name: string) => set({ displayName: name }),
  setCustomBio: (bio: string) => set({ customBio: bio }),

  grievanceForm: { category: '', subject: '', description: '' },
  setGrievanceForm: (form: Partial<{ category: string; subject: string; description: string }>) =>
    set((state: MacHubStore) => ({ grievanceForm: { ...state.grievanceForm, ...form } })),
  submitGrievance: () => {
    const { grievanceForm } = get();
    if (!grievanceForm.category || !grievanceForm.subject || !grievanceForm.description) {
      get().showToast('Please fill all fields', 'error');
      return null;
    }
    const submission: GrievanceSubmission = {
      id: `g${Date.now()}`,
      category: grievanceForm.category as GrievanceSubmission['category'],
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
  setPasswordForm: (form: Partial<{ current: string; new: string; confirm: string }>) =>
    set((state: MacHubStore) => ({ passwordForm: { ...state.passwordForm, ...form } })),

  isClearingCache: false,
  setClearingCache: (val: boolean) => set({ isClearingCache: val }),
}));
