import path from 'node:path';
import type { NextConfig } from 'next';

import { apiProxyRewrites } from './src/lib/api-proxy';

const nextConfig: NextConfig = {
  // Pin the workspace root to the monorepo root (where pnpm-lock.yaml
  // lives) so Next.js does not infer it from an unrelated lockfile that may
  // exist in a parent directory outside the repository.
  turbopack: {
    root: path.join(__dirname, '..', '..'),
  },

  // MA-3: same-origin HTTP proxy to the API. Keeping browser traffic on one
  // origin is what allows the session cookie to be `SameSite=Strict`.
  // Socket.IO proxying is deferred to the realtime slice.
  async rewrites() {
    return apiProxyRewrites(process.env.API_ORIGIN);
  },
};

export default nextConfig;
