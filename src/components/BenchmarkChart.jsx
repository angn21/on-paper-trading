import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useMemo } from 'react';

export default function BenchmarkChart({ portfolioHistory, benchmarkHistory }) {
  const data = useMemo(() => {
    if (!portfolioHistory?.length) return [];

    const startPortfolio = portfolioHistory[0].totalValue || 1;
    const startSpy = benchmarkHistory?.[0]?.spyPrice || 1;

    return portfolioHistory.map((point, i) => {
      const bench = benchmarkHistory?.[i];
      const label = new Date(point.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return {
        label,
        portfolio: ((point.totalValue / startPortfolio) - 1) * 100,
        spy: bench?.spyPrice ? ((bench.spyPrice / startSpy) - 1) * 100 : null,
      };
    });
  }, [portfolioHistory, benchmarkHistory]);

  if (data.length < 2) return null;

  return (
    <div className="card">
      <h2 className="card-title">vs SPY benchmark</h2>
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--text-muted)" />
            <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} stroke="var(--text-muted)" width={40} />
            <Tooltip formatter={(v) => `${Number(v).toFixed(2)}%`} />
            <Line type="monotone" dataKey="portfolio" stroke="var(--accent)" dot={false} strokeWidth={2} name="Portfolio" />
            <Line type="monotone" dataKey="spy" stroke="#888" dot={false} strokeWidth={1.5} name="SPY" strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="chart-footnote">Indexed to first snapshot. SPY updates when quotes refresh.</p>
    </div>
  );
}
