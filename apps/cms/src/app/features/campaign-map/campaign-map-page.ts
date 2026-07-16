import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { Toast } from 'primeng/toast';
import * as L from 'leaflet';
import { CampaignMapApiService } from '../../core/campaign-map/campaign-map-api.service';
import { CurrentCampaignService } from '../../core/campaign/current-campaign.service';
import {
  DEFAULT_PLACE_RADIUS_M,
  PLACE_TYPE_OPTIONS,
  type CampaignMapDto,
  type MapConfig,
  type MapPlace,
  type PlaceType,
} from '../../core/campaign-map/campaign-map.types';
import {
  approxOpenZoom,
  cascaded,
  descendants,
  effectiveRadius,
  floorR,
  kids,
  visibleToPlayer,
} from './place-tree';
import { exportPlaces, mergePlaces, slugify } from './place-import';

/** CARTO dark. `nolabels` is what the player sees; labels are an authoring aid. */
const TILE_NOLABELS = 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';
const TILE_LABELS = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

const DEFAULT_CONFIG: MapConfig = {
  startLat: 41.9028,
  startLng: 12.4964,
  startZoom: 6,
  minZoom: 3,
  maxZoom: 18,
  bounds: { south: 35, west: 6, north: 48, east: 19 },
};

interface Row {
  place: MapPlace;
  depth: number;
  hasKids: boolean;
  collapsed: boolean;
  hiddenCount: number;
  authored: number;
  effective: number;
  vis: 'public' | 'hidden' | 'inherited';
}

type Mode = 'idle' | 'placing' | 'bounds';

