import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, EMPTY, of } from 'rxjs';
import { ReportService } from '../../../core/api/report.service';
import { AuthService } from '../../../core/api/auth.service';
import { LicenseService } from '../../../core/api/license.service';
import { LinkedChatsService } from '../../../core/api/linked-chats.service';
import { OnboardingService } from '../../../core/services/onboarding.service';
import { LayoutUiService } from '../../../core/services/layout-ui.service';
import { License } from '../../../core/api/models/license.models';
import { DeliveryType, Report, ScheduleType, IndividualSchedule, GroupSchedule, GlobalSchedule, ScheduleFrequency, SCHEDULE_FREQUENCY_LABELS, TIMEZONE_CHOICES, WEEKDAY_LABELS } from '../../../core/api/models/report.models';
import { LinkedChat } from '../../../core/api/models/linked-chats.models';
import { describeCronSchedule, formatScheduleNextRun } from '../schedule-format.utils';

const DEFAULT_INDIVIDUAL_SCHEDULE_FORM = {
  frequency: 'daily' as ScheduleFrequency,
  timezone: 'Europe/Moscow',
  time: '13:00',
  weekday: 1,
  dayOfMonth: '1',
  dataPeriod: 7
};

const DEFAULT_GLOBAL_SCHEDULE_FORM = {
  frequency: 'daily' as ScheduleFrequency,
  timezone: 'Europe/Moscow',
  time: '13:00',
  weekday: 1,
  dayOfMonth: '1',
  dataPeriod: 7
};
const REPORT_SETTINGS_MODAL_NAV_REASON = 'report-settings-modal';

