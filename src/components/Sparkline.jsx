/** Tiny SVG sparkline from price array. */
export default function Sparkline({ prices, width = 64, height = 24 }) {
  if (!prices?.length || prices.length < 2) return null;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const points = prices
    .map((p, i) => {
      const x = (i / (prices.length - 1)) * width;
      const y = height - ((p - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  const up = prices[prices.length - 1] >= prices[0];

  return (
    <svg width={width} height={height} className="sparkline" aria-hidden>
      <polyline
        fill="none"
        stroke={up ? 'var(--accent)' : 'var(--danger)'}
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
}
