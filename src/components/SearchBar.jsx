import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { marketData } from '../marketData/marketData';

export default function SearchBar({ autoFocus = false }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await marketData.searchSymbols(query);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div>
      <input
        className="input"
        type="search"
        placeholder="Search US tickers (e.g. AAPL)"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoFocus={autoFocus}
      />

      {loading && <div className="skeleton" style={{ height: 48, marginTop: 12 }} />}

      {!loading && query && results.length === 0 && (
        <div className="empty-state">No symbols found.</div>
      )}

      <div style={{ marginTop: 12 }}>
        {results.map((item) => (
          <Link key={item.symbol} to={`/stock/${item.symbol}`} className="row-link">
            <div>
              <div style={{ fontWeight: 700 }}>{item.symbol}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{item.description}</div>
            </div>
            <span className="positive">›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
