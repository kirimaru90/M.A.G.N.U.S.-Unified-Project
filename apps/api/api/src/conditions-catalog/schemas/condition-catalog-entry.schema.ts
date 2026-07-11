import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ConditionCatalogEntryDocument = ConditionCatalogEntry & Document;

@Schema()
export class ConditionCatalogEntry {
  @Prop({ required: true, unique: true, trim: true })
  slug: string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: String, enum: ['minor', 'major'], required: true })
  defaultSeverity: string;

  @Prop({ type: String, enum: ['positive', 'negative'], required: true })
  polarity: string;

  @Prop()
  description?: string;
}

export const ConditionCatalogEntrySchema = SchemaFactory.createForClass(
  ConditionCatalogEntry,
);
