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
