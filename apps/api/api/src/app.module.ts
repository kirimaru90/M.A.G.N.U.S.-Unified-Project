import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { TerminalsModule } from './terminals/terminals.module';
import { CharactersModule } from './characters/characters.module';
import { SkillsCatalogModule } from './skills-catalog/skills-catalog.module';
import { ConditionsCatalogModule } from './conditions-catalog/conditions-catalog.module';
import { SpeciesCatalogModule } from './species-catalog/species-catalog.module';
import { EquipmentCatalogModule } from './equipment-catalog/equipment-catalog.module';
import { TagCatalogModule } from './tag-catalog/tag-catalog.module';
import { TalentsCatalogModule } from './talents-catalog/talents-catalog.module';
import { CampaignMapModule } from './campaign-map/campaign-map.module';
import { HealthModule } from './health/health.module';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        uri: cfg.get<string>('mongoUrl'),
      }),
    }),
    AuthModule,
    UsersModule,
    CampaignsModule,
    TerminalsModule,
    CharactersModule,
    SkillsCatalogModule,
    ConditionsCatalogModule,
    SpeciesCatalogModule,
    EquipmentCatalogModule,
    TagCatalogModule,
    TalentsCatalogModule,
    CampaignMapModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
