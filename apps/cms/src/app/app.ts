import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bo-frame" [attr.data-theme]="theme.theme()">
      <router-outlet />
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      .bo-frame {
        width: 100%;
        min-height: 100vh;
      }
    `,
  ],
})
export class App {
  protected readonly theme = inject(ThemeService);
}
