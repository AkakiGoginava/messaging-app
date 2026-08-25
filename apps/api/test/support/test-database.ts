import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

/**
 * Starts a throwaway PostgreSQL container and brings it to the committed
 * schema with `prisma migrate deploy`.
 *
 * Integration tests run against a real database rather than a mocked Prisma
 * client because the behavior under test — unique-constraint conflicts,
 * concurrent registration races, and the session store — only exists at the
 * database level.
 *
 * Requires a running Docker daemon (Testcontainers). There is deliberately
 * no in-memory fallback: silently degrading would make these tests pass
 * without proving anything.
 */
export interface TestDatabase {
  databaseUrl: string;
  stop: () => Promise<void>;
}

export async function startTestDatabase(): Promise<TestDatabase> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    'postgres:16-alpine',
  ).start();

  const databaseUrl = container.getConnectionUri();
  deployMigrations(databaseUrl);

  return {
    databaseUrl,
    stop: async () => {
      await container.stop();
    },
  };
}

/**
 * Invokes the Prisma CLI through its JavaScript entry point rather than a
 * shell wrapper, so the same call works on Windows and Linux.
 */
function deployMigrations(databaseUrl: string): void {
  const prismaPackageJson = require.resolve('prisma/package.json');
  const prismaCli = join(dirname(prismaPackageJson), 'build', 'index.js');
  const schemaPath = resolve(__dirname, '..', '..', 'prisma', 'schema.prisma');

  execFileSync(
    process.execPath,
    [prismaCli, 'migrate', 'deploy', '--schema', schemaPath],
    {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    },
  );
}
