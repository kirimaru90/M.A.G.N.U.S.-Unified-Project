import { Types } from 'mongoose';
import { CharactersService } from './characters.service';
import { AuthenticatedUser } from '../auth/jwt.strategy';

function makeMockChar(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    campaignId: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    special: {
      strength: 3,
      perception: 2,
      endurance: 2,
      charisma: 1,
      intelligence: 3,
      agility: 2,
      luck: 1,
    },
    skills: [],
    perks: [],
    positiveConditions: [],
    negativeConditions: [],
    criticalState: false,
    paMax: 10,
    paCurrent: 10,
    paTrackedBy: 'agility',
    resources: { caps: 100, bobbleheads: 5, scraps: 50 },
    inventory: { weapons: [], equip: [], consumables: [], other: [] },
    isDeleted: false,
    ...overrides,
  };
}

function makeService(char: ReturnType<typeof makeMockChar>) {
  const characterModel = {
    findOne: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(char),
    }),
    findByIdAndUpdate: jest.fn().mockImplementation((_id, update) => ({
      lean: jest.fn().mockResolvedValue({ ...char, ...update.$set }),
    })),
  };
  // Species validation only fires on create/update, not the section patches here.
  const speciesCatalog = { slugExists: jest.fn().mockResolvedValue(true) };
  return new CharactersService(
    characterModel as never,
    {} as never,
    speciesCatalog as never,
  );
}

const adminActor: AuthenticatedUser = { id: 'admin-id', role: 'admin' };
function playerActor(char: ReturnType<typeof makeMockChar>): AuthenticatedUser {
  return { id: String(char.userId), role: 'player' };
}

// ─── 9.4: ignored array ───────────────────────────────────────
// Every character section is owner-writable: an owner's write applies and
// reports nothing ignored. Non-owners never reach the service — CharacterOwnerGuard
// 404s them — so `disallowed_section`/`unauthorized_field` are no longer emitted.

describe('patchSpecial — ignored', () => {
  it('owner write applies and reports nothing ignored', async () => {
    const char = makeMockChar();
    const svc = makeService(char);
    const result = await svc.patchSpecial(
      String(char.campaignId),
      String(char._id),
      { strength: 5 },
      playerActor(char),
    );
    expect(result.ignored).toEqual([]);
    expect(result.section.strength).toBe(5);
  });

  it('admin has no ignored entries and section is updated', async () => {
    const char = makeMockChar();
    const svc = makeService(char);
    const result = await svc.patchSpecial(
      String(char.campaignId),
      String(char._id),
      { strength: 5 },
      adminActor,
    );
    expect(result.ignored).toEqual([]);
    expect(result.section.strength).toBe(5);
  });
});

describe('patchSkills — ignored', () => {
  it('owner write applies and reports nothing ignored', async () => {
    const char = makeMockChar();
    const svc = makeService(char);
    const result = await svc.patchSkills(
      String(char.campaignId),
      String(char._id),
      { items: [{ id: 'hacking', level: 'expert' }] },
      playerActor(char),
    );
    expect(result.ignored).toEqual([]);
    expect(result.section).toEqual([{ id: 'hacking', level: 'expert' }]);
  });
});

describe('patchActionPoints — ignored', () => {
  it('owner write of paMax and paTrackedBy applies and reports nothing ignored', async () => {
    const char = makeMockChar();
    const svc = makeService(char);
    const result = await svc.patchActionPoints(
      String(char.campaignId),
      String(char._id),
      { paMax: 20, paCurrent: 8, paTrackedBy: 'endurance' },
      playerActor(char),
    );
    expect(result.ignored).toEqual([]);
    expect(result.section.paMax).toBe(20);
    expect(result.section.paCurrent).toBe(8);
    expect(result.section.paTrackedBy).toBe('endurance');
  });

  it('clean player PATCH (paCurrent only) returns ignored: []', async () => {
    const char = makeMockChar();
    const svc = makeService(char);
    const result = await svc.patchActionPoints(
      String(char.campaignId),
      String(char._id),
      { paCurrent: 5 },
      playerActor(char),
    );
    expect(result.ignored).toEqual([]);
  });
});

