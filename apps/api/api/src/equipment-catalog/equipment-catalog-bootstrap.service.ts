import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  EquipmentCatalogEntry,
  EquipmentCatalogEntryDocument,
} from './schemas/equipment-catalog-entry.schema';

type SeedEntry = {
  slug: string;
  name: string;
  kind: 'weapon' | 'armor' | 'consumable';
  tags?: Array<{ name: string; type: 'core' | 'extra' }>;
  defaultQuantity?: number;
  isStarter: boolean;
};

/**
 * The starter loadouts from the game manual (§6.6) — the four weapon kits and
 * three armor kits the reference prototype hardcoded as WEAPON_KITS/ARMOR_KITS,
 * plus the fixed "Dotazione fissa: 2 Stimpack inclusi" consumable.
 */
export const DEFAULT_EQUIPMENT_CATALOG: SeedEntry[] = [
  {
    slug: 'pistola-10mm',
    name: 'Pistola 10mm',
    kind: 'weapon',
    tags: [
      { name: 'PROIETTILI', type: 'core' },
      { name: 'AFFIDABILE', type: 'extra' },
    ],
    isStarter: true,
  },
  {
    slug: 'pistola-laser',
    name: 'Pistola Laser',
    kind: 'weapon',
    tags: [
      { name: 'LASER', type: 'core' },
      { name: 'AFFIDABILE', type: 'extra' },
    ],
    isStarter: true,
  },
  {
    slug: 'fucile-da-caccia',
    name: 'Fucile da Caccia',
    kind: 'weapon',
    tags: [
      { name: 'PROIETTILI', type: 'core' },
      { name: 'LUNGA GITTATA', type: 'extra' },
    ],
    isStarter: true,
  },
  {
    slug: 'mazza-chiodata',
    name: 'Mazza Chiodata',
    kind: 'weapon',
    tags: [{ name: 'PESANTE', type: 'core' }],
    isStarter: true,
  },
  {
    slug: 'giubbotto-di-pelle',
    name: 'Giubbotto di Pelle',
    kind: 'armor',
    tags: [
      { name: 'CUOIO', type: 'core' },
      { name: 'STEALTH', type: 'extra' },
    ],
    isStarter: true,
  },
  {
    slug: 'corazza-di-metallo',
    name: 'Corazza di Metallo',
    kind: 'armor',
    tags: [{ name: 'METALLO', type: 'core' }],
    isStarter: true,
  },
  {
    slug: 'tuta-anti-rad',
    name: 'Tuta Anti-Rad',
    kind: 'armor',
    tags: [
      { name: 'CUOIO', type: 'core' },
      { name: 'ANTI-RADIAZIONI', type: 'extra' },
    ],
    isStarter: true,
  },
  {
    slug: 'stimpack',
    name: 'Stimpack',
    kind: 'consumable',
    defaultQuantity: 2,
    isStarter: true,
  },
];

@Injectable()
export class EquipmentCatalogBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EquipmentCatalogBootstrapService.name);

  constructor(
    @InjectModel(EquipmentCatalogEntry.name)
    private entryModel: Model<EquipmentCatalogEntryDocument>,
  ) {}

  async onApplicationBootstrap() {
    const count = await this.entryModel.estimatedDocumentCount();
    if (count > 0) {
      this.logger.log('Equipment catalog already seeded — skipping.');
      return;
    }

    await this.entryModel.insertMany(DEFAULT_EQUIPMENT_CATALOG);
    this.logger.log(
      `Seeded ${DEFAULT_EQUIPMENT_CATALOG.length} default equipment catalog entries.`,
    );
  }
}
