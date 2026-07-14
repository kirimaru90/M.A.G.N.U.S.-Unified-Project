import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CharacterNoteDocument = CharacterNote & Document;

/**
 * A freeform, titled note attached to a single character. Notes live in their
 * own collection (one document per note) rather than as an array on the
 * character, because they are unbounded in number and independently dated.
 * `userId` is denormalised from the parent character at creation; ownership is
 * authoritatively enforced via `CharacterOwnerGuard`, not this field.
 */
@Schema({ timestamps: true, collection: 'character_notes' })
export class CharacterNote {
  @Prop({ required: true }) // server-minted nanoid
  id: string;

  @Prop({ required: true, type: Types.ObjectId })
  characterId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  campaignId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  userId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  note: string;

  createdAt: Date;
  updatedAt: Date;
}

export const CharacterNoteSchema = SchemaFactory.createForClass(CharacterNote);
CharacterNoteSchema.index({ characterId: 1 });
