function sameCalendarDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate()
  );
}

/** X-axis tick — show time when all points fall on one day. */
export function formatChartTick(ts, points, range = 'M') {
  const date = new Date(ts);
  if (range === 'D') {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  const allSameDay = points.length > 1 && points.every((p) => sameCalendarDay(p.ts, points[0].ts));
  if (allSameDay) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  if (range === 'Y') {
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Tooltip heading — always include time for clarity. */
export function formatChartTooltipLabel(ts) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function historyToChartPoints(history, range, windows) {
  if (!history.length) return [];
  const now = Date.now();
  const cutoff = now - windows[range];
  const filtered = history.filter((point) => point.ts >= cutoff);
  return (filtered.length ? filtered : history.slice(-20)).map((point) => ({
    ts: point.ts,
    value: point.totalValue,
  }));
}

/** Pad a flat or narrow range so Recharts can draw meaningful ticks. */
export function computeChartYDomain(values) {
  if (!values.length) return ['auto', 'auto'];

  const numeric = values.filter((v) => v != null && !Number.isNaN(v));
  if (!numeric.length) return ['auto', 'auto'];

  const min = Math.min(...numeric);
  const max = Math.max(...numeric);
  const span = max - min;

  if (span === 0) {
    const pad = Math.max(Math.abs(max) * 0.002, 1);
    return [min - pad, max + pad];
  }

  const padding = Math.max(span * 0.15, Math.abs(max) * 0.0005);
  return [min - padding, max + padding];
}

export function formatPortfolioAxisValue(value, span) {
  if (span < 2_000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (span < 20_000) {
    return `$${(value / 1000).toFixed(1)}k`;
  }
  return `$${Math.round(value / 1000)}k`;
}

export function formatPercentAxisValue(value, span) {
  if (span < 0.15) return `${value.toFixed(2)}%`;
  if (span < 1.5) return `${value.toFixed(1)}%`;
  return `${value.toFixed(0)}%`;
}
