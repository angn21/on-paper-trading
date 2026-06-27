export function formatCurrency(value, decimals = 2) {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value, decimals = 2) {
  if (value == null || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatShares(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: 4 });
}

export function formatDate(ts) {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(ts) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatShortDate(ts) {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/** Format x-axis labels based on chart range (D/W/M/Y). */
export function formatChartLabel(ts, range) {
  const date = new Date(ts * 1000);
  if (range === 'D') {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  if (range === 'Y') {
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function plClass(value) {
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return '';
}
