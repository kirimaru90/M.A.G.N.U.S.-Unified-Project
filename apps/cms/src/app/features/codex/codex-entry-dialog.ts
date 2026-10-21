import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { MultiSelect } from 'primeng/multiselect';
import { Select } from 'primeng/select';
import { DialogActionsComponent } from '../../shared/dialog-actions/dialog-actions';
import { CodexApiService } from '../../core/codex/codex-api.service';
import {
  CODEX_TYPES,
  CODEX_TYPE_LABELS,
  type CodexCharacterOption,
  type CodexEntry,
  type CodexPlaceOption,
  type CodexType,
  type CreateCodexEntryBody,
  type UpdateCodexEntryBody,
} from '../../core/codex/codex.types';
import { PLACE_TYPE_OPTIONS } from '../../core/campaign-map/campaign-map.types';

/** The form's editable state, compared field by field to build a PATCH. */
export interface CodexDraft {
  type: CodexType | null;
  name: string;
  imageUrl: string;
  description: string;
  secretDescription: string;
  isPublic: boolean;
  visibleToCharacterIds: string[];
  isEditable: boolean;
  mapPlaceSlug: string | null;
}

export function draftOf(entry: CodexEntry | null): CodexDraft {
  return {
    type: entry?.type ?? null,
    name: entry?.name ?? '',
    imageUrl: entry?.imageUrl ?? '',
    description: entry?.description ?? '',
    secretDescription: entry?.secretDescription ?? '',
    isPublic: entry?.isPublic ?? false,
    visibleToCharacterIds: entry?.visibleToCharacterIds ?? [],
    isEditable: entry?.isEditable ?? false,
    mapPlaceSlug: entry?.mapPlaceSlug ?? null,
  };
}

/** The create body: blanks omitted, name and URL trimmed. */
export function createBody(d: CodexDraft): CreateCodexEntryBody {
  const imageUrl = d.imageUrl.trim();
  return {
    type: d.type!,
    name: d.name.trim(),
    ...(imageUrl ? { imageUrl } : {}),
    ...(d.description.trim() ? { description: d.description } : {}),
    ...(d.secretDescription.trim() ? { secretDescription: d.secretDescription } : {}),
    isPublic: d.isPublic,
    visibleToCharacterIds: d.visibleToCharacterIds,
    isEditable: d.isEditable,
    ...(d.mapPlaceSlug ? { mapPlaceSlug: d.mapPlaceSlug } : {}),
  };
}

/** Only the fields that changed; a cleared URL or place is sent as `null`. */
export function patchBody(before: CodexDraft, after: CodexDraft): UpdateCodexEntryBody {
  const out: Record<string, unknown> = {};
  if (after.type !== before.type) out['type'] = after.type;
  if (after.name.trim() !== before.name) out['name'] = after.name.trim();
  const url = after.imageUrl.trim();
  if (url !== before.imageUrl) out['imageUrl'] = url || null;
  if (after.description !== before.description) out['description'] = after.description;
  if (after.secretDescription !== before.secretDescription)
    out['secretDescription'] = after.secretDescription;
  if (after.isPublic !== before.isPublic) out['isPublic'] = after.isPublic;
  const ids = [...after.visibleToCharacterIds].sort().join();
  if (ids !== [...before.visibleToCharacterIds].sort().join())
    out['visibleToCharacterIds'] = after.visibleToCharacterIds;
  if (after.isEditable !== before.isEditable) out['isEditable'] = after.isEditable;
  if (after.mapPlaceSlug !== before.mapPlaceSlug) out['mapPlaceSlug'] = after.mapPlaceSlug;
  return out as UpdateCodexEntryBody;
}

const PLACE_TYPE_LABEL = new Map(PLACE_TYPE_OPTIONS.map((o) => [o.value, o.label]));

