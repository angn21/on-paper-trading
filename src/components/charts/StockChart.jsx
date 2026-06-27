import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { marketData } from '../../marketData/marketData';
import { formatChartLabel, formatCurrency } from '../../lib/formatters';

const RANGES = ['D', 'W', 'M', 'Y'];

export default function StockChart({ symbol }) {
  const [range, setRange] = useState('D');
  const [candles, setCandles] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    marketData
      .getCandles(symbol, range)
      .then((data) => {
        if (!cancelled) setCandles(data);
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load chart data.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range, symbol]);

  const data = useMemo(() => {
    if (!candles?.t?.length) return [];
    return candles.t.map((ts, index) => ({
      ts,
      label: formatChartLabel(ts, range),
      price: candles.c[index],
    }));
  }, [candles, range]);

  const isApproximate = candles?._source === 'approximate';

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 className="card-title" style={{ margin: 0 }}>Price Chart</h2>
        <div className="pill-group">
          {RANGES.map((item) => (
            <button
              key={item}
              type="button"
              className={range === item ? 'pill active' : 'pill'}
              onClick={() => setRange(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {isApproximate && (
        <div className="banner banner-warning" style={{ marginBottom: 12 }}>
          Chart data approximate — add TWELVE_DATA_API_KEY for live historical prices.
        </div>
      )}

      {candles?._cached && !isApproximate && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 8 }}>
          Cached chart — saves API credits on reload.
        </div>
      )}

      {loading && <div className="skeleton" style={{ height: 220 }} />}

      {!loading && error && <div className="empty-state">{error}</div>}

      {!loading && !error && data.length > 0 && (
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="stockFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1ED760" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#1ED760" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fill: '#8E8E93', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                minTickGap={32}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: '#8E8E93', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `$${Math.round(value)}`}
                width={52}
              />
              <Tooltip
                contentStyle={{ background: '#16161D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}
                labelStyle={{ color: '#8E8E93' }}
                formatter={(value) => [formatCurrency(value), 'Price']}
              />
              <Area type="monotone" dataKey="price" stroke="#1ED760" fill="url(#stockFill)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
