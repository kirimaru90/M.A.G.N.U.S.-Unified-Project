import { CodexController } from './codex.controller';
import { CharacterCodexController } from './character-codex.controller';

const admin = { user: { id: 'u0', role: 'admin' } } as never;
const player = { user: { id: 'u1', role: 'player' } } as never;

function makeService() {
  return {
    list: jest.fn().mockResolvedValue([]),
    get: jest.fn().mockResolvedValue({ id: 'e1' }),
    create: jest.fn().mockResolvedValue({ id: 'e1' }),
    update: jest.fn().mockResolvedValue({ id: 'e1' }),
    remove: jest.fn().mockResolvedValue(undefined),
    export: jest.fn().mockResolvedValue([]),
    import: jest.fn().mockResolvedValue({ added: 0, skipped: [] }),
    listForCharacter: jest.fn().mockResolvedValue([]),
    createForCharacter: jest.fn().mockResolvedValue({ id: 'e1' }),
    updateForCharacter: jest.fn().mockResolvedValue({ id: 'e1' }),
    removeForCharacter: jest.fn().mockResolvedValue(undefined),
  };
}

describe('CodexController', () => {
  it('delegates every admin route to the service', async () => {
    const service = makeService();
    const c = new CodexController(service as never);
    await c.list('c1');
    await c.get('c1', 'e1');
    await c.create('c1', { type: 'luogo', name: 'X' });
    await c.update('c1', 'e1', { isDeleted: false });
    await c.remove('c1', 'e1');
    await c.export('c1');
    await c.import('c1', { entries: [{ a: 1 }] });
    expect(service.list).toHaveBeenCalledWith('c1');
    expect(service.get).toHaveBeenCalledWith('c1', 'e1');
    expect(service.update).toHaveBeenCalledWith('c1', 'e1', {
      isDeleted: false,
    });
    expect(service.remove).toHaveBeenCalledWith('c1', 'e1');
    expect(service.import).toHaveBeenCalledWith('c1', [{ a: 1 }]);
  });
});

describe('CharacterCodexController', () => {
  it('passes the admin flag from the caller role', async () => {
    const service = makeService();
    const c = new CharacterCodexController(service as never);
    const reply = { status: jest.fn() };
    await c.update('c1', 'ch', 'e1', {}, admin, reply as never);
    await c.remove('c1', 'ch', 'e1', player);
    expect(service.updateForCharacter).toHaveBeenCalledWith(
      'c1',
      'ch',
      'e1',
      {},
      true,
    );
    expect(service.removeForCharacter).toHaveBeenCalledWith(
      'c1',
      'ch',
      'e1',
      false,
    );
    expect(reply.status).not.toHaveBeenCalled();
  });

  it('answers 204 when the update hides the entry', async () => {
    const service = makeService();
    service.updateForCharacter.mockResolvedValue(null);
    const c = new CharacterCodexController(service as never);
    const reply = { status: jest.fn() };
    await expect(
      c.update('c1', 'ch', 'e1', { isPublic: false }, player, reply as never),
    ).resolves.toBeUndefined();
    expect(reply.status).toHaveBeenCalledWith(204);
  });

  it('delegates list and create', async () => {
    const service = makeService();
    const c = new CharacterCodexController(service as never);
    await c.list('c1', 'ch');
    await c.create('c1', 'ch', { type: 'luogo', name: 'X' });
    expect(service.listForCharacter).toHaveBeenCalledWith('c1', 'ch');
    expect(service.createForCharacter).toHaveBeenCalledWith('c1', 'ch', {
      type: 'luogo',
      name: 'X',
    });
  });
});
