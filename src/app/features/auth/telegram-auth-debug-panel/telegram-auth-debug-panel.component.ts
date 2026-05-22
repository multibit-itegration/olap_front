import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TelegramAuthDebugService } from '../../../core/services/telegram-auth-debug.service';

@Component({
  selector: 'app-telegram-auth-debug-panel',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './telegram-auth-debug-panel.component.html',
  styleUrl: './telegram-auth-debug-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TelegramAuthDebugPanelComponent {
  private readonly debug = inject(TelegramAuthDebugService);

  readonly entries = this.debug.entries;

  clear(): void {
    this.debug.clear();
  }
}
