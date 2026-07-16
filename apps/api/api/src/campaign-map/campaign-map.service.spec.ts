import { CampaignMapService, DEFAULT_MAP_CONFIG } from './campaign-map.service';
import { MapPlace } from './schemas/campaign-map.schema';
import { AuthenticatedUser } from '../auth/jwt.strategy';

const CAMPAIGN_ID = '507f1f77bcf86cd799439011';

const admin = { id: 'a1', role: 'admin' } as AuthenticatedUser;
const player = { id: 'p1', role: 'player' } as AuthenticatedUser;

function place(over: Partial<MapPlace> & { slug: string }): MapPlace {
  return {
    name: over.slug,
    type: 'region',
    lat: 41.9,
    lng: 12.5,
    hasLocalMap: true,
    isPublic: true,
    parent: null,
    ...over,
  } as MapPlace;
}

/** A model whose findOne().lean() resolves to `doc` (or null for no document). */
function makeService(doc: unknown) {
  const lean = jest.fn().mockResolvedValue(doc);
  const findOne = jest.fn().mockReturnValue({ lean });
  const findOneAndUpdate = jest.fn().mockReturnValue({ lean });
  const service = new CampaignMapService({
    findOne,
    findOneAndUpdate,
  } as never);
  return { service, findOne, findOneAndUpdate };
}

const CONFIG = DEFAULT_MAP_CONFIG;

describe('CampaignMapService.get', () => {
  it('reads a campaign with no document as an empty map', async () => {
    const { service } = makeService(null);
    const result = await service.get(CAMPAIGN_ID, player);
    expect(result).toEqual({ config: DEFAULT_MAP_CONFIG, places: [] });
  });

  it('returns every place to an admin', async () => {
    const places = [
      place({ slug: 'open' }),
      place({ slug: 'secret', isPublic: false }),
    ];
    const { service } = makeService({ config: CONFIG, places });
    const result = await service.get(CAMPAIGN_ID, admin);
    expect(result.places.map((p) => p.slug)).toEqual(['open', 'secret']);
  });

  it('omits a non-public place from a player read', async () => {
    const places = [
      place({ slug: 'open' }),
      place({ slug: 'secret', isPublic: false }),
    ];
    const { service } = makeService({ config: CONFIG, places });
    const result = await service.get(CAMPAIGN_ID, player);
    expect(result.places.map((p) => p.slug)).toEqual(['open']);
  });

  it('omits a public child of a non-public parent', async () => {
    const places = [
      place({ slug: 'bunker', isPublic: false }),
      place({ slug: 'room', isPublic: true, parent: 'bunker' }),
    ];
    const { service } = makeService({ config: CONFIG, places });
    const result = await service.get(CAMPAIGN_ID, player);
    expect(result.places).toEqual([]);
  });

  it('cascades at depth 3', async () => {
    const places = [
      place({ slug: 'region' }),
      place({ slug: 'bunker', isPublic: false, parent: 'region' }),
      place({ slug: 'room', parent: 'bunker' }),
      place({ slug: 'locker', parent: 'room' }),
    ];
    const { service } = makeService({ config: CONFIG, places });
    const result = await service.get(CAMPAIGN_ID, player);
    expect(result.places.map((p) => p.slug)).toEqual(['region']);
  });

  it('treats an anonymous caller as a non-admin', async () => {
    const places = [place({ slug: 'secret', isPublic: false })];
    const { service } = makeService({ config: CONFIG, places });
    const result = await service.get(CAMPAIGN_ID, undefined);
    expect(result.places).toEqual([]);
  });

  it('keeps a public subtree under a public ancestry', async () => {
    const places = [
      place({ slug: 'region' }),
      place({ slug: 'vault', parent: 'region' }),
      place({ slug: 'room', parent: 'vault' }),
    ];
    const { service } = makeService({ config: CONFIG, places });
    const result = await service.get(CAMPAIGN_ID, player);
    expect(result.places.map((p) => p.slug)).toEqual([
      'region',
      'vault',
      'room',
    ]);
  });
});

describe('CampaignMapService.replace', () => {
  it('upserts the single document for the campaign', async () => {
    const dto = { config: CONFIG, places: [place({ slug: 'a' })] };
    const { service, findOneAndUpdate } = makeService(dto);
    await service.replace(CAMPAIGN_ID, dto as never);
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ campaignId: expect.anything() }),
      { $set: { config: dto.config, places: dto.places } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
  });
});
