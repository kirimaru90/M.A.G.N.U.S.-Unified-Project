import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type QuestDocument = Quest & Document;

export const QUEST_KINDS = ['story', 'personal'] as const;
export type QuestKind = (typeof QUEST_KINDS)[number];

export const QUEST_STATUSES = ['in_corso', 'standby', 'completata'] as const;
export type QuestStatus = (typeof QUEST_STATUSES)[number];

/**
 * One step of a quest's history: a full snapshot of how the quest reads at
 * that point. Stages are append-only and ordered by array position, never by
 * timestamp. Timestamps are set by the service, not by Mongoose, so they stay
 * per-stage under positional updates.
 */
@Schema({ _id: false })
export class QuestStage {
  @Prop({ required: true }) // server-minted nanoid
  id: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop()
  reward?: string;

  @Prop({ type: String, enum: QUEST_STATUSES, default: 'in_corso' })
  status: QuestStatus;

  @Prop({ default: false })
  isMilestone: boolean;

  @Prop({ default: false })
  isPublic: boolean;

  /** Set the first time the stage is stored public; never rewritten. */
  @Prop({ type: Date, default: null })
  revealedAt: Date | null;

  @Prop({ type: Date, required: true })
  createdAt: Date;

  @Prop({ type: Date, required: true })
  updatedAt: Date;
}

export const QuestStageSchema = SchemaFactory.createForClass(QuestStage);

/**
 * A campaign quest. `story` quests are seen by every character (gated by
 * `isPublic`); `personal` quests by the characters in `characterIds`. The
 * quest's displayed state is derived from its stages, never stored here.
 */
@Schema({ timestamps: true, collection: 'quests' })
export class Quest {
  @Prop({ required: true }) // server-minted nanoid
  id: string;

  @Prop({ required: true, type: Types.ObjectId })
  campaignId: Types.ObjectId;

  @Prop({ type: String, enum: QUEST_KINDS, required: true })
  kind: QuestKind;

  @Prop({ type: [Types.ObjectId], default: [] })
  characterIds: Types.ObjectId[];

  @Prop({ default: false })
  isPublic: boolean;

  @Prop({ type: [QuestStageSchema], default: [] })
  stages: QuestStage[];

  /** The character that created the quest from the Pip-Boy; `null` when the master did. */
  @Prop({ type: Types.ObjectId, default: null })
  createdByCharacterId?: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

export const QuestSchema = SchemaFactory.createForClass(Quest);
QuestSchema.index({ campaignId: 1, id: 1 }, { unique: true });
QuestSchema.index({ campaignId: 1, characterIds: 1 });
QuestSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const out = ret as Partial<typeof ret>;
    delete out._id;
    delete out.__v;
    return out;
  },
});
