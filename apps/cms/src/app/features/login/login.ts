import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 24px;
        background: var(--bo-bg);
      }
      .login-card {
        width: 100%;
        max-width: 360px;
      }
      .login-card .bo-content {
        padding: 18px 18px 20px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .submit-row {
        display: flex;
        justify-content: flex-end;
        margin-top: 4px;
      }
      .error-row {
        display: flex;
      }
    `,
  ],
  template: `
    <section class="bo-card login-card">
      <header class="bo-card-head">
        <span>Accedi</span>
      </header>
      <form
        class="bo-content"
        [formGroup]="form"
        (ngSubmit)="onSubmit()"
        novalidate
        autocomplete="on"
      >
        <div class="bo-field">
          <label for="username">Nome utente</label>
          <input
            id="username"
            class="bo-input mono"
            type="text"
            formControlName="username"
            autocomplete="username"
          />
        </div>

        <div class="bo-field">
          <label for="password">Password</label>
          <input
            id="password"
            class="bo-input mono"
            type="password"
            formControlName="password"
            autocomplete="current-password"
          />
        </div>

        @if (errorMessage()) {
          <div class="error-row">
            <span class="bo-pill danger">
              <span class="dot"></span>
              {{ errorMessage() }}
            </span>
          </div>
        }

        <div class="submit-row">
          <button class="bo-btn primary" type="submit" [disabled]="submitting() || form.invalid">
            Accedi
          </button>
        </div>
      </form>
    </section>
  `,
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      return;
    }
    this.errorMessage.set(null);
    this.submitting.set(true);
    try {
      await this.auth.login(this.form.getRawValue());
      await this.router.navigate(['/campaigns']);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.errorMessage.set('Credenziali non valide');
      } else {
        this.errorMessage.set('Errore di accesso, riprova');
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
