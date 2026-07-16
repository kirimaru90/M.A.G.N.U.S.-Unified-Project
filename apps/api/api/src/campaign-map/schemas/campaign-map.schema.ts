import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CampaignMapDocument = CampaignMap & Document;

export const PLACE_TYPES = [
  'region',
  'settlement',
  'vault',
  'building',
  'room',
  'landmark',
  'poi',
] as const;

export type PlaceType = (typeof PLACE_TYPES)[number];

@Schema({ _id: false })
export class MapBounds {
  @Prop({ required: true })
  south: number;

  @Prop({ required: true })
  west: number;

  @Prop({ required: true })
  north: number;

  @Prop({ required: true })
  east: number;
}
export const MapBoundsSchema = SchemaFactory.createForClass(MapBounds);

/** The campaign's framing: where the map opens, how far it zooms, where it may pan. */
@Schema({ _id: false })
export class MapConfig {
  @Prop({ required: true })
  startLat: number;

  @Prop({ required: true })
  startLng: number;

  @Prop({ required: true })
  startZoom: number;

  @Prop({ required: true })
  minZoom: number;

  @Prop({ required: true })
  maxZoom: number;

  @Prop({ type: MapBoundsSchema, required: true })
  bounds: MapBounds;
}
export const MapConfigSchema = SchemaFactory.createForClass(MapConfig);

/**
 * An authored place. `radius` is the *authored* value only — the effective
 * radius that contains a place's children is derived at read time by
 * `effectiveRadius()` and never persisted, so editing a child cannot leave a
 * stale number on its parent.
 */
@Schema({ _id: false })
export class MapPlace {
  @Prop({ required: true, trim: true })
  slug: string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: String, enum: PLACE_TYPES, required: true })
  type: string;

  @Prop({ required: true })
  lat: number;

  @Prop({ required: true })
  lng: number;

  /** False makes this a pin: no interior, no children, contributes R = 0. */
  @Prop({ required: true })
  hasLocalMap: boolean;

  /** Metres. Present only when `hasLocalMap` is true. */
  @Prop()
  radius?: number;

  @Prop({ required: true })
  isPublic: boolean;

  /** Another place's `slug` within this same map, or null for a root place. */
  @Prop({ type: String, default: null })
  parent?: string | null;

  @Prop()
  desc?: string;

  /** Overrides the type's default icon. Resolved at render, never copied. */
  @Prop()
  icon?: string;
}
export const MapPlaceSchema = SchemaFactory.createForClass(MapPlace);

@Schema()
export class CampaignMap {
  @Prop({
    type: Types.ObjectId,
    ref: 'Campaign',
    required: true,
    index: true,
    unique: true,
  })
  campaignId: Types.ObjectId;

  @Prop({ type: MapConfigSchema, required: true })
  config: MapConfig;

  @Prop({ type: [MapPlaceSchema], default: [] })
  places: MapPlace[];
}

export const CampaignMapSchema = SchemaFactory.createForClass(CampaignMap);
