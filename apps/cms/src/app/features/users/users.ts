import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { TableModule } from 'primeng/table';
import { Toast } from 'primeng/toast';
import { UsersApiService } from '../../core/user/users-api.service';
import type { UserDto } from '../../core/user/user.types';
import { CreateUserDialogComponent } from './create-user-dialog';
import { EditUserDialogComponent } from './edit-user-dialog';
import { ResetPasswordDialogComponent } from './reset-password-dialog';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    TableModule,
    ButtonModule,
    ConfirmDialog,
    Toast,
    RouterLink,
    CreateUserDialogComponent,
    EditUserDialogComponent,
    ResetPasswordDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-toast />
    <p-confirmdialog />

    <div class="bo-page">
      <div class="bo-page-head">
        <h1>Utenti</h1>
        <button type="button" class="bo-btn primary" (click)="showCreate.set(true)">
          Nuovo utente
        </button>
      </div>

      <div class="bo-card">
        <p-table
          [value]="users() ?? []"
          [loading]="users() === undefined"
          [tableStyle]="{ 'min-width': '600px' }"
          styleClass="bo-table"
        >
          <ng-template pTemplate="header">
            <tr>
              <th>Nome utente</th>
              <th>Ruolo</th>
              <th>Azioni</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-user>
            <tr>
              <td>
                <a [routerLink]="['/users', user.id]">{{ user.username }}</a>
              </td>
              <td>
                <span class="bo-pill" [class.active]="user.role === 'admin'">
                  {{ user.role }}
                </span>
              </td>
              <td>
                <div class="row-actions">
                  <button
                    type="button"
                    class="bo-btn ghost icon"
                    title="Modifica"
                    (click)="openEdit(user)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="bo-btn ghost icon"
                    title="Reimposta password"
                    (click)="openResetPassword(user)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="bo-btn ghost icon danger"
                    title="Elimina"
                    (click)="confirmDelete(user)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6"/>
                      <path d="M14 11v6"/>
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="3" style="text-align: center; color: var(--bo-text-faint);">
                Nessun utente trovato
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    </div>

    <app-create-user-dialog
      [visible]="showCreate()"
      (closed)="showCreate.set(false)"
      (userCreated)="onCreated()"
    />

    <app-edit-user-dialog
      [visible]="showEdit()"
      [user]="userToEdit()"
      (closed)="closeEdit()"
      (userUpdated)="onUpdated($event)"
    />

    <app-reset-password-dialog
      [visible]="showResetPassword()"
      [user]="userToResetPassword()"
      (closed)="closeResetPassword()"
    />
  `,
})
export class UsersPage implements OnInit {
  private readonly api = inject(UsersApiService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  protected readonly users = signal<UserDto[] | undefined>(undefined);

  protected readonly showCreate = signal(false);
  protected readonly showEdit = signal(false);
  protected readonly userToEdit = signal<UserDto | null>(null);
  protected readonly showResetPassword = signal(false);
  protected readonly userToResetPassword = signal<UserDto | null>(null);

  ngOnInit(): void {
    this.loadUsers();
  }

  private loadUsers(): void {
    this.api.list().subscribe((list) => this.users.set(list));
  }

  protected openEdit(user: UserDto): void {
    this.userToEdit.set(user);
    this.showEdit.set(true);
  }

  protected closeEdit(): void {
    this.showEdit.set(false);
    this.userToEdit.set(null);
  }

  protected openResetPassword(user: UserDto): void {
    this.userToResetPassword.set(user);
    this.showResetPassword.set(true);
  }

  protected closeResetPassword(): void {
    this.showResetPassword.set(false);
    this.userToResetPassword.set(null);
  }

  protected onCreated(): void {
    this.showCreate.set(false);
    this.loadUsers();
    this.messageService.add({ severity: 'success', summary: 'Utente creato' });
  }

  protected onUpdated(updated: UserDto): void {
    this.closeEdit();
    this.users.update((list) => list?.map((u) => (u.id === updated.id ? updated : u)));
    this.messageService.add({ severity: 'success', summary: 'Utente aggiornato' });
  }

  protected confirmDelete(user: UserDto): void {
    this.confirmationService.confirm({
      message: "Questa azione eliminerà l'utente. L'operazione non è reversibile.",
      acceptButtonStyleClass: 'p-button-danger',
      acceptLabel: 'Elimina',
      rejectLabel: 'Annulla',
      accept: () => this.onDeleteConfirmed(user),
    });
  }

  private onDeleteConfirmed(user: UserDto): void {
    this.api.delete(user.id).subscribe({
      next: () => {
        this.users.update((list) => list?.filter((u) => u.id !== user.id));
        this.messageService.add({ severity: 'success', summary: 'Utente eliminato' });
      },
      error: () =>
        this.messageService.add({ severity: 'error', summary: "Errore durante l'eliminazione" }),
    });
  }
}
