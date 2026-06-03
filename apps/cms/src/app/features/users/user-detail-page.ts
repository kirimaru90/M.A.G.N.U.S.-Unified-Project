import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { UsersApiService } from '../../core/user/users-api.service';
import type { UserDto } from '../../core/user/user.types';
import { EditUserDialogComponent } from './edit-user-dialog';
import { UserCampaignsPanelComponent } from './user-campaigns-panel';

@Component({
  selector: 'app-user-detail-page',
  standalone: true,
  imports: [RouterLink, Toast, ConfirmDialog, EditUserDialogComponent, UserCampaignsPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  template: `
    <p-toast />
    <p-confirmdialog />

    <div class="bo-page">
      @if (notFound()) {
        <div style="text-align: center; padding: 48px 0;">
          <p>Utente non trovato</p>
          <a [routerLink]="['/users']" class="bo-btn ghost" style="margin-top: 12px; display: inline-block;">
            Torna alla lista
          </a>
        </div>
      } @else if (user()) {
        <div class="bo-page-head">
          <div style="display: flex; align-items: center; gap: 12px;">
            <h1>{{ user()!.username }}</h1>
            <span class="bo-pill" [class.active]="user()!.role === 'admin'">
              {{ user()!.role }}
            </span>
          </div>
          <button type="button" class="bo-btn ghost" (click)="openEdit()">
            Modifica
          </button>
        </div>

        @if (user()!.role === 'player') {
          <app-user-campaigns-panel [user]="user()!" />
        } @else {
          <div class="bo-card section">
            <p style="color: var(--bo-text-faint);">
              Gli amministratori hanno accesso implicito a tutte le campagne.
            </p>
          </div>
        }
      } @else {
        <div style="padding: 48px 0; text-align: center;">
          Caricamento…
        </div>
      }
    </div>

    <app-edit-user-dialog
      [visible]="showEdit()"
      [user]="user()"
      (closed)="showEdit.set(false)"
      (userUpdated)="onUpdated($event)"
    />
  `,
})
export class UserDetailPage implements OnInit {
  private readonly api = inject(UsersApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly messageService = inject(MessageService);

  protected readonly user = signal<UserDto | null>(null);
  protected readonly notFound = signal(false);
  protected readonly showEdit = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.api.get(id).subscribe({
      next: (u) => this.user.set(u),
      error: () => this.notFound.set(true),
    });
  }

  protected openEdit(): void {
    this.showEdit.set(true);
  }

  protected onUpdated(updated: UserDto): void {
    this.user.set(updated);
    this.showEdit.set(false);
    this.messageService.add({ severity: 'success', summary: 'Utente aggiornato' });
  }
}
