import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useMemo } from 'react';
import {
  computeChartYDomain,
  chartTooltipProps,
  formatChartTick,
  formatChartTooltipLabel,
  formatPercentAxisValue,
} from '../lib/chartLabels';

export default function BenchmarkChart({ portfolioHistory, benchmarkHistory }) {
  const data = useMemo(() => {
    if (!portfolioHistory?.length) return [];

    const startPortfolio = portfolioHistory[0].totalValue || 1;
    const startSpy = benchmarkHistory?.[0]?.spyPrice || 1;

    return portfolioHistory.map((point, i) => {
      const bench = benchmarkHistory?.[i];
      return {
        ts: point.ts,
        portfolio: ((point.totalValue / startPortfolio) - 1) * 100,
        spy: bench?.spyPrice ? ((bench.spyPrice / startSpy) - 1) * 100 : null,
      };
    });
  }, [portfolioHistory, benchmarkHistory]);

  const yDomain = useMemo(() => {
    const values = data.flatMap((point) => [point.portfolio, point.spy].filter((v) => v != null));
    return computeChartYDomain(values);
  }, [data]);

  const percentSpan = useMemo(() => {
    const values = data.flatMap((point) => [point.portfolio, point.spy].filter((v) => v != null));
    if (!values.length) return 0;
    return Math.max(...values) - Math.min(...values);
  }, [data]);

  if (data.length < 2) return null;

  return (
    <div className="card">
      <h2 className="card-title">vs SPY benchmark</h2>
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <XAxis
              dataKey="ts"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(ts) => formatChartTick(ts, data, 'M')}
              tick={{ fill: '#8E8E93', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={yDomain}
              tickFormatter={(v) => formatPercentAxisValue(v, percentSpan)}
              tick={{ fill: '#8E8E93', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              {...chartTooltipProps}
              labelFormatter={formatChartTooltipLabel}
              formatter={(value, name) => [`${Number(value).toFixed(2)}%`, name]}
            />
            <Line type="monotone" dataKey="portfolio" stroke="var(--accent)" dot={false} strokeWidth={2} name="Portfolio" />
            <Line type="monotone" dataKey="spy" stroke="#888" dot={false} strokeWidth={1.5} name="SPY" strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="chart-footnote">Indexed to first snapshot. SPY updates when quotes refresh.</p>
    </div>
  );
}
