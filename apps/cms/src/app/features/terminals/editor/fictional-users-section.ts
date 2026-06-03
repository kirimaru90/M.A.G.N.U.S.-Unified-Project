import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-fictional-users-section',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bo-card section">
      <h3 class="bo-card-section-title">Utenti fittizi</h3>

      @for (row of users.controls; track row; let i = $index) {
        <div [formGroup]="asGroup(row)" class="user-row">
          <input formControlName="username" placeholder="username" class="bo-input sm" />
          <input formControlName="password" type="text" placeholder="password (cleartext)" class="bo-input sm" />
          <button type="button" class="bo-btn ghost sm danger" (click)="remove(i)">✕</button>
        </div>
      } @empty {
        <p class="empty-hint">Nessun utente fittizio.</p>
      }

      <button type="button" class="bo-btn ghost sm" (click)="add()">+ Aggiungi utente</button>
    </div>
  `,
  styles: [`
    .section { margin-bottom: 16px; }
    .user-row { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; }
    .empty-hint { font-size: 13px; color: var(--bo-text-faint); margin: 0 0 8px; }
    .bo-input.sm { padding: 4px 8px; font-size: 13px; }
    .bo-btn.sm { padding: 4px 10px; font-size: 13px; }
    .danger { color: var(--bo-danger, #c0392b); }
  `],
})
export class FictionalUsersSectionComponent {
  @Input({ required: true }) users!: FormArray<FormGroup>;

  add(): void {
    this.users.push(new FormGroup({
      username: new FormControl(''),
      password: new FormControl(''),
    }));
  }

  remove(i: number): void {
    this.users.removeAt(i);
  }

  asGroup(c: unknown): FormGroup {
    return c as FormGroup;
  }
}
