import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SpeciesCatalogEntry,
  SpeciesCatalogEntryDocument,
} from './schemas/species-catalog-entry.schema';

/**
 * The four canonical species from the game manual (§6.2). Their slugs are the
 * values `character.species` accepted as a hard enum before this catalog
 * existed, so every persisted character resolves without a migration.
 *
 * Umano carries a tag-skill budget of 4; the other three carry 3. Every seeded
 * species carries a neutral starting health `margin` of 4 (the pre-existing
 * fixed critical threshold); real per-species margins are authored in the CMS.
 */
export const DEFAULT_SPECIES_CATALOG: Array<{
  slug: string;
  name: string;
  permesso: string;
  svantaggio: string;
  tagSkillBudget: number;
  margin: number;
}> = [
  {
    slug: 'human',
    name: 'Umano',
    permesso:
      'Versatilità completa: nessun ambiente o gruppo gli è precluso a priori.',
    svantaggio:
      'Nessun talento sovrannaturale né resistenza speciale: un colpo è un colpo.',
    tagSkillBudget: 4,
    margin: 4,
  },
  {
    slug: 'ghoul',
    name: 'Ghoul',
    permesso:
      'Immune alle radiazioni (anzi, lo curano). Vita estremamente lunga.',
    svantaggio:
      'Inviso e attaccato a vista dagli umani. Rischio di "selvatichire".',
    tagSkillBudget: 3,
    margin: 4,
  },
  {
    slug: 'super_mutant',
    name: 'Supermutante',
    permesso:
      'Forza e resistenza sovrumane. Intimidazione automatica. Resiste alle radiazioni.',
    svantaggio: 'Respinto nei contesti civili. Difficoltà con tecnologie fini.',
    tagSkillBudget: 3,
    margin: 4,
  },
  {
    slug: 'robot',
    name: 'Robot',
    permesso:
      'Non respira né mangia; immune a veleni e radiazioni. Sensori potenziati.',
    svantaggio:
      'Non si cura con stimpack o cibo: serve riparazione. Vulnerabile a EMP.',
    tagSkillBudget: 3,
    margin: 4,
  },
];

@Injectable()
export class SpeciesCatalogBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SpeciesCatalogBootstrapService.name);

  constructor(
    @InjectModel(SpeciesCatalogEntry.name)
    private entryModel: Model<SpeciesCatalogEntryDocument>,
  ) {}

  async onApplicationBootstrap() {
    const count = await this.entryModel.estimatedDocumentCount();
    if (count > 0) {
      this.logger.log('Species catalog already seeded — skipping.');
      return;
    }

    await this.entryModel.insertMany(DEFAULT_SPECIES_CATALOG);
    this.logger.log(
      `Seeded ${DEFAULT_SPECIES_CATALOG.length} default species catalog entries.`,
    );
  }
}
