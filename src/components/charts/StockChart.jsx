import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { chartTooltipProps } from '../../lib/chartLabels';
import { usePortfolio } from '../../hooks/usePortfolio';
import { marketData } from '../../marketData/marketData';
import { formatChartLabel, formatCurrency } from '../../lib/formatters';

const RANGES = ['D', 'W', 'M', 'Y'];

const MARKER_COLORS = {
  buy: '#1ED760',
  sell: '#ff453a',
  short: '#ff9f0a',
  cover: '#5ac8fa',
};

function snapTradesToChart(trades, chartData) {
  if (!chartData.length) return [];

  const minTs = chartData[0].ts;
  const maxTs = chartData[chartData.length - 1].ts;

  return trades
    .filter((tx) => {
      const txSec = Math.floor(tx.ts / 1000);
      return txSec >= minTs && txSec <= maxTs;
    })
    .map((tx) => {
      const txSec = Math.floor(tx.ts / 1000);
      let closest = chartData[0];
      let bestDiff = Math.abs(chartData[0].ts - txSec);

      chartData.forEach((point) => {
        const diff = Math.abs(point.ts - txSec);
        if (diff < bestDiff) {
          bestDiff = diff;
          closest = point;
        }
      });

      return {
        id: tx.id,
        side: tx.side,
        price: tx.price,
        label: closest.label,
        shares: tx.shares,
      };
    });
}

export default function StockChart({ symbol, livePrice = null, onCandlesLoaded = null }) {
  const { transactions } = usePortfolio();
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
        if (!cancelled) {
          setCandles(data);
          if (onCandlesLoaded && (range === 'W' || range === 'M')) {
            onCandlesLoaded(range, data);
          }
        }
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
  }, [range, symbol, onCandlesLoaded]);

  const data = useMemo(() => {
    if (!candles?.t?.length) return [];
    const points = candles.t.map((ts, index) => ({
      ts,
      label: formatChartLabel(ts, range),
      price: candles.c[index],
    }));

    if (livePrice != null && points.length) {
      const last = points[points.length - 1];
      const nowSec = Math.floor(Date.now() / 1000);
      if (nowSec - last.ts < 3600) {
        points[points.length - 1] = { ...last, price: livePrice };
      } else {
        points.push({
          ts: nowSec,
          label: formatChartLabel(nowSec, range),
          price: livePrice,
        });
      }
    }

    return points;
  }, [candles, range, livePrice]);

  const chartDrift = useMemo(() => {
    if (livePrice == null || !candles?.c?.length) return 0;
    const lastClose = candles.c[candles.c.length - 1];
    return Math.abs(livePrice - lastClose) / livePrice;
  }, [candles, livePrice]);

  const tradeMarkers = useMemo(() => {
    const upper = symbol?.toUpperCase();
    const stockTrades = transactions.filter(
      (tx) => tx.kind === 'stock' && tx.symbol === upper,
    );
    return snapTradesToChart(stockTrades, data);
  }, [data, symbol, transactions]);

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

      {candles?._cached && !isApproximate && chartDrift <= 0.02 && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 8 }}>
          Cached chart — saves API credits on reload.
        </div>
      )}

      {chartDrift > 0.02 && livePrice != null && (
        <div className="banner banner-warning" style={{ marginBottom: 12 }}>
          Chart history was stale — last point updated to match live quote ({formatCurrency(livePrice)}).
        </div>
      )}

      {loading && <div className="skeleton" style={{ height: 220 }} />}

      {!loading && error && <div className="empty-state">{error}</div>}

      {!loading && !error && data.length > 0 && (
        <>
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
                  {...chartTooltipProps}
                  formatter={(value) => [formatCurrency(value), 'Price']}
                />
                <Area type="monotone" dataKey="price" stroke="#1ED760" fill="url(#stockFill)" strokeWidth={2} dot={false} />
                {tradeMarkers.map((marker) => (
                  <ReferenceDot
                    key={marker.id}
                    x={marker.label}
                    y={marker.price}
                    r={5}
                    fill={MARKER_COLORS[marker.side] || MARKER_COLORS.sell}
                    stroke="#fff"
                    strokeWidth={1}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {tradeMarkers.length > 0 && (
            <div className="trade-marker-legend">
              <span><i className="marker-dot buy" /> Buy / Cover</span>
              <span><i className="marker-dot sell" /> Sell</span>
              <span><i className="marker-dot short" /> Short</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
