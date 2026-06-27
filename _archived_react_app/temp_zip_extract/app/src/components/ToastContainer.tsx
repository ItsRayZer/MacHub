import { useStore } from '@/store/useStore';
import type { Toast } from '@/types';

export default function ToastContainer() {
  const toasts = useStore((s: { toasts: Toast[] }) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast: Toast) => (
        <div
          key={toast.id}
          className="animate-toastIn px-5 py-3 rounded-full text-sm font-medium shadow-2xl flex items-center gap-2 pointer-events-auto"
          style={{
            background:
              toast.type === 'error'
                ? 'rgba(239, 68, 68, 0.9)'
                : toast.type === 'success'
                ? 'rgba(0, 212, 170, 0.9)'
                : 'rgba(56, 151, 240, 0.9)',
            backdropFilter: 'blur(20px) saturate(150%)',
            WebkitBackdropFilter: 'blur(20px) saturate(150%)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3)',
            color: '#fff',
          }}
        >
          <span className="text-base">
            {toast.type === 'error' ? '⚠️' : toast.type === 'success' ? '✓' : 'ℹ️'}
          </span>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
