import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TagCatalogEntryDocument = TagCatalogEntry & Document;

/**
 * A global (non-campaign-scoped) tag **name** template. It carries no
 * `core`/`extra` type: whether a tag is core or extra is a property of how it is
 * attached to a specific item, not of the tag name (see design.md). The catalog
 * only supplies canonical names to autocomplete against; free-typed tags stay
 * valid.
 */
@Schema()
export class TagCatalogEntry {
  @Prop({ required: true, unique: true, trim: true })
  slug: string;

  @Prop({ required: true })
  name: string;
}

export const TagCatalogEntrySchema =
  SchemaFactory.createForClass(TagCatalogEntry);
