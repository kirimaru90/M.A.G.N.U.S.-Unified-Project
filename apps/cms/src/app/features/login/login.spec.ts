import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoginPage } from './login';
import { AuthService } from '../../core/auth/auth.service';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let loginSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    loginSpy = vi.fn().mockResolvedValue({ id: 'u1', username: 'admin', role: 'admin' });
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        { provide: AuthService, useValue: { login: loginSpy } },
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
  });

  function fill(username: string, password: string) {
    const el: HTMLElement = fixture.nativeElement;
    for (const [id, value] of [
      ['username', username],
      ['password', password],
    ]) {
      const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
  }

  function submit() {
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
  }

  it('renders "Ricordami" unchecked by default and sends rememberMe: false', () => {
    const remember = fixture.nativeElement.querySelector('#remember') as HTMLInputElement;
    expect(remember.type).toBe('checkbox');
    expect(remember.checked).toBe(false);

    fill('admin', 'pw');
    submit();

    expect(loginSpy).toHaveBeenCalledWith({ username: 'admin', password: 'pw', rememberMe: false });
  });

  it('sends rememberMe: true when "Ricordami" is checked', () => {
    fill('admin', 'pw');
    const remember = fixture.nativeElement.querySelector('#remember') as HTMLInputElement;
    remember.click();
    submit();

    expect(loginSpy).toHaveBeenCalledWith({ username: 'admin', password: 'pw', rememberMe: true });
  });
});
