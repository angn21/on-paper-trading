import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createFinnhubMiddleware, createHealthMiddleware } from './server/finnhubMiddleware.js';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Make the key available to dev-server proxy middleware (server-side only).
  process.env.FINNHUB_API_KEY =
    env.FINNHUB_API_KEY || env.VITE_FINNHUB_API_KEY || process.env.FINNHUB_API_KEY;

  return {
    plugins: [
      react(),
      {
        name: 'finnhub-dev-proxy',
        configureServer(server) {
          server.middlewares.use(createHealthMiddleware());
          server.middlewares.use(createFinnhubMiddleware());
        },
      },
    ],
  };
});
