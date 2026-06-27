import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import { PortfolioProvider } from './context/PortfolioContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import Dashboard from './pages/Dashboard';
import Search from './pages/Search';
import Status from './pages/Status';
import StockDetail from './pages/StockDetail';

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <PortfolioProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="search" element={<Search />} />
                  <Route path="stock/:symbol" element={<StockDetail />} />
                  <Route path="status" element={<Status />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </PortfolioProvider>
        </ToastProvider>
      </ThemeProvider>
      <Analytics />
      <SpeedInsights />
    </ErrorBoundary>
  );
}
