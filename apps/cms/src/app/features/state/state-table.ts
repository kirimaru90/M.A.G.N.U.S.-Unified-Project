import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { valueSchemaFor, coerceForType } from '../../core/state/state.schemas';
import type { MutationAtom, StateEntryDto, StateScope } from '../../core/state/state.types';

interface RowState {
  editing: boolean;
  error: string | null;
}

interface EditMeta {
  key: string;
  type: string;
  defVal: string;
  enumVals: string;
}

@Component({
  selector: 'app-state-table',
  standalone: true,
  imports: [
    FormsModule,
    TableModule,
    ButtonModule,
    CheckboxModule,
    InputNumberModule,
    SelectModule,
    InputTextModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (entries.length === 0 && !addRowVisible()) {
      <p style="color: var(--bo-text-faint); margin: 0;">{{ emptyMessage }}</p>
    }

    @if (entries.length > 0 || addRowVisible()) {
      <p-table [value]="entries" [tableStyle]="{ 'min-width': '500px' }" styleClass="bo-table">
        <ng-template pTemplate="header">
          <tr>
            <th>Variabile</th>
            <th>Tipo</th>
            <th>Default</th>
            <th>Valore attuale</th>
            <th>Azioni</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-entry>
          @if (rowState(entry.key)?.editing) {
            <tr>
              <td>
                @if (editable === 'full') {
                  <input pInputText [(ngModel)]="editMeta[entry.key].key" style="width: 100%;" />
                } @else {
                  <span style="font-family: monospace;">{{ entry.key }}</span>
                }
              </td>
              <td>
                @if (editable === 'full') {
                  <select class="bo-select" [(ngModel)]="editMeta[entry.key].type" (change)="onTypeChange(entry.key)" style="width: 100%;">
                    <option value="boolean">boolean</option>
                    <option value="number">number</option>
                    <option value="string">string</option>
                    <option value="enum">enum</option>
                  </select>
                } @else {
                  {{ entry.type }}
                }
              </td>
              <td>
                @if (editable === 'full') {
                  @if (editMeta[entry.key].type === 'boolean') {
                    <select class="bo-select" [(ngModel)]="editMeta[entry.key].defVal" style="width: 100%;">
                      <option value="false">false</option>
                      <option value="true">true</option>
                    </select>
                  } @else if (editMeta[entry.key].type === 'enum') {
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                      <input pInputText [(ngModel)]="editMeta[entry.key].enumVals" placeholder="val1,val2,..." style="width: 100%;" />
                      <select class="bo-select" [(ngModel)]="editMeta[entry.key].defVal" style="width: 100%;">
                        @for (v of getEnumValues(entry.key); track v) {
                          <option [value]="v">{{ v }}</option>
                        }
                      </select>
                    </div>
                  } @else {
                    <input pInputText [(ngModel)]="editMeta[entry.key].defVal" style="width: 100%;" />
                  }
                } @else {
                  <span style="font-family: monospace;">{{ formatValue(entry.default) }}</span>
                }
              </td>
              <td>
                @if (getDraftType(entry) === 'boolean') {
                  <p-checkbox [(ngModel)]="editValues[entry.key]" [binary]="true" />
                } @else if (getDraftType(entry) === 'number') {
                  <p-inputnumber [(ngModel)]="editValues[entry.key]" [useGrouping]="false" styleClass="w-full" />
                } @else if (getDraftType(entry) === 'enum') {
                  <p-select [(ngModel)]="editValues[entry.key]" [options]="getEnumValues(entry.key)" styleClass="w-full" />
                } @else {
                  <input pInputText [(ngModel)]="editValues[entry.key]" style="width: 100%;" />
                }
              </td>
              <td>
                <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                  @if (rowState(entry.key)?.error) {
                    <small style="color: var(--p-red-500, #ef4444);">{{ rowState(entry.key)!.error }}</small>
                  }
                  <div style="display: flex; gap: 4px;">
                    <button type="button" class="bo-btn primary" style="font-size: 12px; padding: 4px 10px; height: auto;" (click)="submitEdit(entry)">
                      Salva
                    </button>
                    <button type="button" class="bo-btn ghost" style="font-size: 12px; padding: 4px 10px; height: auto;" (click)="cancelEdit(entry.key)">
                      Annulla
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          } @else {
            <tr>
              <td style="font-family: monospace;">{{ entry.key }}</td>
              <td>{{ entry.type }}</td>
              <td style="font-family: monospace;">{{ formatValue(entry.default) }}</td>
              <td><span style="font-family: monospace;">{{ formatValue(entry.current) }}</span></td>
              <td>
                <div class="row-actions">
                  <button
                    type="button"
                    class="bo-btn ghost icon"
                    title="Modifica"
                    (click)="startEdit(entry)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="bo-btn ghost icon danger"
                    title="Reset variabile"
                    (click)="resetVar.emit(entry)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <polyline points="1 4 1 10 7 10"/>
                      <path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
                    </svg>
                  </button>
                  @if (allowSchemaDelete) {
                    <button
                      type="button"
                      class="bo-btn ghost icon danger"
                      title="Elimina variabile"
                      (click)="deleteVar.emit(entry)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6"/>
                        <path d="M14 11v6"/>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                    </button>
                  }
                </div>
              </td>
            </tr>
          }
        </ng-template>
        <ng-template pTemplate="footer">
          @if (addRowVisible()) {
            <tr>
              <td>
                <input pInputText [(ngModel)]="newRowMeta.key" placeholder="nome variabile" style="width: 100%;" />
              </td>
              <td>
                <select class="bo-select" [(ngModel)]="newRowMeta.type" (change)="onNewRowTypeChange()" style="width: 100%;">
                  <option value="boolean">boolean</option>
                  <option value="number">number</option>
                  <option value="string">string</option>
                  <option value="enum">enum</option>
                </select>
              </td>
              <td>
                @if (newRowMeta.type === 'boolean') {
                  <select class="bo-select" [(ngModel)]="newRowMeta.defVal" style="width: 100%;">
                    <option value="false">false</option>
                    <option value="true">true</option>
                  </select>
                } @else if (newRowMeta.type === 'enum') {
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    <input pInputText [(ngModel)]="newRowMeta.enumVals" placeholder="val1,val2,..." style="width: 100%;" />
                    <select class="bo-select" [(ngModel)]="newRowMeta.defVal" style="width: 100%;">
                      @for (v of getNewRowEnumValues(); track v) {
                        <option [value]="v">{{ v }}</option>
                      }
                    </select>
                  </div>
                } @else {
                  <input pInputText [(ngModel)]="newRowMeta.defVal" style="width: 100%;" />
                }
              </td>
              <td>
                <span style="color: var(--bo-text-faint); font-size: 12px;">(= default)</span>
              </td>
              <td>
                <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                  @if (newRowError()) {
                    <small style="color: var(--p-red-500, #ef4444);">{{ newRowError() }}</small>
                  }
                  <div style="display: flex; gap: 4px;">
                    <button type="button" class="bo-btn primary" style="font-size: 12px; padding: 4px 10px; height: auto;" (click)="submitNewRow()">
                      Salva
                    </button>
                    <button type="button" class="bo-btn ghost" style="font-size: 12px; padding: 4px 10px; height: auto;" (click)="cancelNewRow()">
                      Annulla
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          }
        </ng-template>
      </p-table>
    }

    @if (allowSchemaAdd && !addRowVisible()) {
      <button type="button" class="bo-btn ghost" style="margin-top: 8px; font-size: 13px;" (click)="showAddRow()">
        + Aggiungi
      </button>
    }
  `,
})
export class StateTableComponent implements OnChanges {
  @Input({ required: true }) entries: StateEntryDto[] = [];
  @Input({ required: true }) scope!: StateScope;
  @Input() emptyMessage = 'Nessuna variabile dichiarata';
  @Input() editable: 'full' | 'value-only' = 'full';
  @Input() allowSchemaAdd = false;
  @Input() allowSchemaDelete = false;

  @Output() readonly mutate = new EventEmitter<MutationAtom>();
  @Output() readonly resetVar = new EventEmitter<StateEntryDto>();
  @Output() readonly schemaChange = new EventEmitter<{ old: StateEntryDto; entry: StateEntryDto }>();
  @Output() readonly addVar = new EventEmitter<StateEntryDto>();
  @Output() readonly deleteVar = new EventEmitter<StateEntryDto>();

  protected readonly rowStates = signal<Record<string, RowState>>({});
  protected editValues: Record<string, unknown> = {};
  protected editMeta: Record<string, EditMeta> = {};

  protected readonly addRowVisible = signal(false);
  protected newRowMeta: EditMeta = { key: '', type: 'string', defVal: '', enumVals: '' };
  protected readonly newRowError = signal<string | null>(null);

  ngOnChanges(): void {
    const current = this.rowStates();
    const next: Record<string, RowState> = {};
    const validKeys = new Set(this.entries.map((e) => e.key));
    for (const key of Object.keys(this.editValues)) {
      if (!validKeys.has(key)) {
        delete this.editValues[key];
        delete this.editMeta[key];
      }
    }
    for (const entry of this.entries) {
      next[entry.key] = current[entry.key] ?? { editing: false, error: null };
    }
    this.rowStates.set(next);
  }

  protected rowState(key: string): RowState | undefined {
    return this.rowStates()[key];
  }

  protected formatValue(value: unknown): string {
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
  }

  protected getDraftType(entry: StateEntryDto): string {
    return this.editMeta[entry.key]?.type ?? entry.type;
  }

  protected getEnumValues(key: string): string[] {
    const vals = this.editMeta[key]?.enumVals ?? '';
    return vals.split(',').map((s) => s.trim()).filter(Boolean);
  }

  protected onTypeChange(key: string): void {
    const meta = this.editMeta[key];
    if (!meta) return;
    if (meta.type === 'boolean') {
      meta.defVal = 'false';
      this.editValues[key] = false;
    } else if (meta.type === 'number') {
      meta.defVal = '0';
      this.editValues[key] = 0;
    } else if (meta.type === 'enum') {
      meta.defVal = '';
      this.editValues[key] = '';
    } else {
      meta.defVal = '';
      this.editValues[key] = '';
    }
  }

  protected startEdit(entry: StateEntryDto): void {
    this.editValues[entry.key] = entry.current;
    this.editMeta[entry.key] = {
      key: entry.key,
      type: entry.type,
      defVal: this.formatValue(entry.default),
      enumVals: Array.isArray(entry.values) ? entry.values.join(',') : '',
    };
    const states = { ...this.rowStates() };
    states[entry.key] = { editing: true, error: null };
    this.rowStates.set(states);
  }

  protected cancelEdit(key: string): void {
    delete this.editMeta[key];
    delete this.editValues[key];
    const states = { ...this.rowStates() };
    states[key] = { editing: false, error: null };
    this.rowStates.set(states);
  }

  protected submitEdit(entry: StateEntryDto): void {
    const meta = this.editMeta[entry.key];
    if (!meta) return;

    const draftType = meta.type as StateEntryDto['type'];
    const enumValues =
      draftType === 'enum' ? meta.enumVals.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

    let parsedDefault: boolean | number | string;
    if (draftType === 'boolean') parsedDefault = meta.defVal === 'true';
    else if (draftType === 'number') parsedDefault = Number(meta.defVal) || 0;
    else parsedDefault = meta.defVal;

    const newEntry: StateEntryDto = {
      key: meta.key,
      type: draftType,
      default: parsedDefault,
      ...(enumValues ? { values: enumValues } : {}),
      current: this.editValues[entry.key] as boolean | number | string,
    };

    const coerced = coerceForType(newEntry, this.editValues[entry.key]);
    const schema = valueSchemaFor(newEntry);
    const result = schema.safeParse(coerced);
    if (!result.success) {
      const states = { ...this.rowStates() };
      states[entry.key] = { ...states[entry.key], error: result.error.issues[0]?.message ?? 'Valore non valido' };
      this.rowStates.set(states);
      return;
    }

    newEntry.current = result.data as boolean | number | string;

    const states = { ...this.rowStates() };
    states[entry.key] = { editing: false, error: null };
    this.rowStates.set(states);

    const schemaChanged =
      this.editable === 'full' &&
      (meta.key !== entry.key ||
        meta.type !== entry.type ||
        meta.defVal !== this.formatValue(entry.default) ||
        (entry.type === 'enum' && meta.enumVals !== (entry.values ?? []).join(',')));

    if (schemaChanged) {
      this.schemaChange.emit({ old: entry, entry: newEntry });
    } else {
      this.mutate.emit({ key: `${this.scope}.${meta.key}`, op: 'set', value: result.data });
    }
  }

  protected showAddRow(): void {
    this.newRowMeta = { key: '', type: 'string', defVal: '', enumVals: '' };
    this.newRowError.set(null);
    this.addRowVisible.set(true);
  }

  protected cancelNewRow(): void {
    this.addRowVisible.set(false);
    this.newRowError.set(null);
  }

  protected onNewRowTypeChange(): void {
    if (this.newRowMeta.type === 'boolean') {
      this.newRowMeta.defVal = 'false';
    } else if (this.newRowMeta.type === 'number') {
      this.newRowMeta.defVal = '0';
    } else {
      this.newRowMeta.defVal = '';
    }
    this.newRowMeta.enumVals = '';
  }

  protected getNewRowEnumValues(): string[] {
    return this.newRowMeta.enumVals.split(',').map((s) => s.trim()).filter(Boolean);
  }

  protected submitNewRow(): void {
    const meta = this.newRowMeta;
    if (!meta.key.trim()) {
      this.newRowError.set('Il nome è obbligatorio');
      return;
    }
    if (this.entries.some((e) => e.key === meta.key.trim())) {
      this.newRowError.set('Variabile già esistente');
      return;
    }

    const draftType = meta.type as StateEntryDto['type'];
    const enumValues =
      draftType === 'enum' ? meta.enumVals.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

    let parsedDefault: boolean | number | string;
    if (draftType === 'boolean') parsedDefault = meta.defVal === 'true';
    else if (draftType === 'number') parsedDefault = Number(meta.defVal) || 0;
    else parsedDefault = meta.defVal;

    const newEntry: StateEntryDto = {
      key: meta.key.trim(),
      type: draftType,
      default: parsedDefault,
      current: parsedDefault,
      ...(enumValues ? { values: enumValues } : {}),
    };

    this.addRowVisible.set(false);
    this.newRowError.set(null);
    this.addVar.emit(newEntry);
  }
}