@Component({
  selector: 'app-report-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './report-settings.component.html',
  styleUrls: ['./report-settings.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportSettingsComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly reportService = inject(ReportService);
  private readonly authService = inject(AuthService);
  private readonly licenseService = inject(LicenseService);
  private readonly linkedChatsService = inject(LinkedChatsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hostElement = inject(ElementRef<HTMLElement>);
  protected readonly onboarding = inject(OnboardingService);
  private readonly layoutUi = inject(LayoutUiService);

  // Timeout IDs for cleanup
  private featureRequestTimeoutId?: number;

  protected readonly report = signal<Report | null>(null);
  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);
  protected readonly updating = signal<boolean>(false);
  protected readonly showFeatureRequest = signal<boolean>(false);
  protected readonly featureRequested = signal<boolean>(false);
  protected readonly saving = signal<boolean>(false);
  protected readonly scheduleFeatureLicense = signal<License | null>(null);
  protected readonly scheduleFeatureLicenseLoading = signal<boolean>(true);
  protected readonly scheduleFeatureLicenseError = signal<boolean>(false);

  private readonly reportId = signal<number>(0);
  private readonly dbId = signal<number>(0);
  private readonly userId = signal<number | null>(null);

  // Local state for selector values (not yet saved)
  protected readonly selectedFormat = signal<string>('pdf');
  protected readonly selectedDeliveryType = signal<DeliveryType>('telegram');
  protected readonly selectedScheduleType = signal<ScheduleType>(null);

  protected readonly showIndividualSchedule = computed(() => {
    return this.selectedScheduleType() === 'individual';
  });

  protected readonly showGlobalSchedule = computed(() => {
    return this.selectedScheduleType() === 'global';
  });

  protected readonly hasScheduleFeatureAccess = computed(() => (
    this.authService.isAdmin() || this.licenseService.hasProAccess(this.scheduleFeatureLicense())
  ));

  protected readonly scheduleFeatureDisabled = computed(() => !this.hasScheduleFeatureAccess());

  protected readonly scheduleFeatureUnavailableMessage = computed(() => {
    if (this.authService.isAdmin()) {
      return '';
    }

    if (this.scheduleFeatureLicenseLoading()) {
      return 'Проверяем лицензию...';
    }

    if (this.scheduleFeatureLicenseError()) {
      return 'Не удалось проверить лицензию. Выбор расписания доступен только с лицензией Pro.';
    }

    const plan = this.scheduleFeatureLicense()?.plan;
    return plan
      ? `Недоступно на лицензии ${plan}. Требуется лицензия Pro.`
      : 'Выбор расписания доступен только с лицензией Pro.';
  });

  // Individual schedule state
  protected readonly globalScheduleLoading = signal<boolean>(false);
  protected readonly globalScheduleError = signal<string | null>(null);
  protected readonly globalSchedule = signal<GlobalSchedule | null>(null);
  protected readonly showGlobalScheduleModal = signal<boolean>(false);
  protected readonly globalScheduleSaving = signal<boolean>(false);
  protected readonly globalFrequency = signal<ScheduleFrequency>('daily');
  protected readonly globalTimezone = signal<string>('Europe/Moscow');
  protected readonly globalTime = signal<string>('13:00');
  protected readonly globalWeekday = signal<number>(1);
  protected readonly globalDayOfMonth = signal<string>('1');
  protected readonly globalDataPeriod = signal<number>(7);
  protected readonly globalScheduleSummary = computed(() => {
    const schedule = this.globalSchedule();
    if (!schedule) {
      return 'Общее расписание ещё не настроено';
    }

    return describeCronSchedule(schedule.global_cron, schedule.timezone, schedule.data_period_days);
  });
  protected readonly globalScheduleNextRun = computed(() => {
    const schedule = this.globalSchedule();
    if (!schedule) {
      return 'Не запланирована';
    }

    return formatScheduleNextRun(schedule.next_run_at, schedule.timezone);
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
  protected readonly deliveryTypeOptions: ReadonlyArray<{ value: DeliveryType; label: string }> = [
    { value: 'telegram', label: 'Telegram' },
    { value: 'email', label: 'Email' },
    { value: 'vk', label: 'ВКонтакте' }
  ];
  protected readonly timezoneOptions = TIMEZONE_CHOICES;
  protected readonly weekdayOptions = [1, 2, 3, 4, 5, 6, 0].map(d => ({ value: d, label: WEEKDAY_LABELS[d] }));

  // Default delivery type based on user's telegram_id
  private readonly defaultDeliveryType = computed<DeliveryType>(() => {
    const user = this.authService.currentUser();
    return user?.telegram_id ? 'telegram' : 'email';
  });

  protected readonly hasUnsavedChanges = computed(() => {
    const rep = this.report();
    if (!rep) return false;
    const scheduleTypeChanged = !this.scheduleFeatureDisabled() && this.selectedScheduleType() !== rep.schedule_type;

    return (
      this.selectedFormat() !== (rep.format || 'pdf') ||
      this.selectedDeliveryType() !== this.normalizeDeliveryType(rep.delivery_type) ||
      scheduleTypeChanged
    );
  });

  @ViewChild('mainSettingsBlock')
  private mainSettingsBlock?: ElementRef<HTMLElement>;

  @ViewChild('updateStructureButton')
  private updateStructureButton?: ElementRef<HTMLButtonElement>;

  private lastHandledOnboardingActivation = 0;

  private readonly onboardingTargetEffect = effect(() => {
    if (!this.onboarding.active()) {
      return;
    }

    const stepId = this.onboarding.step().id;

    if (stepId === 'report_settings_overview') {
      this.scheduleMainSettingsTargetUpdate();
    }

    if (stepId === 'update_report_structure') {
      this.scheduleUpdateStructureTargetUpdate();
    }
  });

  private readonly onboardingActivationEffect = effect(() => {
    const activationVersion = this.onboarding.targetActivation();
    const activationStep = this.onboarding.targetActivationStep();
    const stepId = this.onboarding.step().id;

    if (
      activationVersion === 0 ||
      activationVersion === this.lastHandledOnboardingActivation ||
      !this.onboarding.active() ||
      activationStep !== stepId
    ) {
      return;
    }

    this.lastHandledOnboardingActivation = activationVersion;

    if (stepId === 'report_settings_overview') {
      this.onboarding.next();
      return;
    }

    if (stepId === 'update_report_structure') {
      this.openProfileStep();
    }
  });

  ngOnInit(): void {
    this.loadScheduleFeatureLicense();

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

  private loadScheduleFeatureLicense(): void {
    if (this.authService.isAdmin()) {
      this.scheduleFeatureLicenseLoading.set(false);
      return;
    }

    const currentUserId = this.authService.currentUser()?.id;
    if (!currentUserId) {
      this.scheduleFeatureLicenseLoading.set(false);
      this.scheduleFeatureLicenseError.set(true);
      return;
    }

    this.scheduleFeatureLicenseLoading.set(true);
    this.scheduleFeatureLicenseError.set(false);

    this.licenseService.getLicenseByUserId(currentUserId).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(() => {
        this.scheduleFeatureLicense.set(null);
        this.scheduleFeatureLicenseError.set(true);
        this.scheduleFeatureLicenseLoading.set(false);
        return of(null);
      })
    ).subscribe(license => {
      this.scheduleFeatureLicense.set(license);
      this.scheduleFeatureLicenseLoading.set(false);
    });
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
        this.selectedDeliveryType.set(this.normalizeDeliveryType(report.delivery_type));
        this.selectedScheduleType.set(report.schedule_type);
        this.loading.set(false);
        this.openReportSettingsOnboardingAfterLoad();
        this.scheduleCurrentOnboardingTargetUpdate();

        // Load individual schedule if schedule_type is 'individual'
        if (report.schedule_type === 'individual') {
          this.loadIndividualSchedule();
        }

        if (report.schedule_type === 'global') {
          this.loadGlobalSchedule();
        }
      }
    });
  }

  protected retry(): void {
    this.loadReport();
  }

  ngAfterViewInit(): void {
    this.scheduleCurrentOnboardingTargetUpdate();
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.scheduleCurrentOnboardingTargetUpdate();
  }

  private scheduleCurrentOnboardingTargetUpdate(): void {
    const stepId = this.onboarding.step().id;

    if (stepId === 'report_settings_overview') {
      this.scheduleMainSettingsTargetUpdate();
    }

    if (stepId === 'update_report_structure') {
      this.scheduleUpdateStructureTargetUpdate();
    }
  }

  private openReportSettingsOnboardingAfterLoad(): void {
    if (this.onboarding.active() || this.onboarding.step().id !== 'configure_report') {
      return;
    }

    window.setTimeout(() => {
      if (!this.report()) {
        return;
      }

      this.onboarding.openAtStep('report_settings_overview');
    });
  }

  private updateMainSettingsTargetRect(): void {
    if (!this.onboarding.active() || this.onboarding.step().id !== 'report_settings_overview') {
      return;
    }

    const block = this.getMainSettingsBlock();
    if (!block) {
      this.clearOnboardingTarget();
      return;
    }

    const padding = 6;
    const rect = block.getBoundingClientRect();
    this.onboarding.setTargetRect({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2
    });
    this.onboarding.setSecondaryTargetRect(null);
    this.setGuidePositionForRect(rect, window.innerWidth <= 900 ? 340 : 210);
  }

  private scheduleMainSettingsTargetUpdate(): void {
    window.setTimeout(() => this.updateMainSettingsTargetRect());
    window.requestAnimationFrame(() => this.updateMainSettingsTargetRect());
    window.setTimeout(() => this.updateMainSettingsTargetRect(), 80);
  }

  private updateUpdateStructureTargetRect(): void {
    if (!this.onboarding.active() || this.onboarding.step().id !== 'update_report_structure') {
      return;
    }

    const button = this.getUpdateStructureButton();
    if (!button) {
      this.clearOnboardingTarget();
      return;
    }

    const padding = 4;
    const rect = button.getBoundingClientRect();
    this.onboarding.setTargetRect({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2
    });
    this.onboarding.setSecondaryTargetRect(null);
    this.setGuidePositionForRect(rect, 220);
  }

  private scheduleUpdateStructureTargetUpdate(): void {
    window.setTimeout(() => this.updateUpdateStructureTargetRect());
    window.requestAnimationFrame(() => this.updateUpdateStructureTargetRect());
    window.setTimeout(() => this.updateUpdateStructureTargetRect(), 80);
  }

  private openProfileStep(): void {
    this.onboarding.close();

    this.router.navigateByUrl('/user/databases').then(navigated => {
      if (navigated || this.router.url.split(/[?#]/)[0] === '/user/databases') {
        window.setTimeout(() => this.onboarding.openAtStep('go_to_profile'), 120);
      }
    });
  }

  private getMainSettingsBlock(): HTMLElement | null {
    return this.mainSettingsBlock?.nativeElement
      ?? this.hostElement.nativeElement.querySelector('[data-onboarding-target="report-settings-overview"]') as HTMLElement | null;
  }

  private getUpdateStructureButton(): HTMLButtonElement | null {
    return this.updateStructureButton?.nativeElement
      ?? this.hostElement.nativeElement.querySelector('[data-onboarding-target="update-structure"]') as HTMLButtonElement | null;
  }

  private clearOnboardingTarget(): void {
    this.onboarding.setTargetRect(null);
    this.onboarding.setSecondaryTargetRect(null);
    this.onboarding.setGuidePosition(null);
  }

  private setGuidePositionForRect(rect: DOMRect, cardHeight: number): void {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const isCompactViewport = viewportWidth <= 900;
    const spacing = isCompactViewport ? 18 : 28;
    const safeTop = isCompactViewport ? 12 : 24;
    const safeBottom = isCompactViewport ? 96 : 24;
    const adjustedCardHeight = isCompactViewport ? Math.min(cardHeight, 340) : cardHeight;
    const desktopTopSpacing = 42;
    const effectiveSpacing = !isCompactViewport && rect.top - spacing - adjustedCardHeight >= safeTop
      ? desktopTopSpacing
      : spacing;
    const hasRoomBelow = rect.bottom + spacing + adjustedCardHeight <= viewportHeight - safeBottom;
    const preferredTop = hasRoomBelow
      ? rect.bottom + effectiveSpacing
      : rect.top - effectiveSpacing - adjustedCardHeight;

    this.onboarding.setGuidePosition({
      top: Math.max(safeTop, Math.min(preferredTop, viewportHeight - safeBottom - adjustedCardHeight)),
      width: Math.min(viewportWidth - (isCompactViewport ? 28 : 40), 520)
    });
  }

  protected onFormatChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const format = select.value;
    this.selectedFormat.set(format);
  }

  protected onDeliveryTypeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const deliveryType = this.normalizeDeliveryType(select.value);

    this.selectedDeliveryType.set(deliveryType);

    // Автоматически сохраняем изменение delivery_type
    this.saveDeliveryType();
  }

  private saveDeliveryType(): void {
    if (this.saving()) return;

    const rep = this.report();
    if (!rep) return;

    // Проверяем, изменился ли delivery_type
    const currentDeliveryType = this.normalizeDeliveryType(rep.delivery_type);
    if (this.selectedDeliveryType() === currentDeliveryType) return;

    this.saving.set(true);
    this.error.set(null);

    const update = {
      format: this.selectedFormat(),
      delivery_type: this.selectedDeliveryType(),
      schedule_type: this.getScheduleTypeForUpdate(rep)
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
        this.report.set({
          ...updatedReport,
          delivery_type: this.selectedDeliveryType()
        });
        // Синхронизируем локальное состояние с ответом сервера
        this.selectedDeliveryType.set(this.normalizeDeliveryType(this.selectedDeliveryType()));
      }
      this.saving.set(false);
    });
  }

  protected onScheduleTypeChange(event: Event): void {
    if (this.scheduleFeatureDisabled()) {
      return;
    }

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

    if (scheduleType === 'global') {
      this.loadGlobalSchedule();
    }
  }

  protected saveSettings(): void {
    if (this.saving() || !this.hasUnsavedChanges()) return;

    const rep = this.report();
    if (!rep) return;

    this.saving.set(true);
    this.error.set(null);

    const update = {
      format: this.selectedFormat(),
      delivery_type: this.selectedDeliveryType(),
      schedule_type: this.getScheduleTypeForUpdate(rep)
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
        const normalizedDeliveryType = this.normalizeDeliveryType(updatedReport.delivery_type);
        this.report.set({
          ...updatedReport,
          delivery_type: normalizedDeliveryType
        });
        // Sync local state with server response
        this.selectedFormat.set(updatedReport.format || 'pdf');
        // Use user-specific default delivery type if report has none
        this.selectedDeliveryType.set(normalizedDeliveryType);
        this.selectedScheduleType.set(updatedReport.schedule_type);
        if (updatedReport.schedule_type === 'global') {
          this.loadGlobalSchedule();
        }
      }
      this.saving.set(false);
    });
  }

  private getScheduleTypeForUpdate(report: Report): ScheduleType {
    return this.scheduleFeatureDisabled()
      ? report.schedule_type
      : this.selectedScheduleType();
  }

  protected openGlobalScheduleSettings(): void {
    if (this.scheduleFeatureDisabled()) {
      return;
    }

    this.showGlobalScheduleModal.set(true);
    this.layoutUi.setMobileNavHidden(REPORT_SETTINGS_MODAL_NAV_REASON, true);
    this.loadGlobalSchedule();
  }

  protected closeGlobalScheduleModal(): void {
    this.showGlobalScheduleModal.set(false);
    this.layoutUi.setMobileNavHidden(REPORT_SETTINGS_MODAL_NAV_REASON, false);
    this.globalScheduleError.set(null);
    this.resetGlobalScheduleForm();
  }

  private loadGlobalSchedule(): void {
    if (!this.dbId()) {
      this.globalScheduleError.set('База не найдена');
      return;
    }

    this.globalScheduleLoading.set(true);
    this.globalScheduleError.set(null);

    this.reportService.getGlobalSchedule(this.dbId()).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err: HttpErrorResponse) => {
        this.globalSchedule.set(null);
        this.resetGlobalScheduleForm();
        this.globalScheduleLoading.set(false);

        if (err.status === 404) {
          return of(null);
        }

        this.globalScheduleError.set('Не удалось загрузить общее расписание');
        return of(null);
      })
    ).subscribe(schedule => {
      if (schedule) {
        this.applyGlobalScheduleToForm(schedule);
      }

      this.globalScheduleLoading.set(false);
    });
  }

  private applyGlobalScheduleToForm(schedule: GlobalSchedule): void {
    this.globalSchedule.set(schedule);
    this.parseGlobalCronToForm(schedule.global_cron);
    const matchedTimezone = TIMEZONE_CHOICES.find(
      tz => tz.value.toLowerCase() === schedule.timezone.toLowerCase()
    );
    this.globalTimezone.set(matchedTimezone?.value ?? DEFAULT_GLOBAL_SCHEDULE_FORM.timezone);
    this.globalDataPeriod.set(schedule.data_period_days);
  }

  private resetGlobalScheduleForm(): void {
    this.globalFrequency.set(DEFAULT_GLOBAL_SCHEDULE_FORM.frequency);
    this.globalTimezone.set(DEFAULT_GLOBAL_SCHEDULE_FORM.timezone);
    this.globalTime.set(DEFAULT_GLOBAL_SCHEDULE_FORM.time);
    this.globalWeekday.set(DEFAULT_GLOBAL_SCHEDULE_FORM.weekday);
    this.globalDayOfMonth.set(DEFAULT_GLOBAL_SCHEDULE_FORM.dayOfMonth);
    this.globalDataPeriod.set(DEFAULT_GLOBAL_SCHEDULE_FORM.dataPeriod);
  }

  private parseGlobalCronToForm(cron: string): void {
    const parts = cron.split(' ');
    if (parts.length < 5) return;

    const [minute, hour, dayOfMonth, , dayOfWeek] = parts;
    this.globalTime.set(`${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`);

    if (dayOfMonth !== '*' && dayOfMonth !== '?') {
      this.globalFrequency.set('monthly');
      this.globalDayOfMonth.set(dayOfMonth);
    } else if (dayOfWeek !== '*' && dayOfWeek !== '?') {
      this.globalFrequency.set('weekly');
      this.globalWeekday.set(parseInt(dayOfWeek, 10));
    } else {
      this.globalFrequency.set('daily');
    }
  }

  private buildGlobalCronFromForm(): string {
    const [hour, minute] = this.globalTime().split(':');
    const freq = this.globalFrequency();

    if (freq === 'monthly') {
      const dayOfMonth = Math.min(31, Math.max(1, parseInt(this.globalDayOfMonth(), 10) || 1));
      return `${minute} ${hour} ${dayOfMonth} * *`;
    } else if (freq === 'weekly') {
      return `${minute} ${hour} * * ${this.globalWeekday()}`;
    }

    return `${minute} ${hour} * * *`;
  }

  protected onGlobalFrequencyValueChange(value: string): void {
    this.globalFrequency.set(value as ScheduleFrequency);
  }

  protected onGlobalTimezoneValueChange(value: string): void {
    this.globalTimezone.set(value);
  }

  protected onGlobalTimeValueChange(value: string): void {
    this.globalTime.set(value);
  }

  protected onGlobalWeekdayValueChange(value: number): void {
    this.globalWeekday.set(value);
  }

  protected onGlobalDayOfMonthValueChange(value: string | number | null): void {
    const parsedValue = parseInt(String(value ?? ''), 10);
    const validatedValue = Math.min(31, Math.max(1, parsedValue || 1));
    this.globalDayOfMonth.set(validatedValue.toString());
  }

  protected onGlobalDataPeriodValueChange(value: string | number | null): void {
    const parsedValue = parseInt(String(value ?? ''), 10);
    if (!isNaN(parsedValue) && parsedValue >= 1 && parsedValue <= 365) {
      this.globalDataPeriod.set(parsedValue);
    }
  }

  protected saveGlobalSchedule(): void {
    if (this.globalScheduleSaving() || this.scheduleFeatureDisabled()) {
      return;
    }

    this.globalScheduleSaving.set(true);
    this.globalScheduleError.set(null);

    const payload = {
      global_cron: this.buildGlobalCronFromForm(),
      timezone: this.globalTimezone(),
      data_period_days: this.globalDataPeriod()
    };
    const existing = this.globalSchedule();
    const request$ = existing
      ? this.reportService.updateGlobalSchedule(this.dbId(), payload)
      : this.reportService.createGlobalSchedule(this.dbId(), payload);

    request$.pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err: HttpErrorResponse) => {
        this.globalScheduleError.set('Не удалось сохранить общее расписание');
        this.globalScheduleSaving.set(false);
        return of(null);
      })
    ).subscribe(schedule => {
      if (schedule) {
        this.applyGlobalScheduleToForm(schedule);
        this.showGlobalScheduleModal.set(false);
        this.layoutUi.setMobileNavHidden(REPORT_SETTINGS_MODAL_NAV_REASON, false);
      }

      this.globalScheduleSaving.set(false);
    });
  }

  private loadIndividualSchedule(): void {
    this.individualScheduleLoading.set(true);
    this.individualScheduleError.set(null);
    this.existingIndividualSchedule.set(null);
    this.resetIndividualScheduleForm();

    this.reportService.getIndividualSchedule(this.reportId()).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err: HttpErrorResponse) => {
        if (err.status === 404) {
          this.existingIndividualSchedule.set(null);
          this.resetIndividualScheduleForm();
          this.individualScheduleLoading.set(false);
          return of(null);
        }
        this.individualScheduleError.set('Не удалось загрузить индивидуальное расписание');
        this.individualScheduleLoading.set(false);
        return of(null);
      })
    ).subscribe(schedule => {
      if (schedule) {
        this.applyIndividualScheduleToForm(schedule);
      }
      this.individualScheduleLoading.set(false);
    });
  }

  private applyIndividualScheduleToForm(schedule: IndividualSchedule): void {
    this.existingIndividualSchedule.set(schedule);
    this.parseIndividualCronToForm(schedule.individual_cron);
    const matchedTimezone = TIMEZONE_CHOICES.find(
      tz => tz.value.toLowerCase() === schedule.timezone.toLowerCase()
    );
    this.individualTimezone.set(matchedTimezone?.value ?? DEFAULT_INDIVIDUAL_SCHEDULE_FORM.timezone);
    this.individualDataPeriod.set(schedule.data_period_days);
  }

  private resetIndividualScheduleForm(): void {
    this.individualFrequency.set(DEFAULT_INDIVIDUAL_SCHEDULE_FORM.frequency);
    this.individualTimezone.set(DEFAULT_INDIVIDUAL_SCHEDULE_FORM.timezone);
    this.individualTime.set(DEFAULT_INDIVIDUAL_SCHEDULE_FORM.time);
    this.individualWeekday.set(DEFAULT_INDIVIDUAL_SCHEDULE_FORM.weekday);
    this.individualDayOfMonth.set(DEFAULT_INDIVIDUAL_SCHEDULE_FORM.dayOfMonth);
    this.individualDataPeriod.set(DEFAULT_INDIVIDUAL_SCHEDULE_FORM.dataPeriod);
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
    this.onIndividualFrequencyValueChange(select.value);
  }

  protected onIndividualFrequencyValueChange(value: string): void {
    this.individualFrequency.set(value as ScheduleFrequency);
  }

  protected onIndividualTimezoneChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.onIndividualTimezoneValueChange(select.value);
  }

  protected onIndividualTimezoneValueChange(value: string): void {
    this.individualTimezone.set(value);
  }

  protected onIndividualTimeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.onIndividualTimeValueChange(input.value);
  }

  protected onIndividualTimeValueChange(value: string): void {
    this.individualTime.set(value);
  }

  protected onIndividualWeekdayChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.onIndividualWeekdayValueChange(parseInt(select.value, 10));
  }

  protected onIndividualWeekdayValueChange(value: number): void {
    this.individualWeekday.set(value);
  }

  protected onIndividualDayOfMonthChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.onIndividualDayOfMonthValueChange(input.value);
  }

  protected onIndividualDayOfMonthValueChange(value: string | number | null): void {
    const parsedValue = parseInt(String(value ?? ''), 10);
    // Validate day of month (1-31)
    const validatedValue = Math.min(31, Math.max(1, parsedValue || 1));
    this.individualDayOfMonth.set(validatedValue.toString());
  }

  protected onIndividualDataPeriodChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.onIndividualDataPeriodValueChange(input.value);
  }

  protected onIndividualDataPeriodValueChange(value: string | number | null): void {
    const parsedValue = parseInt(String(value ?? ''), 10);
    // Validate range: 1-365 days
    if (!isNaN(parsedValue) && parsedValue >= 1 && parsedValue <= 365) {
      this.individualDataPeriod.set(parsedValue);
    }
  }

  protected saveSchedule(): void {
    if (this.individualScheduleSaving() || this.scheduleFeatureDisabled()) return;

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
        return EMPTY;
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
        return EMPTY;
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
    this.layoutUi.setMobileNavHidden(REPORT_SETTINGS_MODAL_NAV_REASON, false);

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
    if (!deliveryType) {
      return 'Не задано';
    }
    return this.getDeliveryTypeOption(this.normalizeDeliveryType(deliveryType)).label;
  }

  private normalizeDeliveryType(deliveryType: string | null): DeliveryType {
    const normalized = deliveryType?.trim().toLowerCase();

    if (!normalized) {
      return this.defaultDeliveryType();
    }

    if (normalized === 'vk' || normalized === 'vkontakte' || normalized === 'вк' || normalized === 'вконтакте') {
      return 'vk';
    }

    if (normalized === 'telegram' || normalized === 'tg') {
      return 'telegram';
    }

    if (normalized === 'email' || normalized === 'mail') {
      return 'email';
    }

    return this.defaultDeliveryType();
  }

  private getDeliveryTypeOption(deliveryType: DeliveryType): { value: DeliveryType; label: string } {
    return this.deliveryTypeOptions.find(option => option.value === deliveryType)
      ?? this.deliveryTypeOptions[0];
  }

  protected getScheduleTypeLabel(scheduleType: ScheduleType): string {
    if (!scheduleType) return 'Отключить';
    if (scheduleType === 'global') return 'Общее расписание';
    if (scheduleType === 'individual') return 'Индивидуальное расписание';
    return scheduleType;
  }
}