describe('patchPerks — ignored', () => {
  it('owner creates a perk and reports nothing ignored', async () => {
    const char = makeMockChar();
    const svc = makeService(char);
    const result = await svc.patchPerks(
      String(char.campaignId),
      String(char._id),
      { items: [{ name: 'Bloody Mess' }] },
      playerActor(char),
    );
    expect(result.ignored).toEqual([]);
    expect(result.section).toHaveLength(1);
    expect(result.section[0]).toMatchObject({ name: 'Bloody Mess' });
    expect(result.section[0].id).toEqual(expect.any(String));
  });

  it('admin with unknown nanoid id gets unknown_id in ignored', async () => {
    const char = makeMockChar();
    const svc = makeService(char);
    const result = await svc.patchPerks(
      String(char.campaignId),
      String(char._id),
      { items: [{ id: 'notexist', name: 'Ghost Perk' }] },
      adminActor,
    );
    expect(result.ignored).toContainEqual({
      section: 'perks',
      id: 'notexist',
      reason: 'unknown_id',
    });
  });

  it('clean admin PATCH returns ignored: []', async () => {
    const char = makeMockChar();
    const svc = makeService(char);
    const result = await svc.patchPerks(
      String(char.campaignId),
      String(char._id),
      { items: [{ name: 'Bloody Mess' }] }, // id-less → create
      adminActor,
    );
    expect(result.ignored).toEqual([]);
    expect(result.section).toHaveLength(1);
  });
});

// ─── 9.8: resources are owner-writable, bobbleheads included ──

describe('patchResources — owner writes', () => {
  it('owner PATCH applies bobbleheads alongside caps', async () => {
    const char = makeMockChar({
      resources: { caps: 100, bobbleheads: 5, scraps: 50 },
    });
    const svc = makeService(char);

    const result = await svc.patchResources(
      String(char.campaignId),
      String(char._id),
      { caps: 200, bobbleheads: 10 },
      playerActor(char),
    );

    expect(result.section.bobbleheads).toBe(10);
    expect(result.section.caps).toBe(200);
    // scraps was omitted — partial merge leaves it untouched
    expect(result.section.scraps).toBe(50);
  });

  it('owner PATCH with bobbleheads reports nothing ignored', async () => {
    const char = makeMockChar({
      resources: { caps: 100, bobbleheads: 5, scraps: 50 },
    });
    const svc = makeService(char);

    const result = await svc.patchResources(
      String(char.campaignId),
      String(char._id),
      { caps: 200, bobbleheads: 10 },
      playerActor(char),
    );

    expect(result.ignored).toEqual([]);
  });

  it('admin PATCH with bobbleheads updates it and has no ignored entry', async () => {
    const char = makeMockChar({
      resources: { caps: 100, bobbleheads: 5, scraps: 50 },
    });
    const svc = makeService(char);

    const result = await svc.patchResources(
      String(char.campaignId),
      String(char._id),
      { bobbleheads: 10 },
      adminActor,
    );

    expect(result.section.bobbleheads).toBe(10);
    expect(result.ignored).toEqual([]);
  });

  it('clean player PATCH (caps only) returns ignored: []', async () => {
    const char = makeMockChar();
    const svc = makeService(char);

    const result = await svc.patchResources(
      String(char.campaignId),
      String(char._id),
      { caps: 300 },
      playerActor(char),
    );

    expect(result.ignored).toEqual([]);
  });
});

// ─── partial-patch preservation: an omitted field never clobbers a sibling ──
// These pass an explicit `undefined` field to mimic what the live ValidationPipe
// produces (a transformed DTO carries every declared field as an own undefined
// prop). The e2e suite exercises the same guarantee through the real pipe.

