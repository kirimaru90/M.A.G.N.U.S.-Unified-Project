/**
 * Regenerate apps/packages/api-spec/openapi.json from the live AppModule.
 *
 * Mirrors the Swagger document build in src/main.ts, but boots against an
 * in-memory MongoDB so no real database is required, and writes the document
 * without listening. Run from apps/api/api so the relative output path
 * resolves to ../../packages/api-spec/openapi.json.
 */
import { NestFactory } from '@nestjs/core';
import {
  NestFastifyApplication,
  FastifyAdapter,
} from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  // Keep BootstrapService from creating an admin while we boot.
  process.env.BOOTSTRAP_ADMIN_USERNAME = '';
  process.env.BOOTSTRAP_ADMIN_PASSWORD = '';

  const mongod = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongod.getUri();

  const { AppModule } = await import('../src/app.module');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { logger: false },
  );

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('M.A.G.N.U.S. API')
      .setDescription('Server-side API for the M.A.G.N.U.S. Project')
      .setVersion('1.1')
      .addBearerAuth()
      .build(),
  );

  const outputPath = path.resolve(
    process.cwd(),
    '../../packages/api-spec/openapi.json',
  );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf8');
  console.log(`OpenAPI spec written to: ${outputPath}`);

  await app.close();
  await mongod.stop();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
