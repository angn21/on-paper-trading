import { useEffect, useRef } from 'react';
import { formatCurrency } from '../lib/formatters';

export default function AnimatedCurrency({ value, className = '' }) {
  const prev = useRef(value);
  const ref = useRef(null);

  useEffect(() => {
    if (prev.current === value || !ref.current) return;
    ref.current.classList.remove('flash-up', 'flash-down');
    ref.current.classList.add(value > prev.current ? 'flash-up' : 'flash-down');
    prev.current = value;
    const timer = window.setTimeout(() => {
      ref.current?.classList.remove('flash-up', 'flash-down');
    }, 700);
    return () => window.clearTimeout(timer);
  }, [value]);

  return (
    <span ref={ref} className={`animated-value tabular ${className}`}>
      {formatCurrency(value)}
    </span>
  );
}
