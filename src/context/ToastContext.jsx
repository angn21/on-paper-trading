import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, undoFn = null) => {
    setToast({ message, undoFn });
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => setToast(null), 5000);
  }, []);

  const dismiss = useCallback(() => {
    window.clearTimeout(showToast._timer);
    setToast(null);
  }, []);

  const value = useMemo(() => ({ toast, showToast, dismiss }), [toast, showToast, dismiss]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast requires ToastProvider');
  return ctx;
}
