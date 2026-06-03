import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-metadata-section',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [formGroup]="metaGroup" class="bo-card section">
      <h3 class="bo-card-section-title">Metadati</h3>

      <div class="field">
        <label class="field-label" for="meta-title">Titolo *</label>
        <input id="meta-title" formControlName="title" class="bo-input" placeholder="Titolo del terminale" />
        @if (metaGroup.get('title')?.invalid && metaGroup.get('title')?.touched) {
          <span class="field-error">Il titolo è obbligatorio</span>
        }
      </div>

      <div class="field checkbox-field">
        <input type="checkbox" formControlName="public" id="meta-public" />
        <label for="meta-public">Pubblico</label>
      </div>

      <div class="field">
        <label class="field-label" for="meta-hidden-id">ID nascosto</label>
        <input id="meta-hidden-id" formControlName="hiddenId" class="bo-input" placeholder="es. super-duper-admin" />
        <span class="field-hint">
          Identificatore facoltativo e leggibile, univoco nella campagna. Viene incluso in
          import/export ed è l'unico identificatore mostrato; l'ID tecnico è gestito dall'API.
        </span>
      </div>
    </div>
  `,
  styles: [`
    .section { margin-bottom: 16px; }
    .field { margin-bottom: 10px; display: flex; flex-direction: column; gap: 4px; }
    .field-label { font-size: 13px; font-weight: 500; }
    .field-error { font-size: 12px; color: var(--bo-danger, #c0392b); }
    .field-hint { font-size: 12px; color: var(--bo-text-faint); }
    .checkbox-field { flex-direction: row; align-items: center; gap: 8px; }
  `],
})
export class MetadataSectionComponent {
  @Input({ required: true }) metaGroup!: FormGroup;
}
