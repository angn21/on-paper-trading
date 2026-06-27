import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { usePortfolio } from '../../hooks/usePortfolio';
import {
  computeChartYDomain,
  chartTooltipProps,
  formatChartTick,
  formatChartTooltipLabel,
  formatPortfolioAxisValue,
  historyToChartPoints,
} from '../../lib/chartLabels';
import { formatCurrency } from '../../lib/formatters';

const RANGES = ['D', 'W', 'M', 'Y'];
const WINDOWS = {
  D: 24 * 3600 * 1000,
  W: 7 * 24 * 3600 * 1000,
  M: 30 * 24 * 3600 * 1000,
  Y: 365 * 24 * 3600 * 1000,
};

export default function PortfolioChart() {
  const { portfolioHistory } = usePortfolio();
  const [range, setRange] = useState('M');

  const data = useMemo(
    () => historyToChartPoints(portfolioHistory, range, WINDOWS),
    [portfolioHistory, range],
  );

  const yDomain = useMemo(
    () => computeChartYDomain(data.map((point) => point.value)),
    [data],
  );

  const valueSpan = useMemo(() => {
    const values = data.map((point) => point.value);
    if (!values.length) return 0;
    return Math.max(...values) - Math.min(...values);
  }, [data]);

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
            <XAxis
              dataKey="ts"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(ts) => formatChartTick(ts, data, range)}
              tick={{ fill: '#8E8E93', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={yDomain}
              tick={{ fill: '#8E8E93', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => formatPortfolioAxisValue(value, valueSpan)}
              width={52}
            />
            <Tooltip
              {...chartTooltipProps}
              labelFormatter={formatChartTooltipLabel}
              formatter={(value) => [formatCurrency(value), 'Value']}
            />
            <Area type="monotone" dataKey="value" stroke="#1ED760" fill="url(#portfolioFill)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
