import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SpeciesCatalogEntryDocument = SpeciesCatalogEntry & Document;

/**
 * A global (non-campaign-scoped) species preset. `slug` is the value persisted
 * on `character.species`; `permesso`/`svantaggio` supply the copy the creation
 * wizard shows and derives the two species talents from.
 */
@Schema()
export class SpeciesCatalogEntry {
  @Prop({ required: true, unique: true, trim: true })
  slug: string;

  @Prop({ required: true })
  name: string;

  /** Permanent benefit copy. */
  @Prop({ required: true })
  permesso: string;

  /** Drawback copy. */
  @Prop({ required: true })
  svantaggio: string;

  /** Maestria budget spendable across Tag Skills at creation (positive integer). */
  @Prop({ type: Number, required: true, min: 1 })
  tagSkillBudget: number;

  /**
   * Starting health margin a character of this species is created with: the
   * number of condition-weight points its health absorbs before reaching
   * critical (positive integer). Copied onto the character at creation.
   */
  @Prop({ type: Number, required: true, min: 1 })
  margin: number;

  @Prop()
  description?: string;
}

export const SpeciesCatalogEntrySchema =
  SchemaFactory.createForClass(SpeciesCatalogEntry);
