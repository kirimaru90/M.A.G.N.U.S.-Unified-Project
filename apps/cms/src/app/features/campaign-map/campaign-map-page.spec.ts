import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { WritableSignal, signal } from '@angular/core';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfirmationService, MessageService } from 'primeng/api';
import * as L from 'leaflet';
import { CampaignMapPage } from './campaign-map-page';
import { CampaignMapApiService } from '../../core/campaign-map/campaign-map-api.service';
import { CurrentCampaignService } from '../../core/campaign/current-campaign.service';
import type { CampaignDto } from '../../core/campaign/campaign.types';
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

const CAMPAIGN: CampaignDto = { id: 'c1', name: 'C1', isActive: true, isPublic: true };
const OTHER_CAMPAIGN: CampaignDto = { id: 'c2', name: 'C2', isActive: true, isPublic: true };

describe('CampaignMapPage', () => {
  let fixture: ComponentFixture<CampaignMapPage>;
  let component: CampaignMapPage;
  let getSpy: ReturnType<typeof vi.fn>;
  let replaceSpy: ReturnType<typeof vi.fn>;
  let currentCampaign: WritableSignal<CampaignDto | null>;
  let setCurrentSpy: ReturnType<typeof vi.fn>;

  // `initial: null` mimics a hard refresh landed straight on the map route,
  // where the campaign resolves after the component is created.
  async function setup(places: MapPlace[] = [], initial: CampaignDto | null = CAMPAIGN) {
    const dto: CampaignMapDto = { config: CONFIG, places };
    getSpy = vi.fn().mockReturnValue(of(dto));
    replaceSpy = vi.fn().mockReturnValue(of(dto));
    currentCampaign = signal<CampaignDto | null>(initial);
    setCurrentSpy = vi.fn();

    await TestBed.configureTestingModule({
      imports: [CampaignMapPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CampaignMapApiService, useValue: { get: getSpy, replace: replaceSpy } },
        {
          provide: CurrentCampaignService,
          useValue: {
            currentCampaign,
            campaigns: signal([CAMPAIGN, OTHER_CAMPAIGN]),
            setCurrent: setCurrentSpy,
          },
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

    it('rounds a dragged marker to 6 decimals on store, so the field carries no float noise', async () => {
      await setup([place({ slug: 'roma' })]);
      const markers = (component as unknown as { markers: Map<string, L.Marker> }).markers;
      const marker = markers.get('roma')!;
      // The full-precision value Leaflet would hand back from a real drag.
      marker.setLatLng([41.902800000000014, 12.496400000000031]);
      marker.fire('dragend');
      fixture.detectChanges();

      const moved = state<MapPlace[]>('places')[0];
      expect(moved.lat).toBe(41.9028);
      expect(moved.lng).toBe(12.4964);
    });
  });

  describe('typed coordinate inputs', () => {
    async function selectAndGetInputs(places: MapPlace[]) {
      await setup(places);
      (component as unknown as { select: (s: string) => void }).select(places[0].slug);
      fixture.detectChanges();
      // NgModel's DOM writes (including the disabled/value sync for a freshly
      // rendered field) land a microtask after detectChanges — see the
      // hasLocalMap toggle tests above for the same pattern.
      await fixture.whenStable();
      fixture.detectChanges();
      return {
        latEl: fixture.nativeElement.querySelector('[data-testid="sel-lat"]') as HTMLInputElement,
        lngEl: fixture.nativeElement.querySelector('[data-testid="sel-lng"]') as HTMLInputElement,
      };
    }

    it('typing a new value into sel-lat updates the place and moves its marker', async () => {
      const { latEl } = await selectAndGetInputs([place({ slug: 'roma', lat: 41.9, lng: 12.5 })]);

      latEl.value = '42.5';
      latEl.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(state<MapPlace[]>('places')[0].lat).toBe(42.5);
      const markers = (component as unknown as { markers: Map<string, L.Marker> }).markers;
      expect(markers.get('roma')!.getLatLng().lat).toBe(42.5);
    });

    it('rounds a typed coordinate with more than 6 decimal places to 6 on commit', async () => {
      const { lngEl } = await selectAndGetInputs([place({ slug: 'roma' })]);

      lngEl.value = '12.123456789';
      lngEl.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(state<MapPlace[]>('places')[0].lng).toBe(12.123457);
    });

    it('drag-to-reposition and sposta still update coordinates with the typed inputs present', async () => {
      await setup([place({ slug: 'roma', lat: 41.9, lng: 12.5 })]);
      (component as unknown as { select: (s: string) => void }).select('roma');
      fixture.detectChanges();

      // Drag-to-reposition, unaffected by the new inputs.
      const markers = (component as unknown as { markers: Map<string, L.Marker> }).markers;
      const marker = markers.get('roma')!;
      marker.setLatLng([43.1, 13.2]);
      marker.fire('dragend');
      fixture.detectChanges();
      expect(state<MapPlace[]>('places')[0].lat).toBe(43.1);

      // "sposta": re-click a position on the map still repositions the place.
      (component as unknown as { startMove: () => void }).startMove();
      expect(state<string>('mode')).toBe('placing');

      const map = (component as unknown as { map: L.Map }).map;
      map.fire('click', { latlng: L.latLng(50, 20) } as L.LeafletMouseEvent);
      fixture.detectChanges();

      const moved = state<MapPlace[]>('places')[0];
      expect(moved.lat).toBe(50);
      expect(moved.lng).toBe(20);
      expect(state<string>('mode')).toBe('idle');
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

  describe('reactive to the current campaign', () => {
    it('does not load while the campaign is still resolving', async () => {
      // The hard-refresh race: a one-shot read in ngOnInit would bail here and
      // never retry, leaving the map blank.
      await setup([], null);
      expect(getSpy).not.toHaveBeenCalled();
    });

    it('loads once the campaign resolves', async () => {
      await setup([place({ slug: 'roma' })], null);
      expect(getSpy).not.toHaveBeenCalled();

      currentCampaign.set(CAMPAIGN);
      fixture.detectChanges();

      expect(getSpy).toHaveBeenCalledWith('c1');
      expect(state<MapPlace[]>('places')).toHaveLength(1);
    });

    it('reloads when the campaign changes', async () => {
      await setup([place({ slug: 'roma' })]);
      expect(getSpy).toHaveBeenCalledWith('c1');

      currentCampaign.set(OTHER_CAMPAIGN);
      fixture.detectChanges();

      expect(getSpy).toHaveBeenCalledWith('c2');
    });
  });

  describe('the switch guard', () => {
    const guardOf = (c: CampaignMapPage) =>
      (c as unknown as { switchGuard: () => boolean | Promise<boolean> }).switchGuard;

    it('switches silently when there is nothing unsaved', async () => {
      await setup([place({ slug: 'roma' })]);
      const spy = vi.spyOn(TestBed.inject(ConfirmationService), 'confirm');

      expect(guardOf(component)()).toBe(true);
      expect(spy).not.toHaveBeenCalled();
    });

    it('prompts before a switch that would discard unsaved edits', async () => {
      await setup([place({ slug: 'roma' })]);
      const spy = vi.spyOn(TestBed.inject(ConfirmationService), 'confirm');

      component.addPlaceAt(43.5, 11.2);

      const result = guardOf(component)();
      expect(result).toBeInstanceOf(Promise);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
