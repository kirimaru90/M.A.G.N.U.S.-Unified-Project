import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SkillCatalogEntry,
  SkillCatalogEntryDocument,
} from './schemas/skill-catalog-entry.schema';

export const DEFAULT_SKILLS_CATALOG: Array<{
  slug: string;
  name: string;
  description: string;
}> = [
  {
    slug: 'firearms',
    name: 'Armi da Fuoco',
    description:
      'Armi tradizionali a proiettili cinetici: pistole, fucili, mitragliatrici, fucili a pompa, armi pesanti balistiche',
  },
  {
    slug: 'energy-weapons',
    name: 'Armi Energetiche',
    description:
      'Tecnologie ad alta energia: laser, plasma, Gauss, armi a impulsi',
  },
  {
    slug: 'explosives',
    name: 'Armi Esplosive',
    description:
      'Impiego, fabbricazione e disinnesco di ordigni: granate, mine, dinamite, C4, lanciamissili, Fat Man',
  },
  {
    slug: 'melee',
    name: 'Corpo a Corpo',
    description: 'Combattimento a mani nude e armi bianche',
  },
  {
    slug: 'science',
    name: 'Scienza',
    description:
      'Hackerare terminali, riprogrammare robot/torrette, sintetizzare composti, tecnologie pre-belliche',
  },
  {
    slug: 'repair',
    name: 'Riparazione',
    description:
      'Manutenzione di armi/armature, modding, riparazione di generatori e Power Armor',
  },
  {
    slug: 'medicine',
    name: 'Medicina',
    description:
      'Curare ferite, diagnosticare malattie, somministrare Stimpak, trattare contaminazioni da radiazioni',
  },
  {
    slug: 'stealth',
    name: 'Furtività',
    description:
      'Muoversi senza farsi sentire, imboscate, evitare pattuglie, borseggio',
  },
  {
    slug: 'lockpicking',
    name: 'Scassinare',
    description: 'Forzare lucchetti, porte di sicurezza, casseforti',
  },
  {
    slug: 'survival',
    name: 'Sopravvivenza',
    description:
      'Caccia, cucina, trovare acqua potabile, orientarsi, resistere alla fatica',
  },
  {
    slug: 'piloting',
    name: 'Pilotare',
    description: 'Guida di veicoli terrestri, imbarcazioni, Vertibird',
  },
  {
    slug: 'speech',
    name: 'Eloquenza',
    description: 'Persuadere, mentire, intimidire, negoziare',
  },
  {
    slug: 'barter',
    name: 'Baratto',
    description: 'Massimizzare il valore degli scambi commerciali',
  },
];

@Injectable()
export class SkillsCatalogBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SkillsCatalogBootstrapService.name);

  constructor(
    @InjectModel(SkillCatalogEntry.name)
    private entryModel: Model<SkillCatalogEntryDocument>,
  ) {}

  async onApplicationBootstrap() {
    const count = await this.entryModel.estimatedDocumentCount();
    if (count > 0) {
      this.logger.log('Skills catalog already seeded — skipping.');
      return;
    }

    await this.entryModel.insertMany(DEFAULT_SKILLS_CATALOG);
    this.logger.log(
      `Seeded ${DEFAULT_SKILLS_CATALOG.length} default skills catalog entries.`,
    );
  }
}
