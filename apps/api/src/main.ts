import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { SESSION_COOKIE_NAME } from './auth/session/session.config';
import {
  configureTrustedProxy,
  readTrustedProxyHops,
} from './common/http/trust-proxy';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Off unless a deployment declares how many trusted proxy hops sit in
  // front of this service. Read `common/http/trust-proxy.ts` before setting
  // it: enabling it without a trusted edge removes rate limiting entirely.
  configureTrustedProxy(app, readTrustedProxyHops(app.get(ConfigService)));

  // Lets the session store's connection pool close cleanly on SIGTERM.
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('Messaging App API')
    .setDescription('Stage 1 messaging application API contract.')
    .setVersion('0.0.1')
    .addCookieAuth(SESSION_COOKIE_NAME)
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
