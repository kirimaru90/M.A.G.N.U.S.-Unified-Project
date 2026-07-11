import { Test } from '@nestjs/testing';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import {
  createTestApp,
  startMongoMemoryServer,
  stopMongoMemoryServer,
  mongooseTestModule,
} from './test-helpers';
import { AuthModule } from '../src/auth/auth.module';
import { SkillsCatalogModule } from '../src/skills-catalog/skills-catalog.module';
import { DEFAULT_SKILLS_CATALOG } from '../src/skills-catalog/skills-catalog-bootstrap.service';
import { User, UserSchema } from '../src/users/schemas/user.schema';
import {
  Campaign,
  CampaignSchema,
} from '../src/campaigns/schemas/campaign.schema';
import {
  Character,
  CharacterSchema,
} from '../src/characters/schemas/character.schema';
import configuration from '../src/config/configuration';

describe('SkillsCatalogModule bootstrap seeding (e2e)', () => {
  let app: NestFastifyApplication;
  let playerToken: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
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
        SkillsCatalogModule,
      ],
    }).compile();

    // app.init() below fires OnApplicationBootstrap against an empty
    // mongodb-memory-server instance, exercising the seeding path itself.
    app = await createTestApp(module);

    const userModel = module.get(getModelToken(User.name));
    const hash = await bcrypt.hash('pass', 12);
    await userModel.create({ username: 'player', passwordHash: hash, role: 'player' });

    const playerLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'player', password: 'pass' },
    });
    playerToken = JSON.parse(playerLogin.body).accessToken;
  });

  afterAll(async () => {
    await app.close();
    await stopMongoMemoryServer();
  });

  it('seeds all 13 default entries on a fresh, empty startup', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/skills-catalog',
      headers: auth(playerToken),
    });
    expect(res.statusCode).toBe(200);
    const entries = JSON.parse(res.body);
    expect(entries).toHaveLength(DEFAULT_SKILLS_CATALOG.length);
    for (const defaultEntry of DEFAULT_SKILLS_CATALOG) {
      expect(entries).toContainEqual(defaultEntry);
    }
  });
});
