import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { WritableSignal, signal } from '@angular/core';
import { Observable, Subject, of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfirmationService, MessageService } from 'primeng/api';
import * as L from 'leaflet';
import { BASEMAP_ATTRIBUTION, CampaignMapPage, cartoTileUrl } from './campaign-map-page';
import type { MarkerLayer } from '../../shared/map-core/marker-layer.js';
import { ICONS } from '../../shared/map-core/icons.js';
import { PHOSPHOR_THEMES, tintColour } from '../../shared/map-core/style.js';
import { CampaignMapApiService } from '../../core/campaign-map/campaign-map-api.service';
import { CurrentCampaignService } from '../../core/campaign/current-campaign.service';
import { CodexApiService } from '../../core/codex/codex-api.service';
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
  let codexListSpy: ReturnType<typeof vi.fn>;

  // `initial: null` mimics a hard refresh landed straight on the map route,
  // where the campaign resolves after the component is created.
  // `get$` replaces the immediate response, e.g. with a Subject held in flight.
  async function setup(
    places: MapPlace[] = [],
    initial: CampaignDto | null = CAMPAIGN,
    get$?: Observable<CampaignMapDto>,
  ) {
    const dto: CampaignMapDto = { config: CONFIG, places };
    getSpy = vi.fn().mockReturnValue(get$ ?? of(dto));
    replaceSpy = vi.fn().mockReturnValue(of(dto));
    currentCampaign = signal<CampaignDto | null>(initial);
    setCurrentSpy = vi.fn();
    codexListSpy = vi.fn().mockReturnValue(
      of([
        { id: 'e1', name: 'Diamond City', type: 'luogo', isDeleted: false },
        { id: 'e2', name: 'Mirelurk', type: 'creatura', isDeleted: true },
      ]),
    );

    await TestBed.configureTestingModule({
      imports: [CampaignMapPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CampaignMapApiService, useValue: { get: getSpy, replace: replaceSpy } },
        { provide: CodexApiService, useValue: { list: codexListSpy } },
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

  const state = <T>(key: string): T => (component as unknown as Record<string, () => T>)[key]();
  const layer = () => (component as unknown as { layer: MarkerLayer<MapPlace> }).layer;
  const shown = () => [...(layer().plan()?.shown ?? [])].sort();

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
      const before = shown();
      expect(before.length).toBeGreaterThan(0);

      (component as unknown as { toggleBranch: (s: string, e: Event) => void }).toggleBranch(
        'region',
        new Event('click'),
      );
      fixture.detectChanges();

      expect(shown()).toEqual(before);
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
      (component as unknown as { nameFilter: { set: (v: string) => void } }).nameFilter.set(
        'vault',
      );
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
      const marker = layer().markerFor('roma')!;
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
      expect(layer().markerFor('roma')!.getLatLng().lat).toBe(42.5);
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
      const marker = layer().markerFor('roma')!;
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

  describe('the codex link', () => {
    type CodexInternals = {
      select(slug: string | null): void;
      setCodexEntry(id: string | null): void;
      codexOptions(): { value: string; label: string }[];
    };
    const internals = () => component as unknown as CodexInternals;

    it('loads the campaign codex and lists entries by name and type, deleted ones marked', async () => {
      await setup([place({ slug: 'dc' })]);
      expect(codexListSpy).toHaveBeenCalledWith('c1');
      internals().select('dc');
      expect(internals().codexOptions()).toEqual([
        { value: 'e1', label: 'Diamond City · Luogo' },
        { value: 'e2', label: 'Mirelurk · Creatura (eliminata)' },
      ]);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-testid="sel-codex-field"]')).toBeTruthy();
    });

    it('links and clears a place, removing the field on clear', async () => {
      await setup([place({ slug: 'dc' })]);
      internals().select('dc');
      internals().setCodexEntry('e1');
      expect(state<MapPlace[]>('places')[0].codexEntryId).toBe('e1');
      internals().setCodexEntry(null);
      expect(state<MapPlace[]>('places')[0]).not.toHaveProperty('codexEntryId');
      expect(state<MapPlace | null>('draft')).not.toHaveProperty('codexEntryId');
    });

    it('shows a dangling id as Voce non trovata', async () => {
      await setup([place({ slug: 'dc', codexEntryId: 'ghost' })]);
      internals().select('dc');
      expect(internals().codexOptions()[0]).toEqual({ value: 'ghost', label: 'Voce non trovata' });
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

  describe('CARTO basemap', () => {
    it('cartoTileUrl appends the key to both styles', () => {
      expect(cartoTileUrl('dark_nolabels', 'abc')).toBe(
        'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png?key=abc',
      );
      expect(cartoTileUrl('dark_all', 'abc')).toBe(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=abc',
      );
    });

    it('cartoTileUrl omits the key when empty or still the build placeholder', () => {
      for (const key of ['', 'CARTO_KEY_TODO']) {
        const url = cartoTileUrl('dark_nolabels', key);
        expect(url).not.toContain('?');
        expect(url).not.toContain('CARTO_KEY_TODO');
      }
    });

    it('shows the linked CARTO-worded credit in the attribution control', async () => {
      await setup();
      const control = (fixture.nativeElement as HTMLElement).querySelector(
        '.leaflet-control-attribution',
      )!;
      expect(control.textContent).toContain('OpenStreetMap contributors');
      expect(control.textContent).toContain('CARTO');

      const hrefs = Array.from(control.querySelectorAll('a')).map((a) => a.getAttribute('href'));
      expect(hrefs).toContain('https://www.openstreetmap.org/copyright');
      expect(hrefs).toContain('https://carto.com/attribution');
    });

    it('toggling labels swaps the style but keeps the credit', async () => {
      await setup();
      const c = component as unknown as {
        labels: { set: (v: boolean) => void };
        tiles: L.TileLayer;
      };
      c.labels.set(true);
      fixture.detectChanges();

      expect((c.tiles as unknown as { _url: string })._url).toContain('/dark_all/');
      expect(c.tiles.options.attribution).toBe(BASEMAP_ATTRIBUTION);
      const control = (fixture.nativeElement as HTMLElement).querySelector(
        '.leaflet-control-attribution',
      )!;
      expect(control.textContent).toContain('OpenStreetMap contributors');

      c.labels.set(false);
      fixture.detectChanges();
      expect((c.tiles as unknown as { _url: string })._url).toContain('/dark_nolabels/');
      expect(c.tiles.options.attribution).toBe(BASEMAP_ATTRIBUTION);
    });
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

  describe('the start view', () => {
    const LOADED = {
      ...CONFIG,
      startLat: 45.46,
      startLng: 9.19,
      startZoom: 10,
      minZoom: 8,
      maxZoom: 16,
    };
    const leaflet = () => (component as unknown as { map: L.Map }).map;
    const view = () => {
      const c = leaflet().getCenter();
      return { lat: +c.lat.toFixed(4), lng: +c.lng.toFixed(4), zoom: leaflet().getZoom() };
    };

    it('frames a map built before the load resolved on the loaded start view', async () => {
      const inFlight = new Subject<CampaignMapDto>();
      await setup([], CAMPAIGN, inFlight);
      // Built from DEFAULT_CONFIG while the request is still pending.
      expect(leaflet()).toBeTruthy();
      expect(view().zoom).not.toBe(10);

      inFlight.next({ config: LOADED, places: [] });
      fixture.detectChanges();

      expect(view()).toEqual({ lat: 45.46, lng: 9.19, zoom: 10 });
    });

    it('does not move the view when the start fields are edited', async () => {
      const inFlight = new Subject<CampaignMapDto>();
      await setup([], CAMPAIGN, inFlight);
      inFlight.next({ config: LOADED, places: [] });
      fixture.detectChanges();

      const patch = (component as unknown as { patchConfig: (p: object) => void }).patchConfig.bind(
        component,
      );
      patch({ startLat: 40, startLng: 14, startZoom: 12 });
      fixture.detectChanges();

      expect(view()).toEqual({ lat: 45.46, lng: 9.19, zoom: 10 });
    });

    it('re-frames on the new start view after a campaign switch', async () => {
      await setup();
      const inFlight = new Subject<CampaignMapDto>();
      getSpy.mockReturnValue(inFlight);
      currentCampaign.set(OTHER_CAMPAIGN);
      fixture.detectChanges();

      inFlight.next({ config: LOADED, places: [] });
      fixture.detectChanges();

      expect(view()).toEqual({ lat: 45.46, lng: 9.19, zoom: 10 });
    });

    it('frames without any call that could start an animated zoom', async () => {
      // jsdom has no 3D transforms, so Leaflet never animates here and the real
      // race (an in-flight zoom pulling the map back) cannot show. Pin the
      // mechanism instead: none of these may run on the way to the start view.
      const inFlight = new Subject<CampaignMapDto>();
      await setup([], CAMPAIGN, inFlight);
      const map = leaflet();
      expect(map.getZoom()).toBe(6);
      const spies = (['setZoom', 'setMinZoom', 'setMaxZoom', 'flyTo'] as const).map((name) =>
        vi.spyOn(map, name),
      );

      (component as unknown as { applyStartView: (c: typeof LOADED) => void }).applyStartView(
        LOADED,
      );

      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
      expect(view()).toEqual({ lat: 45.46, lng: 9.19, zoom: 10 });
      expect(map.getMinZoom()).toBe(8);
      expect(map.getMaxZoom()).toBe(16);
    });
  });

  describe('the zoom-range fields', () => {
    const saveButton = () =>
      fixture.nativeElement.querySelector('[data-testid="save"]') as HTMLButtonElement;

    it('carry directional labels', async () => {
      await setup();
      const text = (id: string) =>
        (fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement)
          .closest('label')!
          .textContent!.trim();
      expect(text('cfg-minzoom')).toBe('Zoom minimo (più lontano)');
      expect(text('cfg-maxzoom')).toBe('Zoom massimo (più vicino)');
    });

    it('blocks saving a start zoom outside the range, with an Italian message', async () => {
      await setup();
      const patch = (component as unknown as { patchConfig: (p: object) => void }).patchConfig.bind(
        component,
      );
      patch({ minZoom: 8, maxZoom: 16, startZoom: 6 });
      fixture.detectChanges();

      expect(saveButton().disabled).toBe(true);
      const err = fixture.nativeElement.querySelector('[data-testid="cfg-error"]') as HTMLElement;
      expect(err.textContent).toContain('zoom iniziale');

      patch({ startZoom: 8 });
      fixture.detectChanges();
      expect(saveButton().disabled).toBe(false);
      expect(fixture.nativeElement.querySelector('[data-testid="cfg-error"]')).toBeNull();
    });

    it('blocks saving a minimum zoom above the maximum', async () => {
      await setup();
      const patch = (component as unknown as { patchConfig: (p: object) => void }).patchConfig.bind(
        component,
      );
      patch({ minZoom: 17, maxZoom: 16, startZoom: 16 });
      fixture.detectChanges();

      expect(saveButton().disabled).toBe(true);
      const err = fixture.nativeElement.querySelector('[data-testid="cfg-error"]') as HTMLElement;
      expect(err.textContent).toContain('zoom minimo');
    });
  });

  describe('the markers', () => {
    // jsdom lays nothing out, so the map has no size and every place with
    // children would read as open. Give it a phone-ish canvas to plan against.
    function sized(): L.Map {
      const map = (component as unknown as { map: L.Map }).map;
      vi.spyOn(map, 'getSize').mockReturnValue(L.point(800, 600));
      layer().sync();
      return map;
    }
    const el = (slug: string) => layer().markerFor(slug)?.getElement() ?? null;

    // A settlement with a building 100 m north of it: at the start zoom (6) the
    // settlement is closed, so only it renders; at 17 it is open.
    const TOWN = [
      place({ slug: 'town', name: 'Diamond City', type: 'settlement', radius: 300 }),
      place({
        slug: 'bank',
        name: 'Banca',
        type: 'building',
        parent: 'town',
        lat: 41.9009,
        hasLocalMap: false,
      }),
    ];

    it('bear the Pip-Boy icon for their type', async () => {
      await setup([
        place({ slug: 'town', type: 'settlement' }),
        place({ slug: 'v', type: 'vault', lng: 14 }),
      ]);
      sized();
      // Parsed, so `<path/>` reads back as the DOM serialises it.
      const parsed = (html: string) =>
        Object.assign(document.createElement('div'), { innerHTML: html }).innerHTML;
      expect(el('town')!.innerHTML).toContain(parsed(ICONS['settlement']));
      expect(el('v')!.innerHTML).toContain(parsed(ICONS['vault']));
      expect(el('town')!.querySelector('.pb-map-marker-label')!.textContent).toBe('town');
    });

    it('show a child only once its parent is open', async () => {
      await setup(TOWN);
      const map = sized();
      expect(shown()).toEqual(['town']);

      map.setView([41.9, 12.5], 17, { animate: false });
      expect(shown()).toEqual(['bank']);
    });

    it('always render the selected place, draggable, whatever its level of detail', async () => {
      await setup(TOWN);
      sized();
      (component as unknown as { select: (s: string) => void }).select('bank');
      fixture.detectChanges();

      expect(shown()).toContain('bank');
      expect(layer().markerFor('bank')!.dragging!.enabled()).toBe(true);
    });

    it('collapse public and non-public places into one +N', async () => {
      await setup([
        place({ slug: 'town', type: 'settlement', hasLocalMap: false }),
        place({ slug: 'secret', type: 'poi', isPublic: false, hasLocalMap: false }),
      ]);
      sized();

      expect(shown()).toEqual(['town']);
      const badge = el('town')!.querySelector('[data-map-badge]') as HTMLElement;
      expect(badge.hidden).toBe(false);
      expect(badge.textContent).toBe('+1');
    });

    it('separate a group when its badge is tapped', async () => {
      await setup([
        place({ slug: 'a', hasLocalMap: false }),
        place({ slug: 'b', hasLocalMap: false, lng: 12.51 }),
      ]);
      const map = sized();
      expect(shown()).toEqual(['a']);

      (el('a')!.querySelector('[data-map-badge]') as HTMLElement).click();

      expect(map.getZoom()).toBeGreaterThan(6);
      expect(shown()).toEqual(['a', 'b']);
    });

    it('hide a colliding label and keep both icons', async () => {
      // Icons 40 px apart at zoom 6 clear the 30 px collision box; 100 px
      // labels under them do not.
      const width = vi
        .spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
        .mockImplementation(function (this: HTMLElement) {
          return this.classList.contains('pb-map-marker-label') ? 100 : 0;
        });
      const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(13);
      try {
        await setup([
          place({ slug: 'a', hasLocalMap: false }),
          place({ slug: 'b', hasLocalMap: false, lng: 13.38 }),
        ]);
        await Promise.resolve();
        sized();

        expect(shown()).toEqual(['a', 'b']);
        expect(el('a')!.classList.contains('is-label-hidden')).toBe(false);
        expect(el('b')!.classList.contains('is-label-hidden')).toBe(true);
      } finally {
        width.mockRestore();
        height.mockRestore();
      }
    });

    it('narrow to the name filter without changing which places are open', async () => {
      await setup([
        ...TOWN,
        place({
          slug: 'vault',
          name: 'Banco dei pegni',
          type: 'building',
          parent: 'town',
          lat: 41.8991,
          hasLocalMap: false,
        }),
      ]);
      const map = sized();
      map.setView([41.9, 12.5], 17, { animate: false });
      expect(shown()).toEqual(['bank', 'vault']);

      (component as unknown as { nameFilter: { set: (v: string) => void } }).nameFilter.set(
        'banca',
      );
      fixture.detectChanges();

      // The town is still open, so it stays off the map even though it is the
      // filter's parent, and the non-matching sibling is hidden.
      expect(shown()).toEqual(['bank']);
    });

    it('draw non-public and inherited places red, public ones not', async () => {
      await setup([
        place({ slug: 'open', hasLocalMap: false }),
        place({ slug: 'bunker', isPublic: false, lng: 14, radius: 100 }),
        place({ slug: 'room', parent: 'bunker', lng: 14.0005, hasLocalMap: false }),
      ]);
      sized();
      const red = (slug: string) => el(slug)!.classList.contains('is-hidden');

      expect(red('open')).toBe(false);
      expect(red('bunker')).toBe(true);
      (component as unknown as { select: (s: string) => void }).select('room');
      fixture.detectChanges();
      expect(red('room')).toBe(true);
    });
  });

  describe('the filter preview', () => {
    const map = () => (component as unknown as { map: L.Map }).map;
    const toggle = (on: boolean) => {
      (component as unknown as { filterPreview: { set: (v: boolean) => void } }).filterPreview.set(
        on,
      );
      fixture.detectChanges();
    };

    it('puts the shared VERDE filter on the tile pane, and takes it off again', async () => {
      await setup();
      expect(map().getPane('tilePane')!.style.filter).toBe('');

      toggle(true);
      expect(map().getPane('tilePane')!.style.filter).toBe('url("#pb-phosphor-tint")');
      const [r, g, b] = tintColour(PHOSPHOR_THEMES.green.rgb);
      const filter = document.getElementById('pb-phosphor-tint')!;
      expect(filter.innerHTML).toContain(
        `values="${r} 0 0 0 0  0 ${g} 0 0 0  0 0 ${b} 0 0  0 0 0 1 0"`,
      );

      toggle(false);
      expect(map().getPane('tilePane')!.style.filter).toBe('');
    });

    it('gives public markers the Pip-Boy colours and keeps non-public ones red', async () => {
      await setup([
        place({ slug: 'open', hasLocalMap: false }),
        place({ slug: 'secret', isPublic: false, hasLocalMap: false, lng: 14 }),
      ]);
      const red = (slug: string) =>
        layer().markerFor(slug)!.getElement()!.classList.contains('is-hidden');
      const icon = () => map().getContainer().style.getPropertyValue('--mk-icon');

      expect(icon()).toBe('');
      expect(red('secret')).toBe(true);

      toggle(true);
      expect(icon()).toBe(`rgb(${PHOSPHOR_THEMES.green.brightRgb})`);
      expect(red('secret')).toBe(true);
      expect(red('open')).toBe(false);
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
