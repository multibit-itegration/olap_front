import { Component, ChangeDetectionStrategy, inject, OnInit, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, EMPTY, of } from 'rxjs';
import { ReportService } from '../../core/api/report.service';
import {
  Report,
  ReportType,
  REPORT_TYPE_LABELS,
  REPORT_TYPE_ORDER,
  SCHEDULE_TYPE_LABELS,
  IikoReport,
  ScheduleFrequency,
  SCHEDULE_FREQUENCY_LABELS,
  TIMEZONE_CHOICES,
  WEEKDAY_LABELS,
  GlobalSchedule
} from '../../core/api/models/report.models';

interface ReportGroup {
  type: ReportType;
  label: string;
  reports: Report[];
}

interface IikoReportGroup {
  type: string;
  label: string;
  reports: IikoReport[];
  expanded: boolean;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportsComponent implements OnInit {
  private readonly reportService = inject(ReportService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly reports = signal<Report[]>([]);
  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);

  private readonly dbId = signal<number>(0);
  private readonly userId = signal<number | null>(null);

  protected readonly isEmpty = computed(() => this.reports().length === 0);

  // Modal state
  protected readonly showModal = signal<boolean>(false);
  protected readonly iikoReports = signal<IikoReport[]>([]);
  protected readonly modalLoading = signal<boolean>(false);
  protected readonly modalError = signal<string | null>(null);
  protected readonly selectedReportIds = signal<Set<string>>(new Set());
  protected readonly expandedGroups = signal<Set<string>>(new Set());
  protected readonly submitting = signal<boolean>(false);
  protected readonly searchQuery = signal<string>('');

  protected readonly selectedCount = computed(() => this.selectedReportIds().size);

  // Schedule modal state
  protected readonly showScheduleModal = signal<boolean>(false);
  protected readonly scheduleLoading = signal<boolean>(false);
  protected readonly scheduleError = signal<string | null>(null);
  protected readonly scheduleSaving = signal<boolean>(false);
  protected readonly existingSchedule = signal<GlobalSchedule | null>(null);

  protected readonly scheduleFrequency = signal<ScheduleFrequency>('daily');
  protected readonly scheduleTimezone = signal<string>('Europe/Moscow');
  protected readonly scheduleTime = signal<string>('13:00');
  protected readonly scheduleWeekday = signal<number>(1);
  protected readonly scheduleDayOfMonth = signal<string>('1');
  protected readonly scheduleDataPeriod = signal<number>(7);

  protected readonly frequencyOptions = Object.entries(SCHEDULE_FREQUENCY_LABELS).map(([value, label]) => ({ value: value as ScheduleFrequency, label }));

  protected readonly timezoneOptions = TIMEZONE_CHOICES;
  protected readonly weekdayOptions = [1, 2, 3, 4, 5, 6, 0].map(d => ({ value: d, label: WEEKDAY_LABELS[d] }));

  protected readonly groupedIikoReports = computed<IikoReportGroup[]>(() => {
    const all = this.iikoReports();
    if (all.length === 0) return [];

    const query = this.searchQuery().toLowerCase().trim();
    const expanded = this.expandedGroups();

    // Filter reports by search query
    const filtered = query
      ? all.filter(report => report.name.toLowerCase().includes(query))
      : all;

    if (filtered.length === 0) return [];

    const grouped = new Map<string, IikoReport[]>();
    for (const report of filtered) {
      const existing = grouped.get(report.reportType);
      if (existing) {
        existing.push(report);
      } else {
        grouped.set(report.reportType, [report]);
      }
    }

    return Array.from(grouped.entries()).map(([type, reports]) => ({
      type,
      label: this.getReportTypeLabel(type),
      reports,
      expanded: expanded.has(type)
    }));
  });

  protected readonly groupedReports = computed<ReportGroup[]>(() => {
    const all = this.reports();
    if (all.length === 0) return [];

    const grouped = new Map<ReportType, Report[]>();
    for (const report of all) {
      const existing = grouped.get(report.report_type);
      if (existing) {
        existing.push(report);
      } else {
        grouped.set(report.report_type, [report]);
      }
    }

    return REPORT_TYPE_ORDER
      .filter(type => grouped.has(type))
      .map(type => ({
        type,
        label: REPORT_TYPE_LABELS[type],
        reports: grouped.get(type)!
      }));
  });

  ngOnInit(): void {
    // Subscribe to route params to handle component reuse
    this.route.paramMap.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(params => {
      const dbIdParam = params.get('dbId');
      if (!dbIdParam) {
        this.goBack();
        return;
      }

      const parsedDbId = parseInt(dbIdParam, 10);
      if (isNaN(parsedDbId)) {
        this.goBack();
        return;
      }

      this.dbId.set(parsedDbId);

      const idParam = params.get('id');
      if (idParam) {
        const parsedUserId = parseInt(idParam, 10);
        if (!isNaN(parsedUserId)) {
          this.userId.set(parsedUserId);
        }
      }

      this.loadReports();
    });
  }

  private loadReports(): void {
    this.loading.set(true);
    this.error.set(null);

    this.reportService.getReportsByConnectionId(this.dbId()).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err: HttpErrorResponse) => {
        if (err.status === 404) {
          return of([]);
        }
        this.error.set('Не удалось загрузить отчёты');
        this.loading.set(false);
        return of([]);
      })
    ).subscribe(reports => {
      this.reports.set(reports);
      this.loading.set(false);
    });
  }

  protected retry(): void {
    this.loadReports();
  }

  protected getScheduleLabel(scheduleType: string | null): string {
    if (!scheduleType) return 'не задано';
    return SCHEDULE_TYPE_LABELS[scheduleType] ?? 'не задано';
  }

  protected getReportTypeLabel(type: string): string {
    const typeKey = type.toUpperCase() as ReportType;
    return REPORT_TYPE_LABELS[typeKey] ?? type;
  }

  protected onAddReport(): void {
    this.showModal.set(true);
    this.loadIikoReports();
  }

  protected onScheduleSettings(): void {
    this.showScheduleModal.set(true);
    this.loadGlobalSchedule();
  }

  private loadGlobalSchedule(): void {
    this.scheduleLoading.set(true);
    this.scheduleError.set(null);

    this.reportService.getGlobalSchedule(this.dbId()).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err: HttpErrorResponse) => {
        if (err.status === 404) {
          this.existingSchedule.set(null);
          this.scheduleLoading.set(false);
          return of(null);
        }
        this.scheduleError.set('Не удалось загрузить расписание');
        this.scheduleLoading.set(false);
        return of(null);
      })
    ).subscribe(schedule => {
      if (schedule) {
        this.existingSchedule.set(schedule);
        this.parseCronToForm(schedule.global_cron);
        const matchedTz = TIMEZONE_CHOICES.find(
          tz => tz.value.toLowerCase() === schedule.timezone.toLowerCase()
        );
        this.scheduleTimezone.set(matchedTz?.value ?? 'Europe/Moscow');
        this.scheduleDataPeriod.set(schedule.data_period_days);
      }
      this.scheduleLoading.set(false);
    });
  }

  private parseCronToForm(cron: string): void {
    const parts = cron.split(' ');
    if (parts.length < 5) return;

    const [minute, hour, dayOfMonth, , dayOfWeek] = parts;
    this.scheduleTime.set(`${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`);

    if (dayOfMonth !== '*' && dayOfMonth !== '?') {
      this.scheduleFrequency.set('monthly');
      this.scheduleDayOfMonth.set(dayOfMonth);
    } else if (dayOfWeek !== '*' && dayOfWeek !== '?') {
      this.scheduleFrequency.set('weekly');
      this.scheduleWeekday.set(parseInt(dayOfWeek, 10));
    } else {
      this.scheduleFrequency.set('daily');
    }
  }

  protected buildCronFromForm(): string {
    const [hour, minute] = this.scheduleTime().split(':');
    const freq = this.scheduleFrequency();

    if (freq === 'monthly') {
      // Validate day of month (1-31)
      const dayOfMonth = Math.min(31, Math.max(1, parseInt(this.scheduleDayOfMonth(), 10) || 1));
      return `${minute} ${hour} ${dayOfMonth} * *`;
    } else if (freq === 'weekly') {
      return `${minute} ${hour} * * ${this.scheduleWeekday()}`;
    }
    return `${minute} ${hour} * * *`;
  }

  protected closeScheduleModal(): void {
    this.showScheduleModal.set(false);
    this.scheduleError.set(null);
    this.existingSchedule.set(null);
    this.scheduleFrequency.set('daily');
    this.scheduleTimezone.set('Europe/Moscow');
    this.scheduleTime.set('13:00');
    this.scheduleWeekday.set(1);
    this.scheduleDayOfMonth.set('1');
    this.scheduleDataPeriod.set(7);
  }

  protected onFrequencyChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.scheduleFrequency.set(select.value as ScheduleFrequency);
  }

  protected onTimezoneChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.scheduleTimezone.set(select.value);
  }

  protected onTimeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.scheduleTime.set(input.value);
  }

  protected onWeekdayChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.scheduleWeekday.set(parseInt(select.value, 10));
  }

  protected onDayOfMonthChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    // Validate day of month (1-31)
    const validatedValue = Math.min(31, Math.max(1, value || 1));
    this.scheduleDayOfMonth.set(validatedValue.toString());
  }

  protected onDataPeriodChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    // Validate range: 1-365 days
    if (!isNaN(value) && value >= 1 && value <= 365) {
      this.scheduleDataPeriod.set(value);
    }
  }

  protected saveSchedule(): void {
    this.scheduleSaving.set(true);
    this.scheduleError.set(null);

    const cron = this.buildCronFromForm();
    const existing = this.existingSchedule();

    const request$ = existing
      ? this.reportService.updateGlobalSchedule(this.dbId(), {
          global_cron: cron,
          timezone: this.scheduleTimezone(),
          data_period_days: this.scheduleDataPeriod()
        })
      : this.reportService.createGlobalSchedule(this.dbId(), {
          global_cron: cron,
          timezone: this.scheduleTimezone(),
          data_period_days: this.scheduleDataPeriod()
        });

    request$.pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err: HttpErrorResponse) => {
        this.scheduleError.set('Не удалось сохранить расписание');
        this.scheduleSaving.set(false);
        return of(null);
      })
    ).subscribe(result => {
      if (result) {
        this.scheduleSaving.set(false);
        this.closeScheduleModal();
      }
    });
  }

  protected onConfigureReport(report: Report): void {
    if (this.userId()) {
      this.router.navigate(['/admin/users', this.userId(), 'databases', this.dbId(), 'reports', report.id, 'settings']);
    } else {
      this.router.navigate(['/user/databases', this.dbId(), 'reports', report.id, 'settings']);
    }
  }

  private loadIikoReports(): void {
    this.modalLoading.set(true);
    this.modalError.set(null);
    this.iikoReports.set([]);
    this.selectedReportIds.set(new Set());

    this.reportService.getIikoReports(this.dbId()).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err: HttpErrorResponse) => {
        this.modalError.set('Не удалось загрузить отчёты из iiko');
        this.modalLoading.set(false);
        return of([]);
      })
    ).subscribe(reports => {
      this.iikoReports.set(reports);
      this.modalLoading.set(false);
    });
  }

  protected closeModal(): void {
    this.showModal.set(false);
    this.iikoReports.set([]);
    this.selectedReportIds.set(new Set());
    this.expandedGroups.set(new Set());
    this.modalError.set(null);
    this.searchQuery.set('');
  }

  protected onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  protected toggleGroup(group: IikoReportGroup): void {
    const current = new Set(this.expandedGroups());
    if (current.has(group.type)) {
      current.delete(group.type);
    } else {
      current.add(group.type);
    }
    this.expandedGroups.set(current);
  }

  protected toggleReportSelection(reportId: string): void {
    const current = new Set(this.selectedReportIds());
    if (current.has(reportId)) {
      current.delete(reportId);
    } else {
      current.add(reportId);
    }
    this.selectedReportIds.set(current);
  }

  protected isReportSelected(reportId: string): boolean {
    return this.selectedReportIds().has(reportId);
  }

  protected getSelectionNumber(reportId: string): number {
    const selected = Array.from(this.selectedReportIds());
    return selected.indexOf(reportId) + 1;
  }

  protected submitSelectedReports(): void {
    const selected = Array.from(this.selectedReportIds());
    if (selected.length === 0) return;

    this.submitting.set(true);

    this.reportService.createReports(this.dbId(), {
      iiko_reports_ids: selected,
      format: 'pdf'
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err: HttpErrorResponse) => {
        this.modalError.set('Не удалось создать отчёты');
        this.submitting.set(false);
        return EMPTY;
      })
    ).subscribe(() => {
      this.submitting.set(false);
      this.closeModal();
      this.loadReports();
    });
  }

  protected trackByReportId(index: number, report: Report): number {
    return report.id;
  }

  protected trackByGroupType(index: number, group: ReportGroup): string {
    return group.type;
  }

  protected trackByIikoReportId(index: number, report: IikoReport): string {
    return report.id;
  }

  protected trackByIikoGroupType(index: number, group: IikoReportGroup): string {
    return group.type;
  }

  protected goBack(): void {
    if (this.userId()) {
      this.router.navigate(['/admin/users', this.userId(), 'databases']);
    } else {
      this.router.navigate(['/user/databases']);
    }
  }

  protected getScheduleStatusText(scheduleType: string | null): string {
    if (!scheduleType) {
      return 'Рассылка откл.';
    }
    if (scheduleType === 'global') {
      return 'Общая рассылка';
    }
    if (scheduleType === 'individual') {
      return 'Инд. рассылка';
    }
    return 'Не задано';
  }

  protected getScheduleStatusClass(scheduleType: string | null): string {
    if (!scheduleType) {
      return 'status-disabled';
    }
    if (scheduleType === 'global') {
      return 'status-global';
    }
    if (scheduleType === 'individual') {
      return 'status-individual';
    }
    return 'status-disabled';
  }
}
