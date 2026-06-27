import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { PortfolioProvider } from './context/PortfolioContext';
import Dashboard from './pages/Dashboard';
import Search from './pages/Search';
import StockDetail from './pages/StockDetail';

export default function App() {
  return (
    <PortfolioProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="search" element={<Search />} />
            <Route path="stock/:symbol" element={<StockDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </PortfolioProvider>
  );
}
