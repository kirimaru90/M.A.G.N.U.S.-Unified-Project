import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import type { StateSchemaConflictResponse } from '../../core/state/state.types';

@Component({
  selector: 'app-schema-conflict-dialog',
  standalone: true,
  imports: [RouterLink, ButtonModule, Dialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible"
      [modal]="true"
      [closable]="true"
      [draggable]="false"
      [resizable]="false"
      [header]="conflict?.error ?? 'Conflitto'"
      styleClass="schema-conflict-dialog"
      (visibleChange)="onVisibleChange($event)"
    >
      <div style="min-width: 420px; display: flex; flex-direction: column; gap: 16px;">
        @if (conflict) {
          @for (item of conflict.conflicts; track item.variable) {
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <strong style="font-family: monospace; font-size: 13px;">{{ item.variable }}</strong>
              <ul style="margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px;">
                @for (ref of item.referencedBy; track ref.id) {
                  <li>
                    <a [routerLink]="['/terminals', ref.id]" style="color: var(--p-primary-color); text-decoration: underline;">
                      {{ ref.title }}
                    </a>
                  </li>
                }
              </ul>
            </div>
          }
        }
      </div>
      <ng-template pTemplate="footer">
        <button type="button" class="bo-btn ghost" (click)="dismiss()">Chiudi</button>
      </ng-template>
    </p-dialog>
  `,
})
export class SchemaConflictDialogComponent {
  @Input() visible = false;
  @Input() conflict: StateSchemaConflictResponse | null = null;

  @Output() readonly dismissed = new EventEmitter<void>();

  protected onVisibleChange(v: boolean): void {
    if (!v) this.dismiss();
  }

  protected dismiss(): void {
    this.dismissed.emit();
  }
}