/** Creates or edits one codex entry, master fields included. */
@Component({
  selector: 'app-codex-entry-dialog',
  standalone: true,
  imports: [Dialog, FormsModule, Checkbox, MultiSelect, Select, DialogActionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible"
      (visibleChange)="closed.emit()"
      [header]="entry ? 'Modifica voce' : 'Nuova voce'"
      [modal]="true"
      [style]="{ width: '560px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <form (ngSubmit)="onSubmit()">
        <div class="bo-field">
          <label class="bo-label" for="cx-type">Tipo</label>
          <select
            id="cx-type"
            name="type"
            class="bo-select w-full"
            data-testid="codex-type"
            [ngModel]="draft().type ?? ''"
            (ngModelChange)="patch({ type: $event || null })"
          >
            <option value="" disabled>Seleziona tipo</option>
            @for (t of types; track t) {
              <option [value]="t">{{ typeLabels[t] }}</option>
            }
          </select>
        </div>

        <div class="bo-field">
          <label class="bo-label" for="cx-name">Nome</label>
          <input
            id="cx-name"
            name="name"
            class="bo-input w-full"
            data-testid="codex-name"
            [ngModel]="draft().name"
            (ngModelChange)="patch({ name: $event })"
          />
        </div>

        <div class="bo-field">
          <label class="bo-label" for="cx-image">Immagine (URL)</label>
          <input
            id="cx-image"
            name="imageUrl"
            type="url"
            class="bo-input w-full"
            data-testid="codex-image"
            placeholder="https://…"
            [ngModel]="draft().imageUrl"
            (ngModelChange)="patch({ imageUrl: $event }); imageBroken.set(false)"
          />
          @if (draft().imageUrl.trim() && !imageBroken()) {
            <img
              data-testid="codex-image-preview"
              [src]="draft().imageUrl.trim()"
              alt=""
              referrerpolicy="no-referrer"
              style="display: block; margin-top: 8px; max-width: 100%; max-height: 200px; object-fit: contain;"
              (error)="imageBroken.set(true)"
            />
          }
        </div>

        <div class="bo-field">
          <label class="bo-label" for="cx-desc">Descrizione</label>
          <textarea
            id="cx-desc"
            name="description"
            rows="4"
            class="bo-input w-full"
            style="resize: vertical;"
            data-testid="codex-description"
            [ngModel]="draft().description"
            (ngModelChange)="patch({ description: $event })"
          ></textarea>
        </div>

        <div class="bo-field">
          <label class="bo-label" for="cx-secret"
            >Descrizione segreta (visibile solo al master)</label
          >
          <textarea
            id="cx-secret"
            name="secretDescription"
            rows="3"
            class="bo-input w-full"
            style="resize: vertical;"
            data-testid="codex-secret"
            [ngModel]="draft().secretDescription"
            (ngModelChange)="patch({ secretDescription: $event })"
          ></textarea>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
          <p-checkbox
            [binary]="true"
            inputId="cx-public"
            name="isPublic"
            [ngModel]="draft().isPublic"
            (ngModelChange)="patch({ isPublic: $event })"
          />
          <label class="bo-label" for="cx-public">Pubblica</label>
        </div>

        <div class="bo-field">
          <label class="bo-label" for="cx-visible">Visibile a</label>
          <p-multiselect
            inputId="cx-visible"
            name="visibleToCharacterIds"
            [options]="characterOptions()"
            optionLabel="label"
            optionValue="id"
            placeholder="Nessun personaggio"
            [showToggleAll]="false"
            styleClass="w-full"
            appendTo="body"
            [ngModel]="draft().visibleToCharacterIds"
            (ngModelChange)="patch({ visibleToCharacterIds: $event ?? [] })"
          />
        </div>

        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
          <p-checkbox
            [binary]="true"
            inputId="cx-editable"
            name="isEditable"
            [ngModel]="draft().isEditable"
            (ngModelChange)="patch({ isEditable: $event })"
          />
          <label class="bo-label" for="cx-editable">Modificabile dai giocatori</label>
        </div>

        <div class="bo-field" data-testid="codex-place-field">
          <label class="bo-label" for="cx-place">Luogo sulla mappa</label>
          <p-select
            inputId="cx-place"
            name="mapPlaceSlug"
            [options]="placeOptions()"
            optionLabel="label"
            optionValue="value"
            placeholder="Nessuno"
            [filter]="true"
            filterBy="label"
            [showClear]="true"
            styleClass="w-full"
            appendTo="body"
            [ngModel]="draft().mapPlaceSlug"
            (ngModelChange)="patch({ mapPlaceSlug: $event ?? null })"
          />
        </div>

        <app-dialog-actions
          [error]="apiError()"
          [saving]="saving()"
          [disabled]="!canSubmit()"
          [submitLabel]="entry ? 'Salva' : 'Crea'"
          [savingLabel]="entry ? 'Salvataggio…' : 'Creazione…'"
          (cancelled)="closed.emit()"
        />
      </form>
    </p-dialog>
  `,
})
export class CodexEntryDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() campaignId = '';
  /** The entry to edit, or `null` to create one. */
  @Input() entry: CodexEntry | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<CodexEntry>();

  private readonly api = inject(CodexApiService);

  protected readonly types = CODEX_TYPES;
  protected readonly typeLabels = CODEX_TYPE_LABELS;

  private initial = draftOf(null);
  protected readonly draft = signal<CodexDraft>(draftOf(null));
  protected readonly characters = signal<CodexCharacterOption[]>([]);
  protected readonly places = signal<CodexPlaceOption[] | null>(null);
  protected readonly imageBroken = signal(false);

  protected readonly saving = signal(false);
  protected readonly apiError = signal<string | null>(null);

  protected readonly canSubmit = computed(
    () => this.draft().name.trim().length > 0 && this.draft().type !== null,
  );

  /** Live characters, plus already-listed ones that are deleted, marked so. */
  protected readonly characterOptions = computed(() => {
    const live = this.characters().map((c) => ({ id: c.id, label: c.name }));
    const liveIds = new Set(live.map((c) => c.id));
    const refs = new Map((this.entry?.characters ?? []).map((c) => [c.id, c]));
    const gone = this.draft()
      .visibleToCharacterIds.filter((id) => !liveIds.has(id))
      .map((id) => ({ id, label: `${refs.get(id)?.name || '?'} (eliminato)` }));
    return [...live, ...gone];
  });

  /** Every place by name and type; a stored slug matching none is kept, flagged. */
  protected readonly placeOptions = computed(() => {
    const places = this.places() ?? [];
    const options = places.map((p) => ({
      value: p.slug,
      label: `${p.name} · ${PLACE_TYPE_LABEL.get(p.type) ?? p.type}`,
    }));
    const slug = this.draft().mapPlaceSlug;
    if (slug && this.places() !== null && !places.some((p) => p.slug === slug))
      options.unshift({ value: slug, label: `Luogo non trovato (${slug})` });
    return options;
  });

  ngOnChanges(): void {
    if (!this.visible) return;
    this.initial = draftOf(this.entry);
    this.draft.set(this.initial);
    this.imageBroken.set(false);
    this.apiError.set(null);
    this.places.set(null);
    if (!this.campaignId) return;
    this.api.campaignCharacters(this.campaignId).subscribe({
      next: (list) => this.characters.set(list),
    });
    this.api.campaignPlaces(this.campaignId).subscribe({
      next: (list) => this.places.set(list),
      error: () => this.places.set([]),
    });
  }

  protected patch(change: Partial<CodexDraft>): void {
    this.draft.update((d) => ({ ...d, ...change }));
  }

  onSubmit(): void {
    if (!this.canSubmit() || this.saving()) return;
    this.apiError.set(null);
    const request = this.entry
      ? this.api.update(this.campaignId, this.entry.id, patchBody(this.initial, this.draft()))
      : this.api.create(this.campaignId, createBody(this.draft()));

    this.saving.set(true);
    request.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.saved.emit(saved);
      },
      error: () => {
        this.saving.set(false);
        this.apiError.set('Errore durante il salvataggio della voce.');
      },
    });
  }
}