describe('partial patch preserves omitted fields', () => {
  it("patching a weapon's tags preserves its name and broken flag", async () => {
    const char = makeMockChar({
      inventory: {
        weapons: [
          { id: 'w1', name: 'Laser Rifle', tags: ['energy'], broken: false },
        ],
        equip: [],
        consumables: [],
        other: [],
      },
    });
    const svc = makeService(char);
    const result = await svc.patchInventory(
      String(char.campaignId),
      String(char._id),
      {
        weapons: {
          items: [
            { id: 'w1', name: undefined, tags: ['plasma'], broken: undefined },
          ],
        },
      } as never,
      playerActor(char),
    );
    expect(result.section.weapons[0]).toEqual({
      id: 'w1',
      name: 'Laser Rifle',
      tags: ['plasma'],
      broken: false,
    });
  });

  it("patching an item's name preserves its tags and broken flag", async () => {
    const char = makeMockChar({
      inventory: {
        weapons: [
          { id: 'w1', name: 'Old', tags: ['core'], broken: true },
        ],
        equip: [],
        consumables: [],
        other: [],
      },
    });
    const svc = makeService(char);
    const result = await svc.patchInventory(
      String(char.campaignId),
      String(char._id),
      { weapons: { items: [{ id: 'w1', name: 'New', tags: undefined }] } } as never,
      playerActor(char),
    );
    expect(result.section.weapons[0]).toEqual({
      id: 'w1',
      name: 'New',
      tags: ['core'],
      broken: true,
    });
  });

  it("patching a consumable's quantity preserves its name", async () => {
    const char = makeMockChar({
      inventory: {
        weapons: [],
        equip: [],
        consumables: [{ id: 'c1', name: 'Stimpak', quantity: 3 }],
        other: [],
      },
    });
    const svc = makeService(char);
    const result = await svc.patchInventory(
      String(char.campaignId),
      String(char._id),
      { consumables: { items: [{ id: 'c1', name: undefined, quantity: 5 }] } } as never,
      playerActor(char),
    );
    expect(result.section.consumables[0]).toEqual({
      id: 'c1',
      name: 'Stimpak',
      quantity: 5,
    });
  });

  it('patching one SPECIAL attribute preserves the other six', async () => {
    const char = makeMockChar();
    const svc = makeService(char);
    const result = await svc.patchSpecial(
      String(char.campaignId),
      String(char._id),
      {
        strength: 5,
        perception: undefined,
        endurance: undefined,
        charisma: undefined,
        intelligence: undefined,
        agility: undefined,
        luck: undefined,
      } as never,
      playerActor(char),
    );
    expect(result.section).toEqual({
      strength: 5,
      perception: 2,
      endurance: 2,
      charisma: 1,
      intelligence: 3,
      agility: 2,
      luck: 1,
    });
  });

  it('patching one resource counter preserves the other two', async () => {
    const char = makeMockChar({
      resources: { caps: 100, bobbleheads: 5, scraps: 50 },
    });
    const svc = makeService(char);
    const result = await svc.patchResources(
      String(char.campaignId),
      String(char._id),
      { bobbleheads: 12, caps: undefined, scraps: undefined } as never,
      playerActor(char),
    );
    expect(result.section).toEqual({ caps: 100, bobbleheads: 12, scraps: 50 });
  });
});

// Task 5.3: PUT is a full-document replace of mutable sections — omitting a
// sub-field of special/resources/inventory clears it (no partial merge).
describe('update (PUT) — full-document replace', () => {
  it('special replaces wholesale: omitted SPECIAL keys are cleared', async () => {
    const char = makeMockChar();
    const svc = makeService(char);
    const result = await svc.update(
      String(char.campaignId),
      String(char._id),
      { special: { strength: 9 } },
      adminActor,
    );
    // strength is set; the other six keys the client omitted are gone (not merged).
    expect(result.special).toEqual({ strength: 9 });
    expect(result.special.endurance).toBeUndefined();
  });

  it('resources replaces wholesale: omitted resource keys are cleared', async () => {
    const char = makeMockChar();
    const svc = makeService(char);
    const result = await svc.update(
      String(char.campaignId),
      String(char._id),
      { resources: { caps: 1 } },
      adminActor,
    );
    expect(result.resources).toEqual({ caps: 1 });
    expect(result.resources.bobbleheads).toBeUndefined();
  });

  it('inventory replaces wholesale: omitted arrays become empty', async () => {
    const char = makeMockChar({
      inventory: {
        weapons: [{ id: 'w0', name: 'old' }],
        equip: [{ id: 'e0', name: 'oldequip' }],
        consumables: [],
        other: [],
      },
    });
    const svc = makeService(char);
    const result = await svc.update(
      String(char.campaignId),
      String(char._id),
      { inventory: { weapons: [{ id: 'w1', name: 'new' }] } },
      adminActor,
    );
    expect(result.inventory.weapons).toEqual([{ id: 'w1', name: 'new' }]);
    // equip was present before but omitted from the PUT body → cleared.
    expect(result.inventory.equip).toEqual([]);
    expect(result.inventory.consumables).toEqual([]);
    expect(result.inventory.other).toEqual([]);
  });
});
