import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { SESSION_COOKIE_NAME } from './auth/session/session.config';

/**
 * Generates the OpenAPI document for the shared `@messaging-app/api-types`
 * workspace without starting an HTTP listener or requiring a database
 * connection. Run through `pnpm generate:api-types` from the repository
 * root.
 */
async function generate() {
  // Booting the module graph constructs the session store, which refuses to
  // start without a signing secret. Contract generation never issues a
  // cookie, so a build-time placeholder is supplied when the environment has
  // none. This value is never used to sign a real session: the API itself
  // still refuses to boot without a genuine `SESSION_SECRET`.
  process.env.SESSION_SECRET ??= 'openapi-generation-placeholder';

  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('Messaging App API')
    .setDescription('Stage 1 messaging application API contract.')
    .setVersion('0.0.1')
    .addCookieAuth(SESSION_COOKIE_NAME)
    .build();
  const document = SwaggerModule.createDocument(app, config);

  const outputPath = resolve(
    __dirname,
    '../../../packages/api-types/openapi.json',
  );
  writeFileSync(outputPath, JSON.stringify(document, null, 2));

  await app.close();
}

void generate();
