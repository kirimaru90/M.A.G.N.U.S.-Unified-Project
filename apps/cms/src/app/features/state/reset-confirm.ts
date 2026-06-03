import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-reset-confirm',
  standalone: true,
  imports: [FormsModule, ButtonModule, Dialog, InputTextModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible"
      [modal]="true"
      [closable]="true"
      [draggable]="false"
      [resizable]="false"
      header="Reset intera campagna"
      styleClass="reset-confirm-dialog"
      (visibleChange)="onVisibleChange($event)"
    >
      <div style="display: flex; flex-direction: column; gap: 16px; min-width: 400px;">
        <p style="margin: 0; color: var(--p-red-600, #dc2626);">
          <strong>Attenzione:</strong> questa operazione azzera tutto lo stato globale e locale di tutti i terminali della campagna.
        </p>
        <p style="margin: 0;">
          Digita il nome della campagna <strong>{{ campaignName }}</strong> per confermare:
        </p>
        <input
          pInputText
          [(ngModel)]="typed"
          [placeholder]="campaignName"
          style="width: 100%;"
          (ngModelChange)="typed = $event"
        />
      </div>
      <ng-template pTemplate="footer">
        <button type="button" class="bo-btn ghost" (click)="cancel()">Annulla</button>
        <button
          type="button"
          class="bo-btn danger"
          style="background: var(--p-red-600, #dc2626); color: #fff; border-color: transparent;"
          [disabled]="typed !== campaignName"
          (click)="confirm()"
        >
          Reset campagna
        </button>
      </ng-template>
    </p-dialog>
  `,
})
export class ResetConfirmComponent {
  @Input({ required: true }) campaignName!: string;
  @Input() visible = false;

  @Output() readonly confirmed = new EventEmitter<void>();
  @Output() readonly cancelled = new EventEmitter<void>();

  protected typed = '';

  protected onVisibleChange(v: boolean): void {
    if (!v) this.cancel();
  }

  protected confirm(): void {
    if (this.typed !== this.campaignName) return;
    this.typed = '';
    this.confirmed.emit();
  }

  protected cancel(): void {
    this.typed = '';
    this.cancelled.emit();
  }
}
