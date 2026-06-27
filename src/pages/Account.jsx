import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  hasPortfolioActivity,
  loadLocalPortfolio,
  pickSyncPayload,
} from '../lib/portfolioStorage';

export default function Account() {
  const { user, loading, register, login, logout } = useAuth();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [importLocal, setImportLocal] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const localPortfolio = loadLocalPortfolio();
  const canImport = hasPortfolioActivity(localPortfolio);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (mode === 'register') {
        await register(username, pin, {
          importLocal: importLocal && canImport,
          portfolio: pickSyncPayload(localPortfolio),
        });
      } else {
        await login(username, pin);
      }
      setPin('');
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="section-gap" style={{ paddingTop: 16 }}>
        <div className="card empty-state">Loading account…</div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="section-gap" style={{ paddingTop: 16 }}>
        <section className="card">
          <h1 style={{ margin: '0 0 8px', fontSize: '1.4rem' }}>Account</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
            Signed in as <strong>{user.username}</strong>. Your portfolio syncs to the cloud automatically (~2s after changes).
          </p>
          <button type="button" className="btn btn-ghost" onClick={() => logout()}>
            Sign out
          </button>
        </section>

        <section className="card">
          <h2 className="card-title">How sync works</h2>
          <ul className="account-notes">
            <li>Changes save to the cloud ~2 seconds after you trade.</li>
            <li>Sign in on another device with the same username + PIN to pick up where you left off.</li>
            <li>This browser still keeps a local backup if you&apos;re offline.</li>
          </ul>
        </section>
      </div>
    );
  }

  return (
    <div className="section-gap" style={{ paddingTop: 16 }}>
      <section className="card">
        <h1 style={{ margin: '0 0 8px', fontSize: '1.4rem' }}>Cloud save</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
          Create an account to sync your paper portfolio across devices. Username + PIN only — no email required.
        </p>

        <div className="pill-group" style={{ marginBottom: 16 }}>
          <button
            type="button"
            className={mode === 'login' ? 'pill active' : 'pill'}
            onClick={() => { setMode('login'); setError(''); }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'pill active' : 'pill'}
            onClick={() => { setMode('register'); setError(''); }}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Username</span>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="3–20 chars, letters/numbers/_"
              maxLength={20}
              required
            />
          </label>

          <label className="field">
            <span>PIN</span>
            <input
              className="input"
              type="password"
              inputMode="numeric"
              pattern="\d{4,6}"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="4–6 digits"
              required
            />
          </label>

          {mode === 'register' && canImport && (
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={importLocal}
                onChange={(e) => setImportLocal(e.target.checked)}
              />
              <span>Import portfolio from this browser</span>
            </label>
          )}

          {error && <div className="trade-error">{error}</div>}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 8 }}
            disabled={submitting}
          >
            {submitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </section>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
        <Link to="/">Continue without signing in</Link> — portfolio stays on this device only.
      </p>
    </div>
  );
}
