import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    function onKeyDown(event) {
      if (event.target.matches('input, textarea, select')) return;

      if (event.key === '/') {
        event.preventDefault();
        navigate('/search');
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);
}
