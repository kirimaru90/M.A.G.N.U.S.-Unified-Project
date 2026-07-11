import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SkillCatalogEntryDocument = SkillCatalogEntry & Document;

@Schema()
export class SkillCatalogEntry {
  @Prop({ required: true, unique: true, trim: true })
  slug: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;
}

export const SkillCatalogEntrySchema =
  SchemaFactory.createForClass(SkillCatalogEntry);
