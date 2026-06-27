import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import { AuthProvider } from './context/AuthContext';
import { PortfolioProvider } from './context/PortfolioContext';
import { PortfolioSyncProvider } from './context/PortfolioSyncContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import Account from './pages/Account';
import Dashboard from './pages/Dashboard';
import Search from './pages/Search';
import Status from './pages/Status';
import StockDetail from './pages/StockDetail';

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <PortfolioProvider>
              <PortfolioSyncProvider>
                <BrowserRouter>
                <Routes>
                  <Route element={<Layout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="search" element={<Search />} />
                    <Route path="stock/:symbol" element={<StockDetail />} />
                    <Route path="account" element={<Account />} />
                    <Route path="status" element={<Status />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
                </BrowserRouter>
              </PortfolioSyncProvider>
            </PortfolioProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
      <Analytics />
      <SpeedInsights />
    </ErrorBoundary>
  );
}
