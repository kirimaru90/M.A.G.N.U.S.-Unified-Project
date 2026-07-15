import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TalentCatalogEntryDocument = TalentCatalogEntry & Document;

@Schema()
export class TalentCatalogEntry {
  @Prop({ required: true, unique: true, trim: true })
  slug: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;
}

export const TalentCatalogEntrySchema =
  SchemaFactory.createForClass(TalentCatalogEntry);
