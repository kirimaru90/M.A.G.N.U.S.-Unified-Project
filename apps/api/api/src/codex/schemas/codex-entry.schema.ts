import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CodexEntryDocument = CodexEntry & Document;

export const CODEX_TYPES = [
  'personaggio',
  'luogo',
  'fazione',
  'creatura',
] as const;
export type CodexType = (typeof CODEX_TYPES)[number];

/**
 * A campaign codex entry. A character sees it when it is not deleted and is
 * public or lists the character in `visibleToCharacterIds`. Players soft-delete
 * (`isDeleted` + who and when) so the master can restore; admins hard-delete.
 */
@Schema({ timestamps: true, collection: 'codex_entries' })
export class CodexEntry {
  @Prop({ required: true }) // server-minted nanoid
  id: string;

  @Prop({ required: true, type: Types.ObjectId })
  campaignId: Types.ObjectId;

  @Prop({ type: String, enum: CODEX_TYPES, required: true })
  type: CodexType;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop()
  description?: string;

  /** Master-only notes; never leaves the admin routes. */
  @Prop()
  secretDescription?: string;

  /** External `http(s)` URL; validated by the DTOs. */
  @Prop()
  imageUrl?: string;

  @Prop({ default: false })
  isPublic: boolean;

  @Prop({ type: [Types.ObjectId], default: [] })
  visibleToCharacterIds: Types.ObjectId[];

  @Prop({ default: false })
  isEditable: boolean;

  /** A place `slug` of the campaign map; never validated, may dangle. */
  @Prop({ type: String, default: null })
  mapPlaceSlug: string | null;

  /** The character that created the entry from the Pip-Boy; `null` when the master did. */
  @Prop({ type: Types.ObjectId, default: null })
  createdByCharacterId: Types.ObjectId | null;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;

  /** The character that soft-deleted the entry; `null` when the master did. */
  @Prop({ type: Types.ObjectId, default: null })
  deletedByCharacterId: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

export const CodexEntrySchema = SchemaFactory.createForClass(CodexEntry);
CodexEntrySchema.index({ campaignId: 1, id: 1 }, { unique: true });
CodexEntrySchema.index({ campaignId: 1, isDeleted: 1 });
CodexEntrySchema.index({ campaignId: 1, visibleToCharacterIds: 1 });
CodexEntrySchema.set('toJSON', {
  transform: (_doc, ret) => {
    const out = ret as Partial<typeof ret>;
    delete out._id;
    delete out.__v;
    return out;
  },
});
