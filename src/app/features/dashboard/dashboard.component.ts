import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <h1>Добро пожаловать!</h1>
      <p>Вы успешно авторизованы</p>
    </div>
  `,
  styles: [`
    .dashboard-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background-color: #2A98CC;
    }

    h1 {
      color: white;
      font-size: 48px;
      font-weight: 700;
      margin-bottom: 16px;
    }

    p {
      color: white;
      font-size: 20px;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent {}
