import { Test } from '@nestjs/testing';
import {
  NestFastifyApplication,
  FastifyAdapter,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { startMongoMemoryServer, stopMongoMemoryServer, mongooseTestModule } from './test-helpers';
import { AuthModule } from '../src/auth/auth.module';
import { CampaignsModule } from '../src/campaigns/campaigns.module';
import { CharactersModule } from '../src/characters/characters.module';
import { User, UserSchema } from '../src/users/schemas/user.schema';
import { Campaign, CampaignSchema } from '../src/campaigns/schemas/campaign.schema';
import { Character, CharacterSchema } from '../src/characters/schemas/character.schema';
import configuration from '../src/config/configuration';
import { buildCorsOptions } from '../src/config/cors';

// Verifies the same-origin deployment contract: with CORS_ALLOWED_ORIGINS empty
// the API still boots and same-origin requests are unaffected, and no permissive
// wildcard Access-Control-Allow-Origin is emitted to a foreign origin.
describe('CORS with empty allow-list (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    // Empty allow-list — the same-origin default.
    process.env.CORS_ALLOWED_ORIGINS = '';

    const uri = await startMongoMemoryServer();
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
        mongooseTestModule(uri),
        MongooseModule.forFeature([
          { name: User.name, schema: UserSchema },
          { name: Campaign.name, schema: CampaignSchema },
          { name: Character.name, schema: CharacterSchema },
        ]),
        AuthModule,
        CampaignsModule,
        CharactersModule,
      ],
    }).compile();

    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    // Apply the exact CORS setup main.ts uses, driven by the (empty) config.
    const cfg = app.get(ConfigService);
    const origins = cfg.get<string[]>('corsAllowedOrigins') ?? [];
    expect(origins).toEqual([]); // sanity: the empty env parsed to an empty list
    app.enableCors(buildCorsOptions(origins));

    // The app booting without throwing is itself part of the assertion.
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
    await stopMongoMemoryServer();
  });

  it('serves a same-origin request (no Origin header) successfully', async () => {
    const res = await app.inject({ method: 'GET', url: '/campaigns' });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(JSON.parse(res.body))).toBe(true);
  });

  it('does not grant a wildcard to a foreign cross-origin request', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/campaigns',
      headers: { origin: 'https://evil.example' },
    });
    // The request still resolves server-side (CORS is enforced by the browser),
    // but no permissive Access-Control-Allow-Origin is handed to the foreign origin.
    const acao = res.headers['access-control-allow-origin'];
    expect(acao).not.toBe('*');
    expect(acao).not.toBe('https://evil.example');
  });
});
