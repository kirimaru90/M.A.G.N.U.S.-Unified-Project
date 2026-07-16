import { CampaignMapController } from './campaign-map.controller';
import { CampaignMapService } from './campaign-map.service';
import { AuthenticatedUser } from '../auth/jwt.strategy';

describe('CampaignMapController', () => {
  const actor = { id: 'a1', role: 'admin' } as AuthenticatedUser;

  function makeController() {
    const service = {
      get: jest.fn().mockResolvedValue({ config: {}, places: [] }),
      replace: jest.fn().mockResolvedValue({ config: {}, places: [] }),
    };
    return {
      controller: new CampaignMapController(
        service as unknown as CampaignMapService,
      ),
      service,
    };
  }

  it('passes the actor to the service on read, so the projection can apply', async () => {
    const { controller, service } = makeController();
    await controller.get('c1', { user: actor });
    expect(service.get).toHaveBeenCalledWith('c1', actor);
  });

  it('passes an absent user through on an anonymous read', async () => {
    const { controller, service } = makeController();
    await controller.get('c1', {});
    expect(service.get).toHaveBeenCalledWith('c1', undefined);
  });

  it('delegates a write to the service', async () => {
    const { controller, service } = makeController();
    const dto = { config: {}, places: [] };
    await controller.replace('c1', dto as never);
    expect(service.replace).toHaveBeenCalledWith('c1', dto);
  });
});
