import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminService } from '../../../core/api/admin.service';
import { AuthService } from '../../../core/api/auth.service';
import {
  BasicMetric,
  ComparisonDetails,
  DiscountsMetric,
  IikoConnection,
  MainMetrics,
  MetricValue
} from '../../../core/api/models/admin.models';

type MetricKind = 'currency' | 'count' | 'percent';
type ComparisonTone = 'positive' | 'negative' | 'neutral';

interface MetricComparisonView {
  label: string;
  value: string;
  tone: ComparisonTone;
}

interface MetricCardView {
  id: string;
  title: string;
  value: string;
  hint: string;
  kind: MetricKind;
  primary?: MetricComparisonView;
  secondary?: MetricComparisonView;
}

@Component({
  selector: 'app-database-overview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './database-overview.component.html',
  styleUrls: ['./database-overview.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DatabaseOverviewComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly dbId = signal<number>(0);
  protected readonly ownerUserId = signal<number | null>(null);
  protected readonly adminContext = signal<boolean>(false);
  protected readonly databaseName = signal<string>('База');
  protected readonly metrics = signal<MainMetrics | null>(null);
  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);

  protected readonly metricCards = computed<MetricCardView[]>(() => {
    const metrics = this.metrics();

    return [
      this.createMetricCard('income', 'Выручка', metrics?.income, 'currency', 'Ключевой показатель продаж'),
      this.createMetricCard('orders', 'Заказы', metrics?.orders_count, 'count', 'Количество заказов'),
      this.createMetricCard('avg-bill', 'Средний чек', metrics?.avg_bill, 'currency', 'Средняя сумма заказа'),
      this.createMetricCard('food-cost', 'Food cost', metrics?.food_cost, 'percent', 'Доля себестоимости'),
      this.createMetricCard('selfprice', 'Себестоимость', metrics?.selfprice ?? null, 'currency', 'Сумма себестоимости'),
      this.createDiscountCard(metrics?.discounts)
    ];
  });

  ngOnInit(): void {
    const dbId = this.parseRouteNumber('dbId');
    if (dbId === null) {
      this.goBack();
      return;
    }

    this.dbId.set(dbId);
    const adminUserId = this.parseRouteNumber('id');

    if (adminUserId !== null) {
      this.adminContext.set(true);
      this.ownerUserId.set(adminUserId);
      this.loadDatabaseName(adminUserId);
      this.loadMetrics();
      return;
    }

    const currentUser = this.authService.currentUser();
    if (currentUser) {
      this.ownerUserId.set(currentUser.id);
      this.loadDatabaseName(currentUser.id);
      this.loadMetrics();
      return;
    }

    this.authService.loadCurrentUser().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: user => {
        this.ownerUserId.set(user.id);
        this.loadDatabaseName(user.id);
        this.loadMetrics();
      },
      error: () => this.router.navigate(['/login'])
    });
  }

  protected retry(): void {
    this.loadMetrics();
  }

  protected goBack(): void {
    if (this.adminContext() && this.ownerUserId() !== null) {
      this.router.navigate(['/admin/users', this.ownerUserId(), 'databases']);
      return;
    }

    this.router.navigate(['/user/databases']);
  }

  protected openReports(): void {
    if (this.adminContext() && this.ownerUserId() !== null) {
      this.router.navigate(['/admin/users', this.ownerUserId(), 'databases', this.dbId(), 'reports']);
      return;
    }

    this.router.navigate(['/user/databases', this.dbId(), 'reports']);
  }

  protected trackByMetricId(index: number, card: MetricCardView): string {
    return card.id;
  }

  protected getComparisonClass(tone: ComparisonTone): string {
    return `comparison-${tone}`;
  }

  private loadMetrics(): void {
    this.loading.set(true);
    this.error.set(null);

    this.adminService.getMainMetrics(this.dbId()).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err: HttpErrorResponse) => {
        this.error.set(this.getMetricsErrorMessage(err));
        this.loading.set(false);
        return of(null);
      })
    ).subscribe(metrics => {
      this.metrics.set(metrics);
      this.loading.set(false);
    });
  }

  private loadDatabaseName(userId: number): void {
    this.adminService.getIikoConnectionsByUserId(userId).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(() => of([] as IikoConnection[]))
    ).subscribe(databases => {
      const database = databases.find(item => item.id === this.dbId());
      this.databaseName.set(database?.name ?? `База #${this.dbId()}`);
    });
  }

  private parseRouteNumber(paramName: string): number | null {
    const value = this.route.snapshot.paramMap.get(paramName);
    if (!value) return null;

    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  private createMetricCard(
    id: string,
    title: string,
    metric: BasicMetric | MetricValue | undefined,
    kind: MetricKind,
    hint: string
  ): MetricCardView {
    const basicMetric = this.isBasicMetric(metric) ? metric : null;
    let value: MetricValue | undefined;

    if (basicMetric) {
      value = basicMetric.value;
    } else if (this.isBasicMetric(metric)) {
      value = undefined;
    } else {
      value = metric;
    }

    return {
      id,
      title,
      value: this.formatMetricValue(value, kind),
      hint,
      kind,
      primary: this.createComparison('К тому же дню прошлой недели', basicMetric?.comparison?.to_previous_weekday, kind),
      secondary: this.createComparison('К среднему за 4 таких же дня недели', basicMetric?.comparison?.to_last_four_weekdays, kind)
    };
  }

  private createDiscountCard(metric: DiscountsMetric | undefined): MetricCardView {
    const hint = metric?.percent_of_income !== undefined && metric?.percent_of_income !== null
      ? `${this.formatMetricValue(metric.percent_of_income, 'percent')} от выручки`
      : 'Сумма скидок';

    return this.createMetricCard('discounts', 'Скидки', metric, 'currency', hint);
  }

  private createComparison(label: string, details: ComparisonDetails | undefined, kind: MetricKind): MetricComparisonView | undefined {
    if (!details) return undefined;

    const value = this.formatComparisonDetails(details, kind);
    if (!value) return undefined;

    return {
      label,
      value,
      tone: this.getComparisonTone(value, kind)
    };
  }

  private formatComparisonDetails(details: ComparisonDetails, kind: MetricKind): string | null {
    const mainValue = kind === 'count'
      ? details.count_diff
      : kind === 'currency'
        ? details.roubles
        : details.percents;

    const formattedMain = kind === 'count'
      ? this.formatSignedNumber(mainValue)
      : kind === 'currency'
        ? this.formatSignedCurrency(mainValue)
        : this.formatSignedPercent(mainValue);

    const formattedPercent = kind !== 'percent' ? this.formatSignedPercent(details.percents) : null;

    if (formattedMain && formattedPercent) {
      return `${formattedMain} · ${formattedPercent}`;
    }

    return formattedMain ?? formattedPercent;
  }

  private isBasicMetric(value: BasicMetric | MetricValue | undefined): value is BasicMetric {
    return typeof value === 'object' && value !== null && ('value' in value || 'comparison' in value);
  }

  private formatMetricValue(value: MetricValue | undefined, kind: MetricKind): string {
    const numeric = this.toNumber(value);

    if (numeric === null) {
      return this.formatRawValue(value);
    }

    if (kind === 'currency') {
      return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        maximumFractionDigits: 0
      }).format(numeric);
    }

    if (kind === 'percent') {
      const percent = Math.abs(numeric) <= 1 && numeric !== 0 ? numeric * 100 : numeric;
      return `${this.formatNumber(percent, 1)}%`;
    }

    return new Intl.NumberFormat('ru-RU', {
      maximumFractionDigits: 0
    }).format(numeric);
  }

  private formatSignedCurrency(value: MetricValue | undefined): string | null {
    const numeric = this.toNumber(value);
    if (numeric === null) return null;

    const abs = Math.abs(numeric);
    const formatted = new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0
    }).format(abs);

    return `${this.getSign(numeric)}${formatted}`;
  }

  private formatSignedPercent(value: MetricValue | undefined): string | null {
    const numeric = this.toNumber(value);
    if (numeric === null) return null;

    const percent = Math.abs(numeric) <= 1 && numeric !== 0 ? numeric * 100 : numeric;
    return `${this.getSign(percent)}${this.formatNumber(Math.abs(percent), 1)}%`;
  }

  private formatSignedNumber(value: MetricValue | undefined): string | null {
    const numeric = this.toNumber(value);
    if (numeric === null) return null;

    return `${this.getSign(numeric)}${new Intl.NumberFormat('ru-RU', {
      maximumFractionDigits: 0
    }).format(Math.abs(numeric))}`;
  }

  private formatRawValue(value: MetricValue | undefined): string {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }

    return '—';
  }

  private formatNumber(value: number, maximumFractionDigits: number): string {
    return new Intl.NumberFormat('ru-RU', {
      maximumFractionDigits
    }).format(value);
  }

  private getSign(value: number): string {
    if (value > 0) return '+';
    if (value < 0) return '-';
    return '';
  }

  private getComparisonTone(value: string, kind: MetricKind): ComparisonTone {
    const numeric = this.extractSignedNumber(value);
    if (numeric === null || numeric === 0) return 'neutral';

    return numeric > 0 ? 'positive' : 'negative';
  }

  private extractSignedNumber(value: string | undefined): number | null {
    if (!value) return null;

    const match = value.match(/[+-]?\s*\d+(?:[,.]\d+)?/);
    if (!match) return null;

    return this.toNumber(match[0]);
  }

  private toNumber(value: MetricValue | undefined): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;

    if (typeof value !== 'string') return null;

    const normalized = value
      .replace(/\s/g, '')
      .replace('%', '')
      .replace('₽', '')
      .replace(',', '.');
    const parsed = Number(normalized);

    return Number.isFinite(parsed) ? parsed : null;
  }

  private getMetricsErrorMessage(err: HttpErrorResponse): string {
    if (err.status === 404) {
      return 'Показатели для этой базы пока не найдены';
    }

    return 'Не удалось загрузить основные показатели';
  }
}
