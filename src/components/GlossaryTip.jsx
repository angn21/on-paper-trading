import { GLOSSARY } from '../lib/glossary';

export default function GlossaryTip({ term, children }) {
  const text = GLOSSARY[term] || '';
  if (!text) return children;

  return (
    <span className="glossary-tip" title={text}>
      {children}
      <span className="glossary-icon" aria-label={text}> ⓘ</span>
    </span>
  );
}
