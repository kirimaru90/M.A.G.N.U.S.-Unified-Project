import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { DialogActionsComponent } from './dialog-actions';

@Component({
  standalone: true,
  imports: [DialogActionsComponent],
  template: `
    <form (submit)="$event.preventDefault(); formSubmits = formSubmits + 1">
      <app-dialog-actions
        [error]="error()"
        [saving]="saving()"
        [disabled]="disabled()"
        [submitType]="submitType()"
        submitLabel="Crea"
        savingLabel="Creazione…"
        (cancelled)="cancels = cancels + 1"
        (submitted)="submits = submits + 1"
      >
        <button type="button" class="bo-btn secondary" data-testid="extra">Controlla</button>
      </app-dialog-actions>
    </form>
  `,
})
class HostComponent {
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly disabled = signal(false);
  readonly submitType = signal<'submit' | 'button'>('submit');
  cancels = 0;
  submits = 0;
  formSubmits = 0;
}

describe('DialogActionsComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  const el = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement | null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders no error block without an error, and the error text when given', () => {
    expect(el('dialog-error')).toBeNull();
    host.error.set('Errore imprevisto');
    fixture.detectChanges();
    expect(el('dialog-error')?.textContent).toContain('Errore imprevisto');
  });

  it('disables the primary action and shows the saving label while saving', () => {
    expect(el('dialog-submit')?.textContent?.trim()).toBe('Crea');
    host.saving.set(true);
    fixture.detectChanges();
    expect(el('dialog-submit')?.disabled).toBe(true);
    expect(el('dialog-submit')?.textContent?.trim()).toBe('Creazione…');
  });

  it('disables the primary action when disabled is set', () => {
    host.disabled.set(true);
    fixture.detectChanges();
    expect(el('dialog-submit')?.disabled).toBe(true);
  });

  it('emits cancelled from the cancel action', () => {
    el('dialog-cancel')?.click();
    expect(host.cancels).toBe(1);
  });

  it('submits the enclosing form when submitType is submit', () => {
    el('dialog-submit')?.click();
    expect(host.formSubmits).toBe(1);
    expect(host.submits).toBe(0);
  });

  it('emits submitted and does not submit the form when submitType is button', () => {
    host.submitType.set('button');
    fixture.detectChanges();
    el('dialog-submit')?.click();
    expect(host.submits).toBe(1);
    expect(host.formSubmits).toBe(0);
  });

  it('projects extra buttons between cancel and the primary action', () => {
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLElement[];
    expect(buttons.map((b) => b.dataset['testid'])).toEqual(['dialog-cancel', 'extra', 'dialog-submit']);
  });
});
