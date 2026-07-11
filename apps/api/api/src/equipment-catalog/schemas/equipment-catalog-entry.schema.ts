import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EquipmentCatalogEntryDocument = EquipmentCatalogEntry & Document;

export const EQUIPMENT_KINDS = ['weapon', 'armor', 'consumable'] as const;
export const TAG_TYPES = ['core', 'extra'] as const;

/** Mirrors the tag shape persisted on a character's weapons/equip items. */
@Schema({ _id: false })
export class EquipmentTag {
  @Prop({ required: true })
  name: string;

  @Prop({ type: String, enum: TAG_TYPES, required: true })
  type: string;
}
export const EquipmentTagSchema = SchemaFactory.createForClass(EquipmentTag);

/**
 * A global (non-campaign-scoped) equipment **template**, not an instance.
 * Instantiating one copies `name`/`tags` onto a character with a server-minted
 * id and no link back to this `slug` — so editing either side never disturbs
 * the other.
 */
@Schema()
export class EquipmentCatalogEntry {
  @Prop({ required: true, unique: true, trim: true })
  slug: string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: String, enum: EQUIPMENT_KINDS, required: true })
  kind: string;

  /** Meaningful for `weapon`/`armor`; always empty for `consumable`. */
  @Prop({ type: [EquipmentTagSchema], default: [] })
  tags: EquipmentTag[];

  /** Quantity used when instantiating a `consumable`; ignored for other kinds. */
  @Prop({ type: Number, min: 0 })
  defaultQuantity?: number;

  /** Marks the template as offered by the character-creation wizard. */
  @Prop({ default: false })
  isStarter: boolean;

  @Prop()
  description?: string;
}

export const EquipmentCatalogEntrySchema = SchemaFactory.createForClass(
  EquipmentCatalogEntry,
);
