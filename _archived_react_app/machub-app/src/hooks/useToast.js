import { useState, useEffect, useCallback } from 'react';

export const useToast = () => {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
  }, []);

  return { toast, showToast };
};
