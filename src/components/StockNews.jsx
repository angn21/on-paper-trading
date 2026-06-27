import { useEffect, useState } from 'react';
import { marketData } from '../marketData/marketData';

export default function StockNews({ symbol }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    marketData.getNews(symbol).then((news) => {
      if (!cancelled) {
        setItems(news);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [symbol]);

  if (loading) return <div className="card"><p style={{ color: 'var(--text-muted)' }}>Loading news…</p></div>;
  if (!items.length) return null;

  return (
    <div className="card">
      <h2 className="card-title">News</h2>
      <ul className="news-list">
        {items.map((item, i) => (
          <li key={`${item.datetime}-${i}`}>
            <a href={item.url} target="_blank" rel="noreferrer">
              {item.headline}
            </a>
            <span className="news-meta">{item.source}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