@Component({
  selector: 'app-campaign-map-page',
  standalone: true,
  imports: [
    DecimalPipe,
    FormsModule,
    TableModule,
    ButtonModule,
    ConfirmDialog,
    Toast,
    InputTextModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-toast />
    <p-confirmdialog />

    <div class="bo-page">
      <div class="bo-page-head">
        <h1>Mappa della campagna</h1>
        <div class="cm-counts" data-testid="counts">
          <span>{{ places().length }} luoghi</span>
          <span>·</span>
          <span data-testid="visible-count">{{ visibleCount() }} visibili al giocatore</span>
        </div>
        <div class="bo-page-head-actions">
          <label class="cm-inline">
            <input
              type="checkbox"
              data-testid="toggle-labels"
              [ngModel]="labels()"
              (ngModelChange)="labels.set($event)"
            />
            etichette
          </label>
          <label class="cm-inline">
            <input
              type="checkbox"
              data-testid="toggle-filter"
              [ngModel]="filterPreview()"
              (ngModelChange)="filterPreview.set($event)"
            />
            anteprima filtro Pip-Boy
          </label>
          <button type="button" class="bo-btn" data-testid="cancel" (click)="reload()">
            Annulla
          </button>
          <button
            type="button"
            class="bo-btn primary"
            data-testid="save"
            [disabled]="saving()"
            (click)="save()"
          >
            Salva
          </button>
        </div>
      </div>

      @if (!campaignId()) {
        <div class="bo-card" data-testid="no-campaign">
          Seleziona una campagna per authoring della mappa.
        </div>
      } @else {
        <div class="cm-grid">
          <div class="bo-card cm-map-card">
            <div
              #mapEl
              class="cm-map"
              data-testid="map"
              [class.cm-filtered]="filterPreview()"
              [class.cm-placing]="mode() === 'placing'"
              [style.min-height.px]="mapMinHeight()"
            ></div>
          </div>

          <div #sideCol class="cm-side">
            <div class="bo-card">
              <div class="cm-card-head">
                <strong>Configurazione</strong>
                <button
                  type="button"
                  class="bo-btn"
                  data-testid="toggle-config"
                  (click)="configCollapsed.set(!configCollapsed())"
                >
                  {{ configCollapsed() ? 'Espandi' : 'Comprimi' }}
                </button>
              </div>

              @if (configCollapsed()) {
                <div class="cm-summary" data-testid="config-summary">
                  z{{ config().startZoom }} · {{ config().startLat | number: '1.3-3' }},
                  {{ config().startLng | number: '1.3-3' }} · zoom
                  {{ config().minZoom }}–{{ config().maxZoom }}
                </div>
              } @else {
                <div class="cm-fields">
                  <label>
                    Lat iniziale
                    <input
                      pInputText
                      type="number"
                      data-testid="cfg-lat"
                      [ngModel]="config().startLat"
                      (ngModelChange)="patchConfig({ startLat: +$event })"
                    />
                  </label>
                  <label>
                    Lng iniziale
                    <input
                      pInputText
                      type="number"
                      data-testid="cfg-lng"
                      [ngModel]="config().startLng"
                      (ngModelChange)="patchConfig({ startLng: +$event })"
                    />
                  </label>
                  <label>
                    Zoom iniziale
                    <input
                      pInputText
                      type="number"
                      data-testid="cfg-zoom"
                      [ngModel]="config().startZoom"
                      (ngModelChange)="patchConfig({ startZoom: +$event })"
                    />
                  </label>
                  <button
                    type="button"
                    class="bo-btn"
                    data-testid="cfg-use-view"
                    (click)="captureStartView()"
                  >
                    Usa vista corrente
                  </button>

                  <label>
                    Zoom min
                    <input
                      pInputText
                      type="number"
                      data-testid="cfg-minzoom"
                      [ngModel]="config().minZoom"
                      (ngModelChange)="patchConfig({ minZoom: +$event })"
                    />
                  </label>
                  <label>
                    Zoom max
                    <input
                      pInputText
                      type="number"
                      data-testid="cfg-maxzoom"
                      [ngModel]="config().maxZoom"
                      (ngModelChange)="patchConfig({ maxZoom: +$event })"
                    />
                  </label>

                  <div class="cm-bounds">
                    <strong>Limiti</strong>
                    <div class="cm-bounds-grid">
                      <label>
                        S
                        <input
                          pInputText
                          type="number"
                          data-testid="cfg-south"
                          [ngModel]="config().bounds.south"
                          (ngModelChange)="patchBounds({ south: +$event })"
                        />
                      </label>
                      <label>
                        O
                        <input
                          pInputText
                          type="number"
                          data-testid="cfg-west"
                          [ngModel]="config().bounds.west"
                          (ngModelChange)="patchBounds({ west: +$event })"
                        />
                      </label>
                      <label>
                        N
                        <input
                          pInputText
                          type="number"
                          data-testid="cfg-north"
                          [ngModel]="config().bounds.north"
                          (ngModelChange)="patchBounds({ north: +$event })"
                        />
                      </label>
                      <label>
                        E
                        <input
                          pInputText
                          type="number"
                          data-testid="cfg-east"
                          [ngModel]="config().bounds.east"
                          (ngModelChange)="patchBounds({ east: +$event })"
                        />
                      </label>
                    </div>
                    <div class="cm-inline-actions">
                      <button
                        type="button"
                        class="bo-btn"
                        data-testid="cfg-capture-bounds"
                        (click)="captureBounds()"
                      >
                        Cattura vista
                      </button>
                      <button
                        type="button"
                        class="bo-btn"
                        data-testid="cfg-edit-bounds"
                        [class.primary]="mode() === 'bounds'"
                        (click)="toggleMode('bounds')"
                      >
                        {{ mode() === 'bounds' ? 'Fine' : 'Modifica sulla mappa' }}
                      </button>
                    </div>
                  </div>
                </div>
              }
            </div>

            <div class="bo-card">
              <div class="cm-card-head">
                <strong>Selezione</strong>
                <button
                  type="button"
                  class="bo-btn"
                  data-testid="place-mode"
                  [class.primary]="mode() === 'placing'"
                  (click)="toggleMode('placing')"
                >
                  {{ mode() === 'placing' ? 'Annulla' : '+ Aggiungi luogo' }}
                </button>
              </div>

              @if (draft(); as d) {
                <div class="cm-fields" data-testid="selection-card">
                  <label>
                    Nome
                    <input
                      pInputText
                      data-testid="sel-name"
                      [ngModel]="d.name"
                      (ngModelChange)="patchPlace({ name: $event })"
                    />
                  </label>

                  <label>
                    Tipo
                    <select
                      data-testid="sel-type"
                      [ngModel]="d.type"
                      (ngModelChange)="patchPlace({ type: $event })"
                    >
                      @for (opt of typeOptions; track opt.value) {
                        <option [value]="opt.value">{{ opt.label }}</option>
                      }
                    </select>
                  </label>

                  <label>
                    Contenuto in
                    <select
                      data-testid="sel-parent"
                      [ngModel]="d.parent ?? ''"
                      (ngModelChange)="patchPlace({ parent: $event || null })"
                    >
                      <option value="">— nessuno —</option>
                      @for (opt of parentOptions(); track opt.slug) {
                        <option [value]="opt.slug">{{ opt.name }}</option>
                      }
                    </select>
                  </label>

                  <div class="cm-coords">
                    <span data-testid="sel-coords">
                      {{ d.lat | number: '1.4-4' }}, {{ d.lng | number: '1.4-4' }}
                    </span>
                    <button
                      type="button"
                      class="bo-btn"
                      data-testid="sel-move"
                      [class.primary]="mode() === 'placing' && movingExisting()"
                      (click)="startMove()"
                    >
                      sposta
                    </button>
                  </div>

                  <label class="cm-inline">
                    <input
                      type="checkbox"
                      data-testid="sel-haslocalmap"
                      [ngModel]="d.hasLocalMap"
                      [disabled]="selectedHasKids()"
                      (ngModelChange)="patchPlace({ hasLocalMap: $event })"
                    />
                    mappa locale
                  </label>
                  @if (selectedHasKids()) {
                    <small class="cm-hint" data-testid="haslocalmap-hint">
                      Non disattivabile: contiene altri luoghi.
                    </small>
                  }

                  @if (d.hasLocalMap) {
                    <label>
                      Raggio (m)
                      <input
                        pInputText
                        type="number"
                        data-testid="sel-radius"
                        [ngModel]="d.radius ?? defaultRadius"
                        (ngModelChange)="patchPlace({ radius: +$event })"
                      />
                    </label>
                    <small class="cm-hint" data-testid="sel-effective">
                      effettivo {{ selectedEffective() | number: '1.0-0' }} m · ≈z{{
                        selectedOpenZoom()
                      }}
                    </small>
                  }

                  <label class="cm-inline">
                    <input
                      type="checkbox"
                      data-testid="sel-ispublic"
                      [ngModel]="d.isPublic"
                      (ngModelChange)="patchPlace({ isPublic: $event })"
                    />
                    pubblico
                  </label>
                  @if (selectedCascaded()) {
                    <small class="cm-hint" data-testid="cascade-hint">
                      Ereditato: nascosto da un luogo che lo contiene.
                    </small>
                  }

                  <label>
                    Descrizione
                    <textarea
                      pInputText
                      rows="3"
                      data-testid="sel-desc"
                      [ngModel]="d.desc ?? ''"
                      (ngModelChange)="patchPlace({ desc: $event })"
                    ></textarea>
                  </label>

                  <button
                    type="button"
                    class="bo-btn danger"
                    data-testid="sel-delete"
                    (click)="confirmDelete(d.slug)"
                  >
                    Elimina
                  </button>
                </div>
              } @else {
                <div class="cm-empty" data-testid="selection-empty">
                  Nessun luogo selezionato.
                </div>
              }
            </div>
          </div>
        </div>

        <div class="bo-card">
          <div class="bo-filter-bar">
            <input
              pInputText
              data-testid="filter-name"
              [ngModel]="nameFilter()"
              (ngModelChange)="nameFilter.set($event)"
              placeholder="Filtra per nome"
            />
            <button type="button" class="bo-btn" data-testid="export" (click)="doExport()">
              Esporta
            </button>
            <button type="button" class="bo-btn" data-testid="import" (click)="fileEl.click()">
              Importa
            </button>
            <input
              #fileEl
              type="file"
              accept="application/json,.json"
              data-testid="import-file"
              hidden
              (change)="doImport($event)"
            />
          </div>

          <p-table [value]="rows()" dataKey="place.slug" data-testid="places-table">
            <ng-template pTemplate="header">
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Visibilità</th>
                <th>Raggio</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-row>
              <tr
                [attr.data-testid]="'row-' + row.place.slug"
                [class.cm-row-selected]="row.place.slug === selected()"
                (click)="select(row.place.slug)"
              >
                <td>
                  <span [style.padding-left.px]="row.depth * 16"></span>
                  @if (row.hasKids && !filtering()) {
                    <button
                      type="button"
                      class="cm-twisty"
                      [attr.data-testid]="'twisty-' + row.place.slug"
                      (click)="toggleBranch(row.place.slug, $event)"
                    >
                      {{ row.collapsed ? '▸' : '▾' }}
                    </button>
                  }
                  <span [attr.data-testid]="'name-' + row.place.slug">{{ row.place.name }}</span>
                  @if (row.collapsed && row.hiddenCount > 0) {
                    <span class="cm-badge" [attr.data-testid]="'badge-' + row.place.slug">
                      {{ row.hiddenCount }}
                    </span>
                  }
                </td>
                <td>{{ typeLabel(row.place.type) }}</td>
                <td>
                  <span
                    class="cm-pill"
                    [class.cm-pill-public]="row.vis === 'public'"
                    [class.cm-pill-hidden]="row.vis === 'hidden'"
                    [class.cm-pill-inherited]="row.vis === 'inherited'"
                    [attr.data-testid]="'vis-' + row.place.slug"
                  >
                    {{ visLabel(row.vis) }}
                  </span>
                </td>
                <td [attr.data-testid]="'radius-' + row.place.slug">
                  @if (!row.place.hasLocalMap) {
                    —
                  } @else if (row.effective > row.authored) {
                    {{ row.authored | number: '1.0-0' }} → {{ row.effective | number: '1.0-0' }} m
                  } @else {
                    {{ row.authored | number: '1.0-0' }} m
                  }
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="4" data-testid="table-empty">Nessun luogo.</td>
              </tr>
            </ng-template>
          </p-table>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .cm-grid {
        display: grid;
        grid-template-columns: 1fr 360px;
        gap: 16px;
        align-items: stretch;
      }
      .cm-map-card {
        display: flex;
      }
      .cm-map {
        flex: 1;
        width: 100%;
        border-radius: 4px;
      }
      /* The exact token from pipboy-map-tab — a design token, not a tuning knob. */
      /* ::ng-deep because Leaflet builds the tile pane at runtime, without the
         component's scoping attribute — a scoped selector never matches it. */
      :host ::ng-deep .cm-filtered .leaflet-tile-pane {
        filter: grayscale(1) invert(0) sepia(1) hue-rotate(90deg) saturate(8) brightness(2)
          contrast(1);
      }
      .cm-placing {
        cursor: crosshair;
      }
      .cm-side {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .cm-card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        cursor: pointer;
      }
      .cm-fields {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 8px;
      }
      .cm-fields label {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 12px;
      }
      .cm-inline {
        flex-direction: row !important;
        align-items: center;
        gap: 6px;
      }
      .cm-inline-actions {
        display: flex;
        gap: 8px;
        margin-top: 6px;
      }
      .cm-bounds-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
      }
      .cm-counts {
        display: flex;
        gap: 6px;
        font-size: 12px;
        opacity: 0.8;
      }
      .cm-coords {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 12px;
      }
      .cm-hint {
        opacity: 0.7;
        font-size: 11px;
      }
      .cm-empty,
      .cm-summary {
        font-size: 12px;
        opacity: 0.75;
        margin-top: 8px;
      }
      .cm-twisty {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0 4px;
        color: inherit;
      }
      .cm-badge {
        margin-left: 6px;
        padding: 0 6px;
        border-radius: 8px;
        background: rgba(127, 127, 127, 0.25);
        font-size: 11px;
      }
      .cm-pill {
        padding: 1px 8px;
        border-radius: 10px;
        font-size: 11px;
        border: 1px solid currentColor;
      }
      .cm-pill-public {
        color: #2e7d32;
      }
      .cm-pill-hidden {
        color: #b71c1c;
      }
      .cm-pill-inherited {
        color: #ef6c00;
      }
      .cm-row-selected {
        outline: 1px solid var(--p-primary-color, #4caf50);
      }
    `,
    // L.divIcon already anchors at iconSize/2 via a negative margin of its own.
    // Adding one here doubles it and sits every marker half its size up-and-left
    // of its actual coordinate — invisible until you need exact pixel targets.
    `
      :host ::ng-deep .cm-marker {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        border: 2px solid #fff;
        box-sizing: border-box;
      }
      :host ::ng-deep .cm-marker-public {
        background: #2e7d32;
      }
      :host ::ng-deep .cm-marker-hidden {
        background: #b71c1c;
        border-style: dashed;
      }
      :host ::ng-deep .cm-marker-inherited {
        background: #ef6c00;
        border-style: dotted;
      }
      :host ::ng-deep .cm-handle {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #fff;
        border: 2px solid #333;
        box-sizing: border-box;
      }
    `,
  ],
})
export class CampaignMapPage implements OnInit, AfterViewInit, OnDestroy {
  private readonly api = inject(CampaignMapApiService);
  private readonly currentCampaign = inject(CurrentCampaignService);
  private readonly confirm = inject(ConfirmationService);
  private readonly toast = inject(MessageService);

  private readonly mapEl = viewChild<ElementRef<HTMLElement>>('mapEl');
  private readonly sideCol = viewChild<ElementRef<HTMLElement>>('sideCol');

  protected readonly typeOptions = PLACE_TYPE_OPTIONS;
  protected readonly defaultRadius = DEFAULT_PLACE_RADIUS_M;

  protected readonly config = signal<MapConfig>(DEFAULT_CONFIG);
  protected readonly places = signal<MapPlace[]>([]);
  protected readonly selected = signal<string | null>(null);
  /** The selection card's own copy, so typing never re-renders the card. */
  protected readonly draft = signal<MapPlace | null>(null);
  protected readonly saving = signal(false);
  protected readonly mode = signal<Mode>('idle');
  protected readonly movingExisting = signal(false);

  // View-local and never persisted: the author needs street names to know where
  // they are dropping things; the player must not have them.
  protected readonly labels = signal(false);
  protected readonly filterPreview = signal(false);

  protected readonly configCollapsed = signal(false);
  protected readonly nameFilter = signal('');
  protected readonly collapsedBranches = signal<ReadonlySet<string>>(new Set());
  protected readonly mapMinHeight = signal(420);

  protected readonly campaignId = computed(() => this.currentCampaign.currentCampaign()?.id ?? null);

  protected readonly effR = computed(() => effectiveRadius(this.places()));
  protected readonly floors = computed(() => floorR(this.places()));
  protected readonly visibleCount = computed(() => visibleToPlayer(this.places()).size);
  protected readonly filtering = computed(() => this.nameFilter().trim().length > 0);

  protected readonly selectedPlace = computed(() => {
    const slug = this.selected();
    return slug ? (this.places().find((p) => p.slug === slug) ?? null) : null;
  });

  protected readonly selectedHasKids = computed(() => {
    const slug = this.selected();
    return slug ? kids(this.places(), slug).length > 0 : false;
  });

  protected readonly selectedCascaded = computed(() => {
    const slug = this.selected();
    return slug ? cascaded(this.places(), slug) : false;
  });

  protected readonly selectedEffective = computed(() => {
    const slug = this.selected();
    return slug ? (this.effR().get(slug) ?? 0) : 0;
  });

  protected readonly selectedOpenZoom = computed(() => {
    const place = this.selectedPlace();
    if (!place) return 0;
    return approxOpenZoom(this.selectedEffective(), place.lat);
  });

  /** A place may not be contained by itself, its own descendants, or a pin. */
  protected readonly parentOptions = computed(() => {
    const slug = this.selected();
    if (!slug) return [];
    const banned = new Set([slug, ...descendants(this.places(), slug).map((p) => p.slug)]);
    return this.places().filter((p) => !banned.has(p.slug) && p.hasLocalMap);
  });

  protected readonly rows = computed<Row[]>(() => {
    const places = this.places();
    const effR = this.effR();
    const collapsed = this.collapsedBranches();
    const filter = this.nameFilter().trim().toLowerCase();

    const rowFor = (place: MapPlace, depth: number): Row => {
      const childCount = descendants(places, place.slug).length;
      const isCollapsed = collapsed.has(place.slug);
      return {
        place,
        depth,
        hasKids: kids(places, place.slug).length > 0,
        collapsed: isCollapsed,
        hiddenCount: isCollapsed ? childCount : 0,
        authored: place.hasLocalMap ? (place.radius ?? DEFAULT_PLACE_RADIUS_M) : 0,
        effective: effR.get(place.slug) ?? 0,
        vis: !place.isPublic ? 'hidden' : cascaded(places, place.slug) ? 'inherited' : 'public',
      };
    };

    // A filter is a different question from a collapsed branch: it flattens the
    // tree and answers "which places match", so indentation and collapse do not
    // apply to it.
    if (filter) {
      return places
        .filter((p) => p.name.toLowerCase().includes(filter))
        .map((p) => ({ ...rowFor(p, 0), hasKids: false, collapsed: false, hiddenCount: 0 }));
    }

    const bySlug = new Map(places.map((p) => [p.slug, p]));
    // A place whose parent names nothing is a root, not a lost row: it would
    // otherwise vanish from the table while still sitting on the map.
    const isRoot = (p: MapPlace) => !p.parent || !bySlug.has(p.parent);

    // Which places a walk from the roots can actually reach, ignoring collapse.
    // Anything it misses is in a cycle, and has to be shown as its own root or
    // it disappears entirely.
    const reachable = new Set<string>();
    const mark = (slug: string) => {
      for (const child of places) {
        if (child.parent !== slug || reachable.has(child.slug)) continue;
        reachable.add(child.slug);
        mark(child.slug);
      }
    };
    for (const p of places) {
      if (!isRoot(p)) continue;
      reachable.add(p.slug);
      mark(p.slug);
    }

    const out: Row[] = [];
    const seen = new Set<string>();
    const walk = (parent: string | null, depth: number) => {
      for (const place of places) {
        const belongs = parent === null ? isRoot(place) || !reachable.has(place.slug) : place.parent === parent;
        if (!belongs || seen.has(place.slug)) continue;
        seen.add(place.slug);
        out.push(rowFor(place, depth));
        // Collapse hides descendants from the table — and only from the table.
        if (!collapsed.has(place.slug)) walk(place.slug, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  });

  private map?: L.Map;
  private tiles?: L.TileLayer;
  private readonly markers = new Map<string, L.Marker>();
  private radiusCircle?: L.Circle;
  private floorCircle?: L.Circle;
  private radiusHandle?: L.Marker;
  private boundsRect?: L.Rectangle;
  private boundsHandles: L.Marker[] = [];
  private resizeObserver?: ResizeObserver;

  constructor() {
    // The map is imperative; these effects are the one-way bridge from signals
    // to Leaflet. Each is idempotent so any signal write can drive a redraw.
    effect(() => {
      const url = this.labels() ? TILE_LABELS : TILE_NOLABELS;
      this.tiles?.setUrl(url);
    });
    effect(() => {
      this.places();
      this.selected();
      this.syncMarkers();
      this.syncRadius();
    });
    effect(() => {
      this.mode();
      this.config();
      this.syncBounds();
    });
    effect(() => {
      const cfg = this.config();
      this.map?.setMinZoom(cfg.minZoom);
      this.map?.setMaxZoom(cfg.maxZoom);
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  ngAfterViewInit(): void {
    const el = this.mapEl()?.nativeElement;
    if (!el) return;

    const cfg = this.config();
    this.map = L.map(el, {
      center: [cfg.startLat, cfg.startLng],
      zoom: cfg.startZoom,
      minZoom: cfg.minZoom,
      maxZoom: cfg.maxZoom,
    });
    this.tiles = L.tileLayer(this.labels() ? TILE_LABELS : TILE_NOLABELS, {
      attribution: '© OpenStreetMap, © CARTO',
    }).addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => this.onMapClick(e));

    this.syncMarkers();
    this.syncRadius();
    this.syncBounds();

    // The map's floor is the tallest the side column has ever been — the
    // selection card's height depends on its contents, so this is measured
    // rather than guessed. Collapsing Configurazione must not shrink the map.
    const side = this.sideCol()?.nativeElement;
    if (side && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        const h = side.offsetHeight;
        if (h > this.mapMinHeight()) this.mapMinHeight.set(h);
        this.map?.invalidateSize();
      });
      this.resizeObserver.observe(side);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
  }

  // --- data ---

  protected reload(): void {
    const id = this.campaignId();
    if (!id) return;
    this.api.get(id).subscribe({
      next: (dto) => {
        this.config.set(dto.config ?? DEFAULT_CONFIG);
        this.places.set(dto.places ?? []);
        this.select(null);
      },
      error: () => this.toast.add({ severity: 'error', summary: 'Caricamento fallito' }),
    });
  }

  protected save(): void {
    const id = this.campaignId();
    if (!id) return;
    this.saving.set(true);
    const payload: CampaignMapDto = { config: this.config(), places: this.places() };
    this.api.replace(id, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.add({ severity: 'success', summary: 'Mappa salvata' });
      },
      error: () => {
        this.saving.set(false);
        this.toast.add({ severity: 'error', summary: 'Salvataggio fallito' });
      },
    });
  }

  // --- config ---

  protected patchConfig(patch: Partial<MapConfig>): void {
    this.config.set({ ...this.config(), ...patch });
  }

  protected patchBounds(patch: Partial<MapConfig['bounds']>): void {
    const cfg = this.config();
    this.config.set({ ...cfg, bounds: { ...cfg.bounds, ...patch } });
  }

  protected captureStartView(): void {
    if (!this.map) return;
    const c = this.map.getCenter();
    this.patchConfig({ startLat: c.lat, startLng: c.lng, startZoom: this.map.getZoom() });
  }

  protected captureBounds(): void {
    if (!this.map) return;
    const b = this.map.getBounds();
    this.patchBounds({
      south: b.getSouth(),
      west: b.getWest(),
      north: b.getNorth(),
      east: b.getEast(),
    });
  }

  // --- selection ---

  protected select(slug: string | null): void {
    this.selected.set(slug);
    const place = slug ? (this.places().find((p) => p.slug === slug) ?? null) : null;
    this.draft.set(place ? { ...place } : null);
    this.movingExisting.set(false);
  }

  protected typeLabel(type: PlaceType): string {
    return PLACE_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
  }

  protected visLabel(vis: Row['vis']): string {
    if (vis === 'public') return 'Pubblico';
    if (vis === 'hidden') return 'Nascosto';
    return 'Ereditato';
  }

  /**
   * Applies to both the draft (what the card shows) and the places array (what
   * the table and map show). The card reads the draft, not the array, so a
   * keystroke never re-renders the field being typed into.
   */
  protected patchPlace(patch: Partial<MapPlace>): void {
    const current = this.draft();
    if (!current) return;

    const next: MapPlace = { ...current, ...patch };
    // A pin has no interior, so it can hold neither a radius nor children.
    if (next.hasLocalMap === false) delete next.radius;
    this.draft.set(next);
    this.places.set(this.places().map((p) => (p.slug === next.slug ? next : p)));
  }

  protected startMove(): void {
    this.movingExisting.set(true);
    this.mode.set('placing');
  }

  protected toggleMode(target: Exclude<Mode, 'idle'>): void {
    // Placing and bounds-editing both own the map's click and drag surface, so
    // they cannot both be on.
    this.mode.set(this.mode() === target ? 'idle' : target);
    if (this.mode() !== 'placing') this.movingExisting.set(false);
  }

  protected toggleBranch(slug: string, event: Event): void {
    event.stopPropagation();
    const next = new Set(this.collapsedBranches());
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    this.collapsedBranches.set(next);
  }

  protected confirmDelete(slug: string): void {
    const subtree = descendants(this.places(), slug);
    const count = subtree.length;
    this.confirm.confirm({
      message: count
        ? `Eliminare questo luogo e i ${count} luoghi che contiene?`
        : 'Eliminare questo luogo?',
      accept: () => this.deletePlace(slug),
    });
  }

  private deletePlace(slug: string): void {
    // Cascade: a surviving child would point at a parent that is gone, which the
    // API rejects and the map cannot draw.
    const doomed = new Set([slug, ...descendants(this.places(), slug).map((p) => p.slug)]);
    this.places.set(this.places().filter((p) => !doomed.has(p.slug)));
    this.select(null);
  }

  // --- import / export ---

  protected doExport(): void {
    const blob = new Blob([exportPlaces(this.places())], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'campaign-map-places.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  protected doImport(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    file
      .text()
      .then((text) => {
        const parsed: unknown = JSON.parse(text);
        const result = mergePlaces(this.places(), parsed);
        this.places.set(result.places);
        this.toast.add({
          severity: 'success',
          summary: 'Import completato',
          detail: `${result.added} aggiunti · ${result.dup} già presenti · ${result.skipped} scartati · ${result.reparented} riagganciati`,
        });
      })
      .catch(() => this.toast.add({ severity: 'error', summary: 'File non valido' }))
      .finally(() => (input.value = ''));
  }

  // --- map ---

  private onMapClick(e: L.LeafletMouseEvent): void {
    if (this.mode() !== 'placing') return;

    if (this.movingExisting()) {
      this.patchPlace({ lat: e.latlng.lat, lng: e.latlng.lng });
      this.movingExisting.set(false);
      this.mode.set('idle');
      return;
    }
    this.addPlaceAt(e.latlng.lat, e.latlng.lng);
  }

  /** Exposed for the spec: clicking the map appends a place at the coordinates. */
  addPlaceAt(lat: number, lng: number): MapPlace {
    const taken = new Set(this.places().map((p) => p.slug));
    let slug = slugify(`luogo-${this.places().length + 1}`);
    let n = this.places().length + 1;
    while (taken.has(slug)) slug = slugify(`luogo-${++n}`);

    const place: MapPlace = {
      slug,
      name: 'Nuovo luogo',
      type: 'poi',
      lat,
      lng,
      hasLocalMap: false,
      isPublic: false,
      parent: null,
    };
    this.places.set([...this.places(), place]);
    this.mode.set('idle');
    this.select(slug);
    return place;
  }

  private markerClass(place: MapPlace): string {
    if (!place.isPublic) return 'cm-marker cm-marker-hidden';
    if (cascaded(this.places(), place.slug)) return 'cm-marker cm-marker-inherited';
    return 'cm-marker cm-marker-public';
  }

  /**
   * Diffed, never rebuilt: a rebuilt marker set drops the drag you are in the
   * middle of. Filtering hides markers; collapsing a branch does not — collapse
   * is a reading convenience for the table, the filter is what hides things.
   */
  private syncMarkers(): void {
    if (!this.map) return;
    const filter = this.nameFilter().trim().toLowerCase();
    const wanted = new Map(
      this.places()
        .filter((p) => !filter || p.name.toLowerCase().includes(filter))
        .map((p) => [p.slug, p]),
    );

    for (const [slug, marker] of this.markers) {
      if (wanted.has(slug)) continue;
      marker.remove();
      this.markers.delete(slug);
    }

    for (const [slug, place] of wanted) {
      const icon = L.divIcon({ className: this.markerClass(place), iconSize: [22, 22] });
      const existing = this.markers.get(slug);
      if (existing) {
        existing.setLatLng([place.lat, place.lng]);
        existing.setIcon(icon);
        continue;
      }
      const marker = L.marker([place.lat, place.lng], { draggable: true, icon })
        .addTo(this.map)
        .on('click', () => this.select(slug))
        .on('dragend', () => {
          const ll = marker.getLatLng();
          const target = this.places().find((p) => p.slug === slug);
          if (!target) return;
          const moved = { ...target, lat: ll.lat, lng: ll.lng };
          this.places.set(this.places().map((p) => (p.slug === slug ? moved : p)));
          if (this.selected() === slug) this.draft.set(moved);
        });
      this.markers.set(slug, marker);
    }
  }

  private clearRadius(): void {
    this.radiusCircle?.remove();
    this.floorCircle?.remove();
    this.radiusHandle?.remove();
    this.radiusCircle = undefined;
    this.floorCircle = undefined;
    this.radiusHandle = undefined;
  }

  private syncRadius(): void {
    if (!this.map) return;
    this.clearRadius();

    const place = this.selectedPlace();
    if (!place?.hasLocalMap) return;

    const centre = L.latLng(place.lat, place.lng);
    const effective = this.effR().get(place.slug) ?? 0;
    const floor = this.floors().get(place.slug) ?? 0;

    this.radiusCircle = L.circle(centre, {
      radius: effective,
      color: '#4caf50',
      weight: 2,
      fillOpacity: 0.05,
    }).addTo(this.map);

    // Drawn only when children actually impose one, so the author can see the
    // difference between "I chose this radius" and "my children forced it".
    if (floor > 0) {
      this.floorCircle = L.circle(centre, {
        radius: floor,
        color: '#ef6c00',
        weight: 1,
        dashArray: '4 4',
        fill: false,
      }).addTo(this.map);
    }

    const edge = this.destinationEast(centre, effective);
    this.radiusHandle = L.marker(edge, {
      draggable: true,
      icon: L.divIcon({ className: 'cm-handle', iconSize: [12, 12] }),
    })
      .addTo(this.map)
      .on('drag', (e) => {
        const ll = (e.target as L.Marker).getLatLng();
        const next = Math.max(1, centre.distanceTo(ll));
        this.radiusCircle?.setRadius(Math.max(next, floor));
      })
      .on('dragend', (e) => {
        const ll = (e.target as L.Marker).getLatLng();
        // Dragging inside the floor clamps: the children's circles have to stay
        // contained, so the radius cannot go below what they impose.
        const next = Math.max(Math.max(1, centre.distanceTo(ll)), floor);
        this.patchPlace({ radius: Math.round(next) });
      });
  }

  /** A point `metres` due east of `from` — where the radius handle sits. */
  private destinationEast(from: L.LatLng, metres: number): L.LatLng {
    const mPerDegLng = (Math.PI / 180) * 6_371_008.8 * Math.cos((from.lat * Math.PI) / 180);
    const dLng = mPerDegLng > 0 ? metres / mPerDegLng : 0;
    return L.latLng(from.lat, from.lng + dLng);
  }

  private clearBounds(): void {
    this.boundsRect?.remove();
    this.boundsRect = undefined;
    for (const h of this.boundsHandles) h.remove();
    this.boundsHandles = [];
  }

  private syncBounds(): void {
    if (!this.map) return;
    this.clearBounds();
    if (this.mode() !== 'bounds') return;

    const b = this.config().bounds;
    const rect = L.latLngBounds([b.south, b.west], [b.north, b.east]);

    this.boundsRect = L.rectangle(rect, {
      color: '#2196f3',
      weight: 2,
      fillOpacity: 0.05,
      // Dragging the interior moves the whole box without reshaping it.
      interactive: true,
    }).addTo(this.map);

    let dragFrom: L.LatLng | null = null;
    this.boundsRect.on('mousedown', (e: L.LeafletMouseEvent) => {
      dragFrom = e.latlng;
      this.map?.dragging.disable();
    });
    this.map.on('mousemove', (e: L.LeafletMouseEvent) => {
      if (!dragFrom) return;
      const dLat = e.latlng.lat - dragFrom.lat;
      const dLng = e.latlng.lng - dragFrom.lng;
      dragFrom = e.latlng;
      const cur = this.config().bounds;
      this.patchBounds({
        south: cur.south + dLat,
        north: cur.north + dLat,
        west: cur.west + dLng,
        east: cur.east + dLng,
      });
    });
    this.map.on('mouseup', () => {
      dragFrom = null;
      this.map?.dragging.enable();
    });

    const corners: [L.LatLngExpression, (ll: L.LatLng) => void][] = [
      [[b.south, b.west], (ll) => this.patchBounds({ south: ll.lat, west: ll.lng })],
      [[b.south, b.east], (ll) => this.patchBounds({ south: ll.lat, east: ll.lng })],
      [[b.north, b.west], (ll) => this.patchBounds({ north: ll.lat, west: ll.lng })],
      [[b.north, b.east], (ll) => this.patchBounds({ north: ll.lat, east: ll.lng })],
    ];

    for (const [pos, apply] of corners) {
      const handle = L.marker(pos, {
        draggable: true,
        icon: L.divIcon({ className: 'cm-handle', iconSize: [12, 12] }),
      })
        .addTo(this.map)
        .on('dragend', (e) => apply((e.target as L.Marker).getLatLng()));
      this.boundsHandles.push(handle);
    }
  }
}
