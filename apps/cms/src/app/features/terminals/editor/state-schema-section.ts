import { ChangeDetectionStrategy, Component, Input, signal } from '@angular/core';
import { FormArray, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { emptyStateVarGroup, makeStateVarGroup } from './terminal-form';
import type { StateEntryShape } from '../../../core/state/state.types';

@Component({
  selector: 'app-state-schema-section',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, AutoCompleteModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bo-card section">
      <h3 class="bo-card-section-title">Schema di stato</h3>

      <!-- Local variables -->
      <div class="scope-block">
        <h4 class="scope-label">Variabili Locali</h4>
        @if (localVars.controls.length > 0) {
          <table class="bo-table" style="margin-bottom: 8px;">
            <thead>
              <tr>
                <th>Variabile</th>
                <th>Tipo</th>
                <th>Default</th>
                <th style="width: 40px;"></th>
              </tr>
            </thead>
            <tbody>
              @for (row of localVars.controls; track row; let i = $index) {
                <tr [formGroup]="asGroup(row)">
                  <td><input formControlName="name" placeholder="nome" class="bo-input sm" /></td>
                  <td>
                    <select formControlName="type" class="bo-select sm">
                      <option value="boolean">boolean</option>
                      <option value="number">number</option>
                      <option value="string">string</option>
                      <option value="enum">enum</option>
                    </select>
                  </td>
                  <td>
                    @if (asGroup(row).get('type')?.value === 'boolean') {
                      <select formControlName="default" class="bo-select sm">
                        <option value="false">false</option>
                        <option value="true">true</option>
                      </select>
                    } @else if (asGroup(row).get('type')?.value === 'enum') {
                      <div style="display: flex; flex-direction: column; gap: 4px;">
                        <input formControlName="values" placeholder="val1,val2,..." class="bo-input sm" />
                        <select formControlName="default" class="bo-select sm">
                          @for (v of enumValues(asGroup(row)); track v) {
                            <option [value]="v">{{ v }}</option>
                          }
                        </select>
                      </div>
                    } @else {
                      <input formControlName="default" placeholder="default" class="bo-input sm" />
                    }
                  </td>
                  <td>
                    <div class="row-actions">
                      <button type="button" class="bo-btn ghost icon danger" title="Rimuovi" (click)="removeVar(localVars, i)">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
        @if (localVars.errors?.['duplicateNames']) {
          <span class="field-error">I nomi delle variabili locali devono essere unici</span>
        }
        <button type="button" class="bo-btn ghost sm" (click)="addVar(localVars)">+ Aggiungi variabile locale</button>
      </div>

      <!-- Global variables -->
      <div class="scope-block">
        <h4 class="scope-label">Variabili Globali</h4>

        @if (campaignGlobalSchema) {
          <!-- Picker mode: global vars are owned by the campaign, displayed read-only -->
          @if (globalVars.controls.length > 0) {
            <table class="bo-table" style="margin-bottom: 8px;">
              <thead>
                <tr>
                  <th>Variabile</th>
                  <th>Tipo</th>
                  <th>Default</th>
                  <th style="width: 40px;"></th>
                </tr>
              </thead>
              <tbody>
                @for (row of globalVars.controls; track row; let i = $index) {
                  @let name = asGroup(row).get('name')!.value;
                  @let decl = campaignGlobalSchema![name];
                  <tr>
                    <td style="font-family: monospace; font-weight: 600;">{{ name }}</td>
                    <td>
                      @if (decl) {
                        <span class="var-badge">{{ decl.type }}</span>
                      } @else {
                        <span class="var-badge unknown">non definita</span>
                      }
                    </td>
                    <td style="font-family: monospace; font-size: 12px;">
                      @if (decl) {
                        {{ decl.default }}
                        @if (decl.values?.length) {
                          <span style="color: var(--bo-text-faint); font-size: 11px; margin-left: 4px;">[{{ decl.values!.join(', ') }}]</span>
                        }
                      }
                    </td>
                    <td>
                      <div class="row-actions">
                        <button type="button" class="bo-btn ghost icon danger" title="Rimuovi riferimento" (click)="removeVar(globalVars, i)">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }

          @if (availableGlobalNames().length > 0) {
            @if (!pickerVisible()) {
              <button type="button" class="bo-btn ghost sm" style="margin-top: 4px;" (click)="openPicker()">
                + Aggiungi variabile globale
              </button>
            } @else {
              <div style="display: flex; gap: 8px; align-items: center; margin-top: 4px;">
                <p-autocomplete
                  [(ngModel)]="pickerQuery"
                  [suggestions]="filteredNames"
                  (completeMethod)="filterNames($event)"
                  (onSelect)="onGlobalSelect($event)"
                  [forceSelection]="true"
                  placeholder="Cerca variabile globale..."
                  styleClass="w-full"
                />
                <button type="button" class="bo-btn ghost sm" (click)="closePicker()">Annulla</button>
              </div>
            }
          } @else if (globalVars.length === 0) {
            <p class="empty-note">Nessuna variabile globale disponibile nella campagna.</p>
          }
        } @else {
          <!-- Fallback full-editor mode (no campaign context) -->
          @if (globalVars.controls.length > 0) {
            <table class="bo-table" style="margin-bottom: 8px;">
              <thead>
                <tr>
                  <th>Variabile</th>
                  <th>Tipo</th>
                  <th>Default</th>
                  <th style="width: 40px;"></th>
                </tr>
              </thead>
              <tbody>
                @for (row of globalVars.controls; track row; let i = $index) {
                  <tr [formGroup]="asGroup(row)">
                    <td><input formControlName="name" placeholder="nome" class="bo-input sm" /></td>
                    <td>
                      <select formControlName="type" class="bo-select sm">
                        <option value="boolean">boolean</option>
                        <option value="number">number</option>
                        <option value="string">string</option>
                        <option value="enum">enum</option>
                      </select>
                    </td>
                    <td>
                      @if (asGroup(row).get('type')?.value === 'boolean') {
                        <select formControlName="default" class="bo-select sm">
                          <option value="false">false</option>
                          <option value="true">true</option>
                        </select>
                      } @else if (asGroup(row).get('type')?.value === 'enum') {
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                          <input formControlName="values" placeholder="val1,val2,..." class="bo-input sm" />
                          <select formControlName="default" class="bo-select sm">
                            @for (v of enumValues(asGroup(row)); track v) {
                              <option [value]="v">{{ v }}</option>
                            }
                          </select>
                        </div>
                      } @else {
                        <input formControlName="default" placeholder="default" class="bo-input sm" />
                      }
                    </td>
                    <td>
                      <div class="row-actions">
                        <button type="button" class="bo-btn ghost icon danger" title="Rimuovi" (click)="removeVar(globalVars, i)">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
          @if (globalVars.errors?.['duplicateNames']) {
            <span class="field-error">I nomi delle variabili globali devono essere unici</span>
          }
          <button type="button" class="bo-btn ghost sm" (click)="addVar(globalVars)">+ Aggiungi variabile globale</button>
        }
      </div>
    </div>
  `,
  styles: [`
    .section { margin-bottom: 16px; }
    .scope-block { margin-bottom: 16px; }
    .scope-label { font-size: 13px; font-weight: 600; margin: 0 0 8px; }
    .var-badge { font-size: 11px; background: var(--bo-panel-2); color: var(--bo-text-muted); border: 1px solid var(--bo-border); border-radius: 4px; padding: 2px 6px; }
    .var-badge.unknown { background: var(--bo-warn-soft); color: var(--bo-warn); }
    .empty-note { font-size: 13px; color: var(--bo-text-faint); margin: 4px 0; }
    .bo-input.sm, .bo-select.sm { padding: 4px 8px; font-size: 13px; }
    .bo-btn.sm { padding: 4px 10px; font-size: 13px; }
    .danger { color: var(--bo-danger, #c0392b); }
    .field-error { font-size: 12px; color: var(--bo-danger, #c0392b); display: block; margin-bottom: 4px; }
  `],
})
export class StateSchemaSectionComponent {
  @Input({ required: true }) localVars!: FormArray<FormGroup>;
  @Input({ required: true }) globalVars!: FormArray<FormGroup>;
  /** When provided, global vars section switches to picker mode — vars are owned by the campaign. */
  @Input() campaignGlobalSchema?: Record<string, StateEntryShape> | null;

  protected readonly pickerVisible = signal(false);
  protected pickerQuery = '';
  protected filteredNames: string[] = [];

  addVar(arr: FormArray<FormGroup>): void {
    arr.push(emptyStateVarGroup());
  }

  removeVar(arr: FormArray<FormGroup>, i: number): void {
    arr.removeAt(i);
  }

  enumValues(group: FormGroup): string[] {
    const raw = group.get('values')?.value as string ?? '';
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }

  asGroup(c: unknown): FormGroup {
    return c as FormGroup;
  }

  /** Names from the campaign schema that haven't been added to this terminal yet. */
  availableGlobalNames(): string[] {
    if (!this.campaignGlobalSchema) return [];
    const already = new Set(
      this.globalVars.controls.map((c) => (c.get('name')?.value as string) ?? '').filter(Boolean),
    );
    return Object.keys(this.campaignGlobalSchema).filter((n) => !already.has(n));
  }

  protected openPicker(): void {
    this.pickerQuery = '';
    this.filteredNames = this.availableGlobalNames();
    this.pickerVisible.set(true);
  }

  protected closePicker(): void {
    this.pickerQuery = '';
    this.pickerVisible.set(false);
  }

  protected filterNames(event: { query: string }): void {
    const q = event.query.toLowerCase();
    this.filteredNames = this.availableGlobalNames().filter((n) => n.toLowerCase().includes(q));
  }

  protected onGlobalSelect(event: { value: string }): void {
    const name = event.value;
    if (!name || !this.campaignGlobalSchema) return;
    const decl = this.campaignGlobalSchema[name];
    if (!decl) return;
    this.globalVars.push(
      makeStateVarGroup(name, {
        type: decl.type,
        default: decl.default,
        values: decl.values,
      }),
    );
    this.pickerQuery = '';
    this.pickerVisible.set(false);
  }
}
