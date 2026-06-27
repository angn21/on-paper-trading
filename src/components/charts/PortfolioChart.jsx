import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { usePortfolio } from '../../hooks/usePortfolio';
import { formatCurrency } from '../../lib/formatters';

const RANGES = ['D', 'W', 'M', 'Y'];

function filterHistory(history, range) {
  if (!history.length) return [];
  const now = Date.now();
  const windows = {
    D: 24 * 3600 * 1000,
    W: 7 * 24 * 3600 * 1000,
    M: 30 * 24 * 3600 * 1000,
    Y: 365 * 24 * 3600 * 1000,
  };
  const cutoff = now - windows[range];
  const filtered = history.filter((point) => point.ts >= cutoff);
  return filtered.length ? filtered : history.slice(-20);
}

export default function PortfolioChart() {
  const { portfolioHistory } = usePortfolio();
  const [range, setRange] = useState('M');

  useEffect(() => {
    if (portfolioHistory.length === 0) {
      // Seed a starting point so the chart isn't empty on first load.
    }
  }, [portfolioHistory.length]);

  const data = useMemo(() => {
    return filterHistory(portfolioHistory, range).map((point) => ({
      ts: point.ts,
      label: new Date(point.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: point.totalValue,
    }));
  }, [portfolioHistory, range]);

  if (!data.length) {
    return (
      <div className="card">
        <div className="card-title">Portfolio Value</div>
        <div className="empty-state">Trade or refresh quotes to start tracking portfolio value over time.</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 className="card-title" style={{ margin: 0 }}>Portfolio Value</h2>
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

      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1ED760" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#1ED760" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fill: '#8E8E93', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fill: '#8E8E93', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `$${Math.round(value / 1000)}k`}
              width={42}
            />
            <Tooltip
              contentStyle={{ background: '#16161D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}
              labelStyle={{ color: '#8E8E93' }}
              formatter={(value) => [formatCurrency(value), 'Value']}
            />
            <Area type="monotone" dataKey="value" stroke="#1ED760" fill="url(#portfolioFill)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
