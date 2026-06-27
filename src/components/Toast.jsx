import { useToast } from '../context/ToastContext';
import './Toast.css';

export default function Toast() {
  const { toast, dismiss } = useToast();
  if (!toast) return null;

  return (
    <div className="toast-bar" role="status">
      <span>{toast.message}</span>
      <div className="toast-actions">
        {toast.undoFn && (
          <button type="button" className="toast-undo" onClick={() => { toast.undoFn(); dismiss(); }}>
            Undo
          </button>
        )}
        <button type="button" className="toast-dismiss" onClick={dismiss}>✕</button>
      </div>
    </div>
  );
}
