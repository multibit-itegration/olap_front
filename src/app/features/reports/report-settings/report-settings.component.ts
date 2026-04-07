import { Component, ChangeDetectionStrategy, inject, OnInit, OnDestroy, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { ReportService } from '../../../core/api/report.service';
import { AuthService } from '../../../core/api/auth.service';
import { LinkedChatsService } from '../../../core/api/linked-chats.service';
import { Report, ScheduleType, IndividualSchedule, GroupSchedule, ScheduleFrequency, SCHEDULE_FREQUENCY_LABELS, TIMEZONE_CHOICES, WEEKDAY_LABELS } from '../../../core/api/models/report.models';
import { LinkedChat } from '../../../core/api/models/linked-chats.models';

@Component({
  selector: 'app-report-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './report-settings.component.html',
  styleUrls: ['./report-settings.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportSettingsComponent implements OnInit, OnDestroy {
  private readonly reportService = inject(ReportService);
  private readonly authService = inject(AuthService);
  private readonly linkedChatsService = inject(LinkedChatsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // Timeout IDs for cleanup
  private featureRequestTimeoutId?: number;

  protected readonly report = signal<Report | null>(null);
  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);
  protected readonly updating = signal<boolean>(false);
  protected readonly showFeatureRequest = signal<boolean>(false);
  protected readonly featureRequested = signal<boolean>(false);
  protected readonly saving = signal<boolean>(false);

  private readonly reportId = signal<number>(0);
  private readonly dbId = signal<number>(0);
  private readonly userId = signal<number | null>(null);

  // Local state for selector values (not yet saved)
  protected readonly selectedFormat = signal<string>('pdf');
  protected readonly selectedDeliveryType = signal<string>('telegram');
  protected readonly selectedScheduleType = signal<ScheduleType>(null);

  protected readonly showIndividualSchedule = computed(() => {
    return this.selectedScheduleType() === 'individual';
  });

  // Individual schedule state
  protected readonly individualScheduleLoading = signal<boolean>(false);
  protected readonly individualScheduleError = signal<string | null>(null);
  protected readonly existingIndividualSchedule = signal<IndividualSchedule | null>(null);
  protected readonly individualScheduleSaving = signal<boolean>(false);

  protected readonly individualFrequency = signal<ScheduleFrequency>('daily');
  protected readonly individualTimezone = signal<string>('Europe/Moscow');
  protected readonly individualTime = signal<string>('13:00');
  protected readonly individualWeekday = signal<number>(1);
  protected readonly individualDayOfMonth = signal<string>('1');
  protected readonly individualDataPeriod = signal<number>(7);

  // Group schedule state
  protected readonly sendToGroups = signal<boolean>(false);
  protected readonly linkedChats = signal<LinkedChat[]>([]);
  protected readonly linkedChatsLoading = signal<boolean>(false);
  protected readonly linkedChatsError = signal<string | null>(null);
  protected readonly selectedLinkedChatId = signal<number | null>(null);
  protected readonly groupScheduleLoading = signal<boolean>(false);
  protected readonly groupScheduleError = signal<string | null>(null);
  protected readonly existingGroupSchedule = signal<GroupSchedule | null>(null);
  protected readonly groupScheduleSaving = signal<boolean>(false);

  protected readonly groupFrequency = signal<ScheduleFrequency>('daily');
  protected readonly groupTimezone = signal<string>('Europe/Moscow');
  protected readonly groupTime = signal<string>('13:00');
  protected readonly groupWeekday = signal<number>(1);
  protected readonly groupDayOfMonth = signal<string>('1');
  protected readonly groupDataPeriod = signal<number>(7);

  protected readonly showGroupSchedule = computed(() => {
    return this.sendToGroups() && this.linkedChats().length > 0;
  });

  protected readonly hasNoGroups = computed(() => {
    return this.sendToGroups() && this.linkedChats().length === 0 && !this.linkedChatsLoading();
  });

  protected readonly frequencyOptions = Object.entries(SCHEDULE_FREQUENCY_LABELS).map(([value, label]) => ({ value: value as ScheduleFrequency, label }));
  protected readonly timezoneOptions = TIMEZONE_CHOICES;
  protected readonly weekdayOptions = [1, 2, 3, 4, 5, 6, 0].map(d => ({ value: d, label: WEEKDAY_LABELS[d] }));

  // Default delivery type based on user's telegram_id
  private readonly defaultDeliveryType = computed<string>(() => {
    const user = this.authService.currentUser();
    return user?.telegram_id ? 'telegram' : 'email';
  });

  protected readonly hasUnsavedChanges = computed(() => {
    const rep = this.report();
    if (!rep) return false;
    return (
      this.selectedFormat() !== (rep.format || 'pdf') ||
      this.selectedDeliveryType() !== (rep.delivery_type || this.defaultDeliveryType()) ||
      this.selectedScheduleType() !== rep.schedule_type
    );
  });

  ngOnInit(): void {
    const reportIdParam = this.route.snapshot.paramMap.get('reportId');
    if (!reportIdParam) {
      this.goBack();
      return;
    }

    const parsedReportId = parseInt(reportIdParam, 10);
    if (isNaN(parsedReportId)) {
      this.goBack();
      return;
    }

    this.reportId.set(parsedReportId);

    const dbIdParam = this.route.snapshot.paramMap.get('dbId');
    if (dbIdParam) {
      const parsedDbId = parseInt(dbIdParam, 10);
      if (!isNaN(parsedDbId)) {
        this.dbId.set(parsedDbId);
      }
    }

    // Extract user ID from route params, parent params, or URL fallback
    const userIdParam = this.route.snapshot.paramMap.get('id')
      ?? this.route.parent?.snapshot.paramMap.get('id');
    if (userIdParam) {
      const parsedUserId = parseInt(userIdParam, 10);
      if (!isNaN(parsedUserId)) {
        this.userId.set(parsedUserId);
      }
    } else {
      // Fallback: extract from URL (e.g. /admin/users/89/databases/...)
      const urlMatch = this.router.url.match(/\/users\/(\d+)\//);
      if (urlMatch) {
        this.userId.set(Number(urlMatch[1]));
      }
    }

    this.loadReport();
  }

  private loadReport(): void {
    this.loading.set(true);
    this.error.set(null);

    this.reportService.getReport(this.reportId()).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err: HttpErrorResponse) => {
        this.error.set('Не удалось загрузить отчёт');
        this.loading.set(false);
        return of(null);
      })
    ).subscribe(report => {
      if (report) {
        this.report.set(report);
        // Sync local state with loaded report
        this.selectedFormat.set(report.format || 'pdf');
        // Use user-specific default delivery type if report has none
        this.selectedDeliveryType.set(report.delivery_type || this.defaultDeliveryType());
        this.selectedScheduleType.set(report.schedule_type);
        this.loading.set(false);

        // Load individual schedule if schedule_type is 'individual'
        if (report.schedule_type === 'individual') {
          this.loadIndividualSchedule();
        }
      }
    });
  }

  protected retry(): void {
    this.loadReport();
  }

  protected onFormatChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const format = select.value;
    this.selectedFormat.set(format);
  }

  protected onDeliveryTypeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const deliveryType = select.value;

    this.selectedDeliveryType.set(deliveryType);

    // Автоматически сохраняем изменение delivery_type
    this.saveDeliveryType();
  }

  private saveDeliveryType(): void {
    if (this.saving()) return;

    const rep = this.report();
    if (!rep) return;

    // Проверяем, изменился ли delivery_type
    const currentDeliveryType = rep.delivery_type || this.defaultDeliveryType();
    if (this.selectedDeliveryType() === currentDeliveryType) return;

    this.saving.set(true);
    this.error.set(null);

    const update = {
      format: this.selectedFormat(),
      delivery_type: this.selectedDeliveryType(),
      schedule_type: this.selectedScheduleType()
    };

    this.reportService.updateReport(this.reportId(), update).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err: HttpErrorResponse) => {
        this.error.set('Не удалось сохранить канал рассылки');
        this.saving.set(false);
        return of(null);
      })
    ).subscribe(updatedReport => {
      if (updatedReport) {
        this.report.set(updatedReport);
        // Синхронизируем локальное состояние с ответом сервера
        this.selectedDeliveryType.set(updatedReport.delivery_type || this.defaultDeliveryType());
      }
      this.saving.set(false);
    });
  }

  protected onScheduleTypeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    let scheduleType: ScheduleType;

    if (select.value === 'null') {
      scheduleType = null;
    } else {
      scheduleType = select.value as ScheduleType;
    }

    this.selectedScheduleType.set(scheduleType);

    // Load individual schedule when schedule type is changed to 'individual'
    if (scheduleType === 'individual') {
      this.loadIndividualSchedule();
    }
  }

  protected saveSettings(): void {
    if (this.saving() || !this.hasUnsavedChanges()) return;

    this.saving.set(true);
    this.error.set(null);

    const update = {
      format: this.selectedFormat(),
      delivery_type: this.selectedDeliveryType(),
      schedule_type: this.selectedScheduleType()
    };

    this.reportService.updateReport(this.reportId(), update).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err: HttpErrorResponse) => {
        this.error.set('Не удалось сохранить настройки');
        this.saving.set(false);
        return of(null);
      })
    ).subscribe(updatedReport => {
      if (updatedReport) {
        this.report.set(updatedReport);
        // Sync local state with server response
        this.selectedFormat.set(updatedReport.format || 'pdf');
        // Use user-specific default delivery type if report has none
        this.selectedDeliveryType.set(updatedReport.delivery_type || this.defaultDeliveryType());
        this.selectedScheduleType.set(updatedReport.schedule_type);
      }
      this.saving.set(false);
    });
  }

  private loadIndividualSchedule(): void {
    this.individualScheduleLoading.set(true);
    this.individualScheduleError.set(null);

    this.reportService.getIndividualSchedule(this.reportId()).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err: HttpErrorResponse) => {
        if (err.status === 404) {
          this.existingIndividualSchedule.set(null);
          this.individualScheduleLoading.set(false);
          return of(null);
        }
        this.individualScheduleError.set('Не удалось загрузить индивидуальное расписание');
        this.individualScheduleLoading.set(false);
        return of(null);
      })
    ).subscribe(schedule => {
      if (schedule) {
        this.existingIndividualSchedule.set(schedule);
        this.parseIndividualCronToForm(schedule.individual_cron);
        const matchedTimezone = TIMEZONE_CHOICES.find(
          tz => tz.value.toLowerCase() === schedule.timezone.toLowerCase()
        );
        this.individualTimezone.set(matchedTimezone?.value ?? 'Europe/Moscow');
        this.individualDataPeriod.set(schedule.data_period_days);
      }
      this.individualScheduleLoading.set(false);
    });
  }

  private parseIndividualCronToForm(cron: string): void {
    const parts = cron.split(' ');
    if (parts.length < 5) return;

    const [minute, hour, dayOfMonth, , dayOfWeek] = parts;
    this.individualTime.set(`${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`);

    if (dayOfMonth !== '*' && dayOfMonth !== '?') {
      this.individualFrequency.set('monthly');
      this.individualDayOfMonth.set(dayOfMonth);
    } else if (dayOfWeek !== '*' && dayOfWeek !== '?') {
      this.individualFrequency.set('weekly');
      this.individualWeekday.set(parseInt(dayOfWeek, 10));
    } else {
      this.individualFrequency.set('daily');
    }
  }

  private buildIndividualCronFromForm(): string {
    const [hour, minute] = this.individualTime().split(':');
    const freq = this.individualFrequency();

    if (freq === 'monthly') {
      // Validate day of month (1-31)
      const dayOfMonth = Math.min(31, Math.max(1, parseInt(this.individualDayOfMonth(), 10) || 1));
      return `${minute} ${hour} ${dayOfMonth} * *`;
    } else if (freq === 'weekly') {
      return `${minute} ${hour} * * ${this.individualWeekday()}`;
    }
    return `${minute} ${hour} * * *`;
  }

  protected onIndividualFrequencyChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.individualFrequency.set(select.value as ScheduleFrequency);
  }

  protected onIndividualTimezoneChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.individualTimezone.set(select.value);
  }

  protected onIndividualTimeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.individualTime.set(input.value);
  }

  protected onIndividualWeekdayChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.individualWeekday.set(parseInt(select.value, 10));
  }

  protected onIndividualDayOfMonthChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    // Validate day of month (1-31)
    const validatedValue = Math.min(31, Math.max(1, value || 1));
    this.individualDayOfMonth.set(validatedValue.toString());
  }

  protected onIndividualDataPeriodChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    // Validate range: 1-365 days
    if (!isNaN(value) && value >= 1 && value <= 365) {
      this.individualDataPeriod.set(value);
    }
  }

  protected saveSchedule(): void {
    if (this.individualScheduleSaving()) return;

    this.individualScheduleSaving.set(true);
    this.individualScheduleError.set(null);

    const cron = this.buildIndividualCronFromForm();
    const existing = this.existingIndividualSchedule();

    const request$ = existing
      ? this.reportService.updateIndividualSchedule(this.reportId(), {
          individual_cron: cron,
          timezone: this.individualTimezone(),
          data_period_days: this.individualDataPeriod()
        })
      : this.reportService.createIndividualSchedule(this.reportId(), {
          individual_cron: cron,
          timezone: this.individualTimezone(),
          data_period_days: this.individualDataPeriod()
        });

    request$.pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err: HttpErrorResponse) => {
        this.individualScheduleError.set('Не удалось сохранить индивидуальное расписание');
        this.individualScheduleSaving.set(false);
        return of(null);
      })
    ).subscribe(result => {
      if (result) {
        this.existingIndividualSchedule.set(result);
      }
      this.individualScheduleSaving.set(false);
    });
  }

  protected onUpdateStructure(): void {
    if (this.updating()) return;

    const confirmed = confirm('Вы уверены, что хотите обновить структуру отчёта?');
    if (!confirmed) return;

    this.updating.set(true);
    this.error.set(null);

    this.reportService.updateReportStructure(this.reportId()).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err: HttpErrorResponse) => {
        this.error.set('Не удалось обновить структуру отчёта');
        this.updating.set(false);
        return of(null);
      })
    ).subscribe(() => {
      this.updating.set(false);
      this.loadReport();
    });
  }

  protected onDeleteReport(): void {
    if (this.updating()) return;

    const rep = this.report();
    const confirmed = confirm(`Вы уверены, что хотите удалить отчёт "${rep?.name}"? Это действие необратимо.`);
    if (!confirmed) return;

    this.updating.set(true);
    this.error.set(null);

    this.reportService.deleteReport(this.reportId()).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err: HttpErrorResponse) => {
        this.error.set('Не удалось удалить отчёт');
        this.updating.set(false);
        return of(null);
      })
    ).subscribe(() => {
      this.updating.set(false);
      this.goBack();
    });
  }

  protected onSendToGroupsChange(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    const isChecked = checkbox.checked;
    this.sendToGroups.set(isChecked);

    if (isChecked) {
      this.loadLinkedChats();
    } else {
      this.selectedLinkedChatId.set(null);
      this.existingGroupSchedule.set(null);
    }
  }

  private loadLinkedChats(): void {
    const userId = this.userId() ?? this.authService.currentUser()?.id;
    if (!userId) {
      this.linkedChatsError.set('Пользователь не найден');
      return;
    }

    this.linkedChatsLoading.set(true);
    this.linkedChatsError.set(null);

    this.linkedChatsService.getLinkedChats(userId).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err: HttpErrorResponse) => {
        this.linkedChatsError.set('Не удалось загрузить список групп');
        this.linkedChatsLoading.set(false);
        return of([]);
      })
    ).subscribe(chats => {
      const activeChats = chats.filter(chat => chat.is_active);
      this.linkedChats.set(activeChats);
      this.linkedChatsLoading.set(false);

      if (activeChats.length > 0 && !this.selectedLinkedChatId()) {
        this.selectedLinkedChatId.set(activeChats[0].id);
        this.loadGroupSchedule();
      }
    });
  }

  protected onGroupChatChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const linkedChatId = parseInt(select.value, 10);
    if (!isNaN(linkedChatId)) {
      this.selectedLinkedChatId.set(linkedChatId);
      this.loadGroupSchedule();
    }
  }

  private loadGroupSchedule(): void {
    const linkedChatId = this.selectedLinkedChatId();
    if (!linkedChatId) return;

    this.groupScheduleLoading.set(true);
    this.groupScheduleError.set(null);

    this.reportService.getGroupSchedule(this.reportId(), linkedChatId).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err: HttpErrorResponse) => {
        if (err.status === 404) {
          this.existingGroupSchedule.set(null);
          this.groupScheduleLoading.set(false);
          return of(null);
        }
        this.groupScheduleError.set('Не удалось загрузить расписание для группы');
        this.groupScheduleLoading.set(false);
        return of(null);
      })
    ).subscribe(schedule => {
      if (schedule) {
        this.existingGroupSchedule.set(schedule);
        this.parseGroupCronToForm(schedule.group_cron);
        const matchedTimezone = TIMEZONE_CHOICES.find(
          tz => tz.value.toLowerCase() === schedule.timezone.toLowerCase()
        );
        this.groupTimezone.set(matchedTimezone?.value ?? 'Europe/Moscow');
        this.groupDataPeriod.set(schedule.data_period_days);
      }
      this.groupScheduleLoading.set(false);
    });
  }

  private parseGroupCronToForm(cron: string): void {
    const parts = cron.split(' ');
    if (parts.length < 5) return;

    const [minute, hour, dayOfMonth, , dayOfWeek] = parts;
    this.groupTime.set(`${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`);

    if (dayOfMonth !== '*' && dayOfMonth !== '?') {
      this.groupFrequency.set('monthly');
      this.groupDayOfMonth.set(dayOfMonth);
    } else if (dayOfWeek !== '*' && dayOfWeek !== '?') {
      this.groupFrequency.set('weekly');
      this.groupWeekday.set(parseInt(dayOfWeek, 10));
    } else {
      this.groupFrequency.set('daily');
    }
  }

  private buildGroupCronFromForm(): string {
    const [hour, minute] = this.groupTime().split(':');
    const freq = this.groupFrequency();

    if (freq === 'monthly') {
      const dayOfMonth = Math.min(31, Math.max(1, parseInt(this.groupDayOfMonth(), 10) || 1));
      return `${minute} ${hour} ${dayOfMonth} * *`;
    } else if (freq === 'weekly') {
      return `${minute} ${hour} * * ${this.groupWeekday()}`;
    }
    return `${minute} ${hour} * * *`;
  }

  protected onGroupFrequencyChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.groupFrequency.set(select.value as ScheduleFrequency);
  }

  protected onGroupTimezoneChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.groupTimezone.set(select.value);
  }

  protected onGroupTimeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.groupTime.set(input.value);
  }

  protected onGroupWeekdayChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.groupWeekday.set(parseInt(select.value, 10));
  }

  protected onGroupDayOfMonthChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    const validatedValue = Math.min(31, Math.max(1, value || 1));
    this.groupDayOfMonth.set(validatedValue.toString());
  }

  protected onGroupDataPeriodChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    // Validate range: 1-365 days
    if (!isNaN(value) && value >= 1 && value <= 365) {
      this.groupDataPeriod.set(value);
    }
  }

  protected saveGroupSchedule(): void {
    if (this.groupScheduleSaving()) return;

    const linkedChatId = this.selectedLinkedChatId();
    if (!linkedChatId) return;

    this.groupScheduleSaving.set(true);
    this.groupScheduleError.set(null);

    const cron = this.buildGroupCronFromForm();
    const existing = this.existingGroupSchedule();

    const request$ = existing
      ? this.reportService.updateGroupSchedule(this.reportId(), linkedChatId, {
          group_cron: cron,
          timezone: this.groupTimezone(),
          data_period_days: this.groupDataPeriod()
        })
      : this.reportService.createGroupSchedule(this.reportId(), linkedChatId, {
          group_cron: cron,
          timezone: this.groupTimezone(),
          data_period_days: this.groupDataPeriod()
        });

    request$.pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err: HttpErrorResponse) => {
        this.groupScheduleError.set('Не удалось сохранить расписание для группы');
        this.groupScheduleSaving.set(false);
        return of(null);
      })
    ).subscribe(result => {
      if (result) {
        this.existingGroupSchedule.set(result);
      }
      this.groupScheduleSaving.set(false);
    });
  }

  protected onFeatureRequest(): void {
    this.featureRequested.set(true);
    // Clear previous timeout if exists
    if (this.featureRequestTimeoutId !== undefined) {
      clearTimeout(this.featureRequestTimeoutId);
    }
    this.featureRequestTimeoutId = window.setTimeout(() => this.featureRequested.set(false), 3000);
  }

  ngOnDestroy(): void {
    // Clean up all timeouts
    if (this.featureRequestTimeoutId !== undefined) {
      clearTimeout(this.featureRequestTimeoutId);
    }
  }

  protected goBack(): void {
    if (this.userId()) {
      this.router.navigate(['/admin/users', this.userId(), 'databases', this.dbId(), 'reports']);
    } else {
      this.router.navigate(['/user/databases', this.dbId(), 'reports']);
    }
  }

  protected getFormatLabel(format: string | null): string {
    if (!format) return 'Не задано';
    return format.toUpperCase();
  }

  protected getDeliveryTypeLabel(deliveryType: string | null): string {
    if (!deliveryType) return 'Не задано';
    if (deliveryType === 'telegram') return 'Telegram';
    if (deliveryType === 'email') return 'Email';
    return deliveryType;
  }

  protected getScheduleTypeLabel(scheduleType: ScheduleType): string {
    if (!scheduleType) return 'Отключить';
    if (scheduleType === 'global') return 'Общее расписание';
    if (scheduleType === 'individual') return 'Индивидуальное расписание';
    return scheduleType;
  }
}
