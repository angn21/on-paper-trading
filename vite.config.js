import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createFinnhubMiddleware, createHealthMiddleware } from './server/finnhubMiddleware.js';
import { createTwelveDataMiddleware } from './server/twelveDataMiddleware.js';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  process.env.FINNHUB_API_KEY =
    env.FINNHUB_API_KEY || env.VITE_FINNHUB_API_KEY || process.env.FINNHUB_API_KEY;
  process.env.TWELVE_DATA_API_KEY =
    env.TWELVE_DATA_API_KEY || process.env.TWELVE_DATA_API_KEY;

  return {
    plugins: [
      react(),
      {
        name: 'market-data-dev-proxy',
        configureServer(server) {
          server.middlewares.use(createHealthMiddleware());
          server.middlewares.use(createFinnhubMiddleware());
          server.middlewares.use(createTwelveDataMiddleware());
        },
      },
    ],
  };
});
