import { Link, NavLink, Outlet } from 'react-router-dom';
import './Layout.css';

export default function Layout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-content header-inner">
          <Link to="/" className="brand">
            <span className="brand-mark">◎</span>
            <span>On Paper</span>
          </Link>
          <NavLink to="/search" className="search-link">
            Search
          </NavLink>
        </div>
      </header>

      <main className="app-content">
        <Outlet />
      </main>

      <nav className="bottom-nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          Portfolio
        </NavLink>
        <NavLink to="/search" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          Search
        </NavLink>
      </nav>

      <footer className="app-footer">
        <div className="app-content">
          Paper trading for education only. Not real investing or financial advice.
        </div>
      </footer>
    </div>
  );
}
