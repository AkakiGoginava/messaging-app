import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pin the workspace root to the monorepo root (where pnpm-lock.yaml
  // lives) so Next.js does not infer it from an unrelated lockfile that may
  // exist in a parent directory outside the repository.
  turbopack: {
    root: path.join(__dirname, '..', '..'),
  },
};

export default nextConfig;
