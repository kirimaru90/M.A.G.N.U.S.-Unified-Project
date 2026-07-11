import { NestFactory } from '@nestjs/core';
import {
  NestFastifyApplication,
  FastifyAdapter,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { MongooseExceptionFilter } from './common/filters/mongoose-exception.filter';
import { buildCorsOptions } from './config/cors';
import helmet from '@fastify/helmet';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  const cfg = app.get(ConfigService);

  // Helmet security headers
  await app.register(helmet, { contentSecurityPolicy: false });

  // CORS — see buildCorsOptions. Empty allow-list => cross-origin disabled
  // (same-origin /api needs none); set CORS_ALLOWED_ORIGINS to re-enable specific origins.
  const origins = cfg.get<string[]>('corsAllowedOrigins') ?? [];
  app.enableCors(buildCorsOptions(origins));

  // Global pipes and filters
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new MongooseExceptionFilter());

  // Swagger
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('M.A.G.N.U.S. API')
      .setDescription('Server-side API for the M.A.G.N.U.S. Project')
      .setVersion('1.1')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('docs', app, document);

  // 2. Automate spec generation in development mode
  if (process.env.NODE_ENV === 'development') {
    // Navigates from /apps/api out to /packages/api-spec/openapi.json
    const outputPath = path.resolve(process.cwd(), '../../packages/api-spec/openapi.json');

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf8');
    console.log(`📝 OpenAPI spec successfully written to: ${outputPath}`);
  }

  await app.listen(cfg.get<number>('port') ?? 3000, '0.0.0.0');
}
bootstrap();
