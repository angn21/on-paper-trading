import SearchBar from '../components/SearchBar';

export default function Search() {
  return (
    <div className="section-gap" style={{ paddingTop: 16 }}>
      <section className="card">
        <h1 style={{ marginTop: 0, fontSize: '1.4rem' }}>Search</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
          Find a US stock ticker to view price, chart, and paper trade.
        </p>
        <SearchBar autoFocus />
      </section>
    </div>
  );
}
