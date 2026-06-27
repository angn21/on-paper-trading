import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createFinnhubMiddleware, createHealthMiddleware } from './server/finnhubMiddleware.js';
import { createTwelveDataMiddleware } from './server/twelveDataMiddleware.js';
import { createAuthMiddleware } from './server/authMiddleware.js';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  process.env.FINNHUB_API_KEY =
    env.FINNHUB_API_KEY || env.VITE_FINNHUB_API_KEY || process.env.FINNHUB_API_KEY;
  process.env.TWELVE_DATA_API_KEY =
    env.TWELVE_DATA_API_KEY || process.env.TWELVE_DATA_API_KEY;
  process.env.SUPABASE_URL = env.SUPABASE_URL || process.env.SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY =
    env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SESSION_SECRET = env.SESSION_SECRET || process.env.SESSION_SECRET;

  return {
    plugins: [
      react(),
      {
        name: 'market-data-dev-proxy',
        configureServer(server) {
          server.middlewares.use(createHealthMiddleware());
          server.middlewares.use(createAuthMiddleware());
          server.middlewares.use(createFinnhubMiddleware());
          server.middlewares.use(createTwelveDataMiddleware());
        },
      },
    ],
  };
});
