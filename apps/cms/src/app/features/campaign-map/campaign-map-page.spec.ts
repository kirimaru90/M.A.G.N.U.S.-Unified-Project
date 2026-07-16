import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfirmationService, MessageService } from 'primeng/api';
import { CampaignMapPage } from './campaign-map-page';
import { CampaignMapApiService } from '../../core/campaign-map/campaign-map-api.service';
import { CurrentCampaignService } from '../../core/campaign/current-campaign.service';
import type { CampaignMapDto, MapPlace } from '../../core/campaign-map/campaign-map.types';

const CONFIG = {
  startLat: 41.9,
  startLng: 12.5,
  startZoom: 6,
  minZoom: 3,
  maxZoom: 18,
  bounds: { south: 35, west: 6, north: 48, east: 19 },
};

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
  };
}

describe('CampaignMapPage', () => {
  let fixture: ComponentFixture<CampaignMapPage>;
  let component: CampaignMapPage;
  let getSpy: ReturnType<typeof vi.fn>;
  let replaceSpy: ReturnType<typeof vi.fn>;

  async function setup(places: MapPlace[] = []) {
    const dto: CampaignMapDto = { config: CONFIG, places };
    getSpy = vi.fn().mockReturnValue(of(dto));
    replaceSpy = vi.fn().mockReturnValue(of(dto));

    await TestBed.configureTestingModule({
      imports: [CampaignMapPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CampaignMapApiService, useValue: { get: getSpy, replace: replaceSpy } },
        {
          provide: CurrentCampaignService,
          useValue: { currentCampaign: signal({ id: 'c1', name: 'C1', isActive: true, isPublic: true }) },
        },
        ConfirmationService,
        MessageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CampaignMapPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const state = <T,>(key: string): T => (component as unknown as Record<string, () => T>)[key]();

  beforeEach(() => vi.restoreAllMocks());

  it('loads the campaign map on init', async () => {
    await setup([place({ slug: 'roma' })]);
    expect(getSpy).toHaveBeenCalledWith('c1');
    expect(state<MapPlace[]>('places')).toHaveLength(1);
  });

  it('appends a place at the clicked coordinates', async () => {
    await setup();
    component.addPlaceAt(43.5, 11.2);

    const places = state<MapPlace[]>('places');
    expect(places).toHaveLength(1);
    expect(places[0].lat).toBe(43.5);
    expect(places[0].lng).toBe(11.2);
  });

  it('selects the newly placed place and renders its card', async () => {
    await setup();
    const created = component.addPlaceAt(43.5, 11.2);
    fixture.detectChanges();

    expect(state<string | null>('selected')).toBe(created.slug);
    const card = fixture.nativeElement.querySelector('[data-testid="selection-card"]');
    expect(card).toBeTruthy();
  });

  it('leaves placing mode after a click, so one click makes one place', async () => {
    await setup();
    (component as unknown as { mode: { set: (m: string) => void } }).mode.set('placing');
    component.addPlaceAt(43.5, 11.2);
    expect(state<string>('mode')).toBe('idle');
  });

  it('mints a distinct slug for every new place', async () => {
    await setup();
    const a = component.addPlaceAt(43.5, 11.2);
    const b = component.addPlaceAt(44.5, 11.2);
    expect(a.slug).not.toBe(b.slug);
  });

  it('shows an empty selection card with nothing selected', async () => {
    await setup([place({ slug: 'roma' })]);
    expect(fixture.nativeElement.querySelector('[data-testid="selection-empty"]')).toBeTruthy();
  });

  describe('the hasLocalMap toggle', () => {
    // NgModel applies [disabled] via setDisabledState inside a resolved promise,
    // so the DOM property lands a microtask after detectChanges().
    async function toggleAfterSelecting(places: MapPlace[]) {
      await setup(places);
      (component as unknown as { select: (s: string) => void }).select('roma');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      return fixture.nativeElement.querySelector('[data-testid="sel-haslocalmap"]');
    }

    it('is disabled while the place has children', async () => {
      // You cannot strand a subtree by unchecking a box.
      const input = await toggleAfterSelecting([
        place({ slug: 'roma' }),
        place({ slug: 'vault', parent: 'roma' }),
      ]);
      expect(input.disabled).toBe(true);
    });

    it('is enabled for a childless place', async () => {
      const input = await toggleAfterSelecting([place({ slug: 'roma' })]);
      expect(input.disabled).toBe(false);
    });
  });

  describe('the parent selector', () => {
    it('excludes the place itself and its descendants', async () => {
      await setup([
        place({ slug: 'region' }),
        place({ slug: 'vault', parent: 'region' }),
        place({ slug: 'room', parent: 'vault' }),
        place({ slug: 'elsewhere' }),
      ]);
      (component as unknown as { select: (s: string) => void }).select('region');
      fixture.detectChanges();

      const slugs = state<MapPlace[]>('parentOptions').map((p) => p.slug);
      expect(slugs).not.toContain('region');
      expect(slugs).not.toContain('vault');
      expect(slugs).not.toContain('room');
      expect(slugs).toEqual(['elsewhere']);
    });

    it('excludes a pin, which cannot contain anything', async () => {
      await setup([place({ slug: 'a' }), place({ slug: 'pin', hasLocalMap: false })]);
      (component as unknown as { select: (s: string) => void }).select('a');
      fixture.detectChanges();

      expect(state<MapPlace[]>('parentOptions').map((p) => p.slug)).not.toContain('pin');
    });
  });

  describe('the places table', () => {
    it('collapsing a branch hides its rows', async () => {
      await setup([place({ slug: 'region' }), place({ slug: 'vault', parent: 'region' })]);
      expect(state<unknown[]>('rows')).toHaveLength(2);

      (component as unknown as { toggleBranch: (s: string, e: Event) => void }).toggleBranch(
        'region',
        new Event('click'),
      );
      fixture.detectChanges();

      const rows = state<{ place: MapPlace }[]>('rows');
      expect(rows).toHaveLength(1);
      expect(rows[0].place.slug).toBe('region');
    });

    it('collapsing a branch does not hide its markers', async () => {
      // Collapse is a reading convenience for a long table; the filter bar is
      // what hides things from the map. Two controls, two meanings.
      await setup([place({ slug: 'region' }), place({ slug: 'vault', parent: 'region' })]);
      const markers = (component as unknown as { markers: Map<string, unknown> }).markers;
      const before = markers.size;

      (component as unknown as { toggleBranch: (s: string, e: Event) => void }).toggleBranch(
        'region',
        new Event('click'),
      );
      fixture.detectChanges();

      expect(markers.size).toBe(before);
    });

    it('badges a closed branch with the count it hides', async () => {
      await setup([
        place({ slug: 'region' }),
        place({ slug: 'vault', parent: 'region' }),
        place({ slug: 'room', parent: 'vault' }),
      ]);
      (component as unknown as { toggleBranch: (s: string, e: Event) => void }).toggleBranch(
        'region',
        new Event('click'),
      );
      fixture.detectChanges();

      const rows = state<{ hiddenCount: number }[]>('rows');
      expect(rows[0].hiddenCount).toBe(2);
    });

    it('orders rows depth-first with depth for indentation', async () => {
      await setup([
        place({ slug: 'region' }),
        place({ slug: 'vault', parent: 'region' }),
        place({ slug: 'room', parent: 'vault' }),
      ]);
      const rows = state<{ place: MapPlace; depth: number }[]>('rows');
      expect(rows.map((r) => [r.place.slug, r.depth])).toEqual([
        ['region', 0],
        ['vault', 1],
        ['room', 2],
      ]);
    });

    it('still lists a place whose parent names nothing', async () => {
      // It is on the map, so it must be in the table — otherwise the only way to
      // reach and fix it is gone.
      await setup([place({ slug: 'orphan', parent: 'ghost' })]);
      const rows = state<{ place: MapPlace; depth: number }[]>('rows');
      expect(rows).toHaveLength(1);
      expect(rows[0].depth).toBe(0);
    });

    it('still lists places caught in a cycle, without hanging', async () => {
      await setup([place({ slug: 'a', parent: 'b' }), place({ slug: 'b', parent: 'a' })]);
      const rows = state<{ place: MapPlace }[]>('rows');
      expect(rows.map((r) => r.place.slug).sort()).toEqual(['a', 'b']);
    });

    it('does not re-add a collapsed branch through the orphan path', async () => {
      await setup([
        place({ slug: 'region' }),
        place({ slug: 'vault', parent: 'region' }),
        place({ slug: 'room', parent: 'vault' }),
      ]);
      (component as unknown as { toggleBranch: (s: string, e: Event) => void }).toggleBranch(
        'region',
        new Event('click'),
      );
      fixture.detectChanges();

      expect(state<{ place: MapPlace }[]>('rows').map((r) => r.place.slug)).toEqual(['region']);
    });

    it('flattens the list when filtering', async () => {
      await setup([
        place({ slug: 'region', name: 'Regione' }),
        place({ slug: 'vault', name: 'Vault', parent: 'region' }),
      ]);
      (component as unknown as { nameFilter: { set: (v: string) => void } }).nameFilter.set('vault');
      fixture.detectChanges();

      const rows = state<{ place: MapPlace; depth: number }[]>('rows');
      expect(rows).toHaveLength(1);
      expect(rows[0].depth).toBe(0);
    });

    it('reports the three visibility states distinctly', async () => {
      await setup([
        place({ slug: 'open' }),
        place({ slug: 'bunker', isPublic: false }),
        place({ slug: 'room', parent: 'bunker', isPublic: true }),
      ]);
      const rows = state<{ place: MapPlace; vis: string }[]>('rows');
      const vis = Object.fromEntries(rows.map((r) => [r.place.slug, r.vis]));
      expect(vis).toEqual({ open: 'public', bunker: 'hidden', room: 'inherited' });
    });

    it('shows authored → effective only when children extend the radius', async () => {
      await setup([
        place({ slug: 'zone', radius: 100 }),
        place({ slug: 'kid', parent: 'zone', lat: 41.91, radius: 50 }),
      ]);
      const rows = state<{ place: MapPlace; authored: number; effective: number }[]>('rows');
      const zone = rows.find((r) => r.place.slug === 'zone')!;
      expect(zone.authored).toBe(100);
      expect(zone.effective).toBeGreaterThan(zone.authored);
    });
  });

  it('counts visible-to-player using the cascade, not the raw flag', async () => {
    await setup([
      place({ slug: 'open' }),
      place({ slug: 'bunker', isPublic: false }),
      // Public, but a player never receives it: its parent is hidden.
      place({ slug: 'room', parent: 'bunker', isPublic: true }),
    ]);
    expect(state<number>('visibleCount')).toBe(1);

    const el = fixture.nativeElement.querySelector('[data-testid="visible-count"]');
    expect(el.textContent).toContain('1');
  });

  describe('deleting', () => {
    it('cascades to descendants', async () => {
      await setup([
        place({ slug: 'region' }),
        place({ slug: 'vault', parent: 'region' }),
        place({ slug: 'room', parent: 'vault' }),
        place({ slug: 'other' }),
      ]);
      (component as unknown as { deletePlace: (s: string) => void })['deletePlace']('region');
      fixture.detectChanges();

      expect(state<MapPlace[]>('places').map((p) => p.slug)).toEqual(['other']);
    });

    it('names the descendant count in the confirm', async () => {
      await setup([place({ slug: 'region' }), place({ slug: 'vault', parent: 'region' })]);
      const confirm = TestBed.inject(ConfirmationService);
      const spy = vi.spyOn(confirm, 'confirm');

      (component as unknown as { confirmDelete: (s: string) => void }).confirmDelete('region');
      expect(spy.mock.calls[0][0].message).toContain('1');
    });
  });

  describe('editing', () => {
    it('applies a name edit to the table row', async () => {
      await setup([place({ slug: 'roma', name: 'Roma' })]);
      (component as unknown as { select: (s: string) => void }).select('roma');
      (component as unknown as { patchPlace: (p: Partial<MapPlace>) => void }).patchPlace({
        name: 'Roma Nord',
      });
      fixture.detectChanges();

      expect(state<MapPlace[]>('places')[0].name).toBe('Roma Nord');
    });

    it('drops the radius when a place stops having an interior', async () => {
      await setup([place({ slug: 'roma', radius: 500 })]);
      (component as unknown as { select: (s: string) => void }).select('roma');
      (component as unknown as { patchPlace: (p: Partial<MapPlace>) => void }).patchPlace({
        hasLocalMap: false,
      });

      expect(state<MapPlace[]>('places')[0].radius).toBeUndefined();
    });
  });

  it('saves the config and places together', async () => {
    await setup([place({ slug: 'roma' })]);
    (component as unknown as { save: () => void }).save();
    expect(replaceSpy).toHaveBeenCalledWith('c1', {
      config: CONFIG,
      places: [place({ slug: 'roma' })],
    });
  });

  it('placing and bounds-editing are mutually exclusive', async () => {
    await setup();
    const c = component as unknown as { toggleMode: (m: string) => void };
    c.toggleMode('placing');
    expect(state<string>('mode')).toBe('placing');
    c.toggleMode('bounds');
    expect(state<string>('mode')).toBe('bounds');
  });

  it('never persists the view-local toggles', async () => {
    await setup();
    const c = component as unknown as {
      labels: { set: (v: boolean) => void };
      filterPreview: { set: (v: boolean) => void };
      save: () => void;
    };
    c.labels.set(true);
    c.filterPreview.set(true);
    c.save();

    const payload = replaceSpy.mock.calls[0][1];
    expect(JSON.stringify(payload)).not.toContain('labels');
    expect(JSON.stringify(payload)).not.toContain('filterPreview');
  });
});
