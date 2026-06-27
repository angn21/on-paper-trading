import { Link, NavLink, Outlet } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import Toast from './Toast';
import './Layout.css';

export default function Layout() {
  const { theme, toggleTheme } = useTheme();
  useKeyboardShortcuts();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-content header-inner">
          <Link to="/" className="brand">
            <span className="brand-mark" aria-hidden>◎</span>
            <span>On Paper</span>
          </Link>
          <div className="header-actions">
            <button type="button" className="btn btn-ghost btn-sm theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            <NavLink to="/search" className="search-link">
              Search
            </NavLink>
          </div>
        </div>
      </header>

      <main className="app-content">
        <Outlet />
      </main>

      <Toast />

      <nav className="bottom-nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          Portfolio
        </NavLink>
        <NavLink to="/search" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
          Search
        </NavLink>
      </nav>

      <footer className="app-content app-footer">
        <div className="footer-inner">
          <span>Paper trading for education only. Not real investing or financial advice.</span>
          <Link to="/status" className="footer-status-link">Status</Link>
        </div>
      </footer>
    </div>
  );
}
