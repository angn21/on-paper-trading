import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { usePortfolio } from '../hooks/usePortfolio';
import { formatCurrency, formatPercent } from '../lib/formatters';
import { getSector } from '../lib/sectors';

const COLORS = [
  '#1ed760',
  '#5ac8fa',
  '#ff9f0a',
  '#bf5af2',
  '#ff453a',
  '#64d2ff',
  '#ffd60a',
  '#ac8e68',
  '#8e8e93',
];

export default function SectorAllocation() {
  const { stockPositions } = usePortfolio();

  const { sectors, total } = useMemo(() => {
    const map = {};
    stockPositions.forEach((pos) => {
      const sector = getSector(pos.symbol);
      const exposure = Math.abs(pos.marketValue);
      map[sector] = (map[sector] || 0) + exposure;
    });
    const items = Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const sum = items.reduce((s, i) => s + i.value, 0);
    return { sectors: items, total: sum };
  }, [stockPositions]);

  if (!sectors.length || total <= 0) return null;

  return (
    <div className="card">
      <h2 className="card-title">Sector exposure</h2>
      <div className="sector-pie-wrap">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={sectors}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
            >
              {sectors.map((entry, index) => (
                <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatCurrency(value)}
              contentStyle={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="sector-legend">
        {sectors.map((item, index) => (
          <li key={item.name}>
            <span className="sector-swatch" style={{ background: COLORS[index % COLORS.length] }} />
            <span>{item.name}</span>
            <span className="tabular">{formatPercent((item.value / total) * 100, 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
