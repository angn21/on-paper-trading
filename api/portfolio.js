import { handlePortfolio } from '../../server/auth/handlers.js';

export const config = { runtime: 'nodejs' };

export default function handler(request) {
  return handlePortfolio(request);
}
