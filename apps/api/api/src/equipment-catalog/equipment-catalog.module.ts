import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EquipmentCatalogService } from './equipment-catalog.service';
import { EquipmentCatalogController } from './equipment-catalog.controller';
import { EquipmentCatalogBootstrapService } from './equipment-catalog-bootstrap.service';
import {
  EquipmentCatalogEntry,
  EquipmentCatalogEntrySchema,
} from './schemas/equipment-catalog-entry.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EquipmentCatalogEntry.name, schema: EquipmentCatalogEntrySchema },
    ]),
  ],
  providers: [EquipmentCatalogService, EquipmentCatalogBootstrapService],
  controllers: [EquipmentCatalogController],
})
export class EquipmentCatalogModule {}
