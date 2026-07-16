import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CampaignMap,
  CampaignMapDocument,
  MapConfig,
  MapPlace,
} from './schemas/campaign-map.schema';
import { PutCampaignMapDto } from './dto/campaign-map.dto';
import { AuthenticatedUser } from '../auth/jwt.strategy';

/** A place's authored radius when it has an interior but no explicit one. */
export const DEFAULT_PLACE_RADIUS_M = 250;

/**
 * What a campaign reads as before an admin has authored anything. Centred on
 * Italy to match the product's locale; an admin's first save replaces it whole.
 */
export const DEFAULT_MAP_CONFIG: MapConfig = {
  startLat: 41.9028,
  startLng: 12.4964,
  startZoom: 6,
  minZoom: 3,
  maxZoom: 18,
  bounds: { south: 35, west: 6, north: 48, east: 19 },
};

type PlaceLike = Pick<
  MapPlace,
  'slug' | 'lat' | 'lng' | 'hasLocalMap' | 'radius' | 'parent'
>;

const EARTH_RADIUS_M = 6_371_008.8;

/** Great-circle distance in metres. */
export function distanceMetres(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Every place's effective radius, keyed by slug:
 *
 *   R(p) = 0                                            when p.hasLocalMap is false
 *   R(p) = max( p.radius, max over children c of ( dist(p,c) + R(c) ) )
 *
 * The recursion extends over each child's *circle*, not its point — containing
 * a child zone's centre still lets the child poke out of its parent.
 *
 * Seeding the memo with 0 before recursing is what makes a cyclic `parent`
 * chain terminate: a place reached again mid-computation reads as 0 and the
 * walk unwinds instead of recursing without bound. A cycle is rejected at the
 * DTO, so this only has to not hang, not produce a meaningful number.
 */
export function effectiveRadius(places: PlaceLike[]): Map<string, number> {
  const bySlug = new Map<string, PlaceLike>();
  for (const p of places) bySlug.set(p.slug, p);

  const kids = new Map<string, PlaceLike[]>();
  for (const p of places) {
    if (!p.parent) continue;
    if (!bySlug.has(p.parent)) continue;
    const list = kids.get(p.parent);
    if (list) list.push(p);
    else kids.set(p.parent, [p]);
  }

  const memo = new Map<string, number>();

  const compute = (p: PlaceLike): number => {
    const cached = memo.get(p.slug);
    if (cached !== undefined) return cached;
    if (!p.hasLocalMap) {
      memo.set(p.slug, 0);
      return 0;
    }
    memo.set(p.slug, 0);
    let r = p.radius ?? DEFAULT_PLACE_RADIUS_M;
    for (const child of kids.get(p.slug) ?? []) {
      r = Math.max(r, distanceMetres(p, child) + compute(child));
    }
    memo.set(p.slug, r);
    return r;
  };

  for (const p of places) compute(p);
  return memo;
}

/**
 * The slugs a non-admin may see: a place is visible only if it and every
 * ancestor is public. Rendering a public room inside a hidden bunker would
 * announce the bunker, so the cascade is the security boundary, not a nicety.
 */
function visibleToPlayer(places: MapPlace[]): Set<string> {
  const bySlug = new Map<string, MapPlace>();
  for (const p of places) bySlug.set(p.slug, p);

  const allowed = new Set<string>();
  for (const p of places) {
    let cur: MapPlace | undefined = p;
    const seen = new Set<string>();
    let ok = true;
    while (cur) {
      if (seen.has(cur.slug)) break; // cyclic chain: stop rather than hang
      seen.add(cur.slug);
      if (!cur.isPublic) {
        ok = false;
        break;
      }
      cur = cur.parent ? bySlug.get(cur.parent) : undefined;
    }
    if (ok) allowed.add(p.slug);
  }
  return allowed;
}

@Injectable()
export class CampaignMapService {
  constructor(
    @InjectModel(CampaignMap.name)
    private readonly campaignMapModel: Model<CampaignMapDocument>,
  ) {}

  async get(campaignId: string, actor?: AuthenticatedUser) {
    const doc = await this.campaignMapModel
      .findOne({ campaignId: new Types.ObjectId(campaignId) })
      .lean();

    if (!doc) return { config: DEFAULT_MAP_CONFIG, places: [] };

    const places = doc.places ?? [];
    if (actor?.role === 'admin') return { config: doc.config, places };

    const allowed = visibleToPlayer(places);
    return {
      config: doc.config,
      places: places.filter((p) => allowed.has(p.slug)),
    };
  }

  async replace(campaignId: string, dto: PutCampaignMapDto) {
    const doc = await this.campaignMapModel
      .findOneAndUpdate(
        { campaignId: new Types.ObjectId(campaignId) },
        { $set: { config: dto.config, places: dto.places } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      )
      .lean();

    return { config: doc.config, places: doc.places ?? [] };
  }
}
