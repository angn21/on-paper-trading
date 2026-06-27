import { handlePortfolio } from '../server/auth/handlers.js';
import { createNodeHandler } from '../lib/vercelNodeAdapter.js';

export const config = { runtime: 'nodejs' };

export default createNodeHandler(handlePortfolio);
