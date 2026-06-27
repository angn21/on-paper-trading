import { useEffect } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { marketData } from '../marketData/marketData';
import Toast from './Toast';
import MarketIndicesBanner from './MarketIndicesBanner';
import './Layout.css';

export default function Layout() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  useKeyboardShortcuts();

  useEffect(() => {
    marketData.getMarketStatus().catch(() => null);
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-content header-stack">
          <div className="header-inner">
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
              <NavLink to="/account" className="account-link">
                {user ? user.username : 'Account'}
              </NavLink>
            </div>
          </div>
          <MarketIndicesBanner />
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
