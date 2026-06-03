import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './sidebar';
import { TopbarComponent } from './topbar';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [TopbarComponent, SidebarComponent, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100vh;
        min-height: 100vh;
      }
    `,
  ],
  template: `
    <app-topbar />
    <div class="bo-body">
      <app-sidebar />
      <main class="bo-main">
        <div class="bo-content">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
})
export class ShellComponent {}
