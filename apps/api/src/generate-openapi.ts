import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';

/**
 * Generates the OpenAPI document for the shared `@messaging-app/api-types`
 * workspace without starting an HTTP listener or requiring a database
 * connection. Run through `pnpm generate:api-types` from the repository
 * root.
 */
async function generate() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('Messaging App API')
    .setDescription('Stage 1 messaging application API contract.')
    .setVersion('0.0.1')
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
