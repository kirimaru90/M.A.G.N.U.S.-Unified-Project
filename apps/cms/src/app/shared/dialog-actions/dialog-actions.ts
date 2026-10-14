import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * The footer every CMS dialog ends with: the API error (if any), then a cancel
 * action and the primary action, right-aligned. Extra buttons are projected
 * between the two.
 *
 * With `submitType: 'submit'` (the default) the primary button submits the
 * enclosing `<form>`; with `'button'` it emits `submitted` instead.
 */
@Component({
  selector: 'app-dialog-actions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error) {
      <div class="bo-field-error" style="margin-top: 8px;" data-testid="dialog-error">{{ error }}</div>
    }

    <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;">
      <button type="button" class="bo-btn ghost" data-testid="dialog-cancel" (click)="cancelled.emit()">
        {{ cancelLabel }}
      </button>
      <ng-content />
      <button
        [type]="submitType"
        class="bo-btn primary"
        data-testid="dialog-submit"
        [disabled]="saving || disabled"
        (click)="onPrimaryClick()"
      >
        {{ saving ? savingLabel : submitLabel }}
      </button>
    </div>
  `,
})
export class DialogActionsComponent {
  @Input() error: string | null = null;
  @Input() saving = false;
  @Input() disabled = false;
  @Input() submitLabel = 'Salva';
  @Input() savingLabel = 'Salvataggio…';
  @Input() cancelLabel = 'Annulla';
  @Input() submitType: 'submit' | 'button' = 'submit';
  @Output() cancelled = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<void>();

  protected onPrimaryClick(): void {
    if (this.submitType === 'button') this.submitted.emit();
  }
}
