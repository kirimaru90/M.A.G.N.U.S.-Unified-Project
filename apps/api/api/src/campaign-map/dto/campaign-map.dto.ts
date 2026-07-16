import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  ValidateNested,
  ValidationArguments,
  ValidationOptions,
  registerDecorator,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PLACE_TYPES } from '../schemas/campaign-map.schema';

export class MapBoundsDto {
  @ApiProperty()
  @IsLatitude()
  south: number;

  @ApiProperty()
  @IsLongitude()
  west: number;

  @ApiProperty()
  @IsLatitude()
  north: number;

  @ApiProperty()
  @IsLongitude()
  east: number;
}

/** `minZoom <= maxZoom`; spans two fields, so it validates on the object. */
function MinZoomNotAboveMaxZoom(options?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      name: 'minZoomNotAboveMaxZoom',
      target: target.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const cfg = args.object as MapConfigDto;
          if (typeof cfg.minZoom !== 'number') return true;
          if (typeof cfg.maxZoom !== 'number') return true;
          return cfg.minZoom <= cfg.maxZoom;
        },
        defaultMessage: () => 'minZoom must not be greater than maxZoom',
      },
    });
  };
}

export class MapConfigDto {
  @ApiProperty()
  @IsLatitude()
  startLat: number;

  @ApiProperty()
  @IsLongitude()
  startLng: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(22)
  startZoom: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(22)
  @MinZoomNotAboveMaxZoom()
  minZoom: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(22)
  maxZoom: number;

  @ApiProperty({ type: MapBoundsDto })
  @ValidateNested()
  @Type(() => MapBoundsDto)
  bounds: MapBoundsDto;
}

/**
 * A radius only means something on a place with an interior. Allowing one on a
 * pin would persist a number nothing reads — `effectiveRadius` returns 0 for a
 * pin regardless — so it is rejected rather than silently ignored.
 */
function RadiusOnlyWithLocalMap(options?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      name: 'radiusOnlyWithLocalMap',
      target: target.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const place = args.object as MapPlaceDto;
          if (value === undefined || value === null) return true;
          return place.hasLocalMap === true;
        },
        defaultMessage: () =>
          'radius is allowed only on a place with hasLocalMap true',
      },
    });
  };
}

export class MapPlaceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: PLACE_TYPES })
  @IsIn(PLACE_TYPES as unknown as string[])
  type: string;

  @ApiProperty()
  @IsLatitude()
  lat: number;

  @ApiProperty()
  @IsLongitude()
  lng: number;

  @ApiProperty()
  @IsBoolean()
  hasLocalMap: boolean;

  @ApiPropertyOptional({ description: 'Metres; only when hasLocalMap is true' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @RadiusOnlyWithLocalMap()
  radius?: number;

  @ApiProperty()
  @IsBoolean()
  isPublic: boolean;

  @ApiPropertyOptional({ description: "Another place's slug, or null" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  parent?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  desc?: string;

  @ApiPropertyOptional({ description: "Overrides the type's default icon" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  icon?: string;
}

/**
 * The tree-shaped rules, which no per-place decorator can see: they need the
 * whole array at once. Reported as one violation with every offending message,
 * so a bad import tells the author everything wrong with it in one response.
 */
function ValidPlaceTree(options?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      name: 'validPlaceTree',
      target: target.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown) {
          return placeTreeErrors(value).length === 0;
        },
        defaultMessage: (args: ValidationArguments) =>
          placeTreeErrors(args.value).join('; '),
      },
    });
  };
}

/** Exported for the spec: the tree rules, as a list of human-readable failures. */
export function placeTreeErrors(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const places = value as MapPlaceDto[];
  const errors: string[] = [];

  const bySlug = new Map<string, MapPlaceDto>();
  const dupes = new Set<string>();
  for (const p of places) {
    if (typeof p?.slug !== 'string') continue;
    if (bySlug.has(p.slug)) dupes.add(p.slug);
    else bySlug.set(p.slug, p);
  }
  for (const slug of dupes) errors.push(`duplicate slug "${slug}"`);

  for (const p of places) {
    const parent = p?.parent;
    if (parent === undefined || parent === null) continue;
    const target = bySlug.get(parent);
    if (!target) {
      errors.push(`place "${p.slug}" names an unknown parent "${parent}"`);
      continue;
    }
    if (target.hasLocalMap !== true) {
      errors.push(
        `place "${p.slug}" names parent "${parent}", which has no local map`,
      );
    }
  }

  // A cycle makes the chain infinite, so walk each place's ancestry with a
  // per-walk seen-set rather than trusting it to terminate.
  for (const p of places) {
    const seen = new Set<string>();
    let cur: MapPlaceDto | undefined = p;
    while (cur?.parent) {
      if (seen.has(cur.slug)) break;
      seen.add(cur.slug);
      const next: MapPlaceDto | undefined = bySlug.get(cur.parent);
      if (!next) break;
      if (next.slug === p.slug) {
        errors.push(`place "${p.slug}" is in a parent cycle`);
        break;
      }
      cur = next;
    }
  }

  return [...new Set(errors)];
}

export class PutCampaignMapDto {
  @ApiProperty({ type: MapConfigDto })
  @ValidateNested()
  @Type(() => MapConfigDto)
  config: MapConfigDto;

  @ApiProperty({ type: [MapPlaceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MapPlaceDto)
  @ValidPlaceTree()
  places: MapPlaceDto[];
}
