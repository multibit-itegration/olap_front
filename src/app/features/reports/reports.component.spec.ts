import { TestBed } from '@angular/core/testing';
import { ReportsComponent } from './reports.component';
import { ReportService } from '../../core/api/report.service';
import { AuthService } from '../../core/api/auth.service';
import { LicenseService } from '../../core/api/license.service';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { Report, GlobalSchedule } from '../../core/api/models/report.models';
import { User } from '../../core/api/models/user.models';
import { License } from '../../core/api/models/license.models';

describe('ReportsComponent', () => {
  let component: ReportsComponent;
  let reportServiceSpy: jasmine.SpyObj<ReportService>;
  let licenseServiceSpy: jasmine.SpyObj<LicenseService>;
  let routerSpy: jasmine.SpyObj<Router>;

  const mockUser: User = {
    id: 5,
    name: 'Test User',
    phone: '+79001234567',
    email: 'test@example.com',
    telegram_id: 123456789,
    role: 'user'
  };

  const mockProLicense: License = {
    id: 1,
    user_id: 5,
    rms_id: null,
    contract_num: null,
    expiration_date: '2026-12-31',
    comment: null,
    plan: 'Pro'
  };

  const mockFreeLicense: License = {
    ...mockProLicense,
    plan: 'Free'
  };

  const mockReports: Report[] = [
    {
      id: 1,
      iiko_connection_id: 10,
      user_id: 5,
      iiko_report_id: 'report-123',
      delivery_type: 'telegram',
      address: '@test_channel',
      format: 'xlsx',
      iiko_report_structure: '{"columns": []}',
      report_type: 'SALES',
      name: 'Test Sales Report',
      schedule_type: 'individual',
      created_at: '2026-01-01T00:00:00Z'
    },
    {
      id: 2,
      iiko_connection_id: 10,
      user_id: 5,
      iiko_report_id: 'report-456',
      delivery_type: null,
      address: null,
      format: 'pdf',
      iiko_report_structure: null,
      report_type: 'STOCK',
      name: 'Test Stock Report',
      schedule_type: 'global',
      created_at: '2026-01-02T00:00:00Z'
    },
    {
      id: 3,
      iiko_connection_id: 10,
      user_id: 5,
      iiko_report_id: 'report-789',
      delivery_type: 'telegram',
      address: '@test',
      format: 'csv',
      iiko_report_structure: null,
      report_type: 'TRANSACTIONS',
      name: 'Test Transactions Report',
      schedule_type: null,
      created_at: '2026-01-03T00:00:00Z'
    }
  ];

  const mockGlobalSchedule: GlobalSchedule = {
    id: 1,
    user_id: 5,
    iiko_connection_id: 10,
    global_cron: '0 13 * * *',
    timezone: 'Europe/Moscow',
    data_period_days: 7,
    next_run_at: '2026-03-20T13:00:00Z'
  };

  function configureTestingModule(routeParams: { [key: string]: string }) {
    const reportSpy = jasmine.createSpyObj('ReportService', [
      'getReportsByConnectionId',
      'getIikoReports',
      'createReports',
      'getGlobalSchedule',
      'createGlobalSchedule',
      'updateGlobalSchedule'
    ]);
    const authSpy = jasmine.createSpyObj('AuthService', ['loadCurrentUser'], {
      currentUser: signal(mockUser),
      isAdmin: signal(false)
    });
    const licenseSpy = jasmine.createSpyObj('LicenseService', ['getLicenseByUserId', 'hasProAccess']);
    licenseSpy.getLicenseByUserId.and.returnValue(of(mockProLicense));
    licenseSpy.hasProAccess.and.callFake((license: License | null) => license?.plan === 'Pro');
    reportSpy.getGlobalSchedule.and.returnValue(of(mockGlobalSchedule));
    const routerSpyObj = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      imports: [ReportsComponent],
      providers: [
        provideRouter([]),
        { provide: ReportService, useValue: reportSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: LicenseService, useValue: licenseSpy },
        { provide: Router, useValue: routerSpyObj },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap(routeParams) },
            paramMap: of(convertToParamMap(routeParams))
          }
        }
      ]
    });

    reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
    licenseServiceSpy = TestBed.inject(LicenseService) as jasmine.SpyObj<LicenseService>;
    routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
  }

  describe('Component creation and initialization', () => {
    it('should create', () => {
      configureTestingModule({ dbId: '10' });
      component = TestBed.createComponent(ReportsComponent).componentInstance;
      expect(component).toBeTruthy();
    });
  });

  describe('Schedule status badge', () => {
    beforeEach(() => {
      configureTestingModule({ dbId: '10' });
      reportServiceSpy.getReportsByConnectionId.and.returnValue(of(mockReports));
    });

    it('should return "Рассылка откл." for null schedule_type', () => {
      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const text = component['getScheduleStatusText'](null);
      expect(text).toBe('Рассылка откл.');
    });

    it('should return "Общая рассылка" for global schedule_type', () => {
      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const text = component['getScheduleStatusText']('global');
      expect(text).toBe('Общая рассылка');
    });

    it('should return "Инд. рассылка" for individual schedule_type', () => {
      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const text = component['getScheduleStatusText']('individual');
      expect(text).toBe('Инд. рассылка');
    });

    it('should return "Не задано" for unknown schedule_type', () => {
      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const text = component['getScheduleStatusText']('unknown');
      expect(text).toBe('Не задано');
    });
  });

  describe('Schedule status CSS class', () => {
    beforeEach(() => {
      configureTestingModule({ dbId: '10' });
      reportServiceSpy.getReportsByConnectionId.and.returnValue(of(mockReports));
    });

    it('should return "status-disabled" for null schedule_type', () => {
      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const cssClass = component['getScheduleStatusClass'](null);
      expect(cssClass).toBe('status-disabled');
    });

    it('should return "status-global" for global schedule_type', () => {
      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const cssClass = component['getScheduleStatusClass']('global');
      expect(cssClass).toBe('status-global');
    });

    it('should return "status-individual" for individual schedule_type', () => {
      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const cssClass = component['getScheduleStatusClass']('individual');
      expect(cssClass).toBe('status-individual');
    });

    it('should return "status-disabled" for unknown schedule_type', () => {
      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const cssClass = component['getScheduleStatusClass']('unknown');
      expect(cssClass).toBe('status-disabled');
    });
  });

  describe('Global schedule modal', () => {
    beforeEach(() => {
      configureTestingModule({ dbId: '10' });
      reportServiceSpy.getReportsByConnectionId.and.returnValue(of(mockReports));
    });

    it('should show global schedule details on global report cards', (done) => {
      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        fixture.detectChanges();
        const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

        expect(reportServiceSpy.getGlobalSchedule).toHaveBeenCalledWith(10);
        expect(text).toContain('Следующая отправка:');
        expect(text).toContain('Ежедневно в 13:00');
        expect(text).toContain('Изменить расписание');
        done();
      });
    });

    it('should open schedule modal and load global schedule', (done) => {
      reportServiceSpy.getGlobalSchedule.and.returnValue(of(mockGlobalSchedule));

      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['onScheduleSettings']();
        expect(component['showScheduleModal']()).toBe(true);

        setTimeout(() => {
          expect(reportServiceSpy.getGlobalSchedule).toHaveBeenCalledWith(10);
          expect(component['existingSchedule']()).toEqual(mockGlobalSchedule);
          done();
        });
      });
    });

    it('should keep global schedule disabled for free users', (done) => {
      licenseServiceSpy.getLicenseByUserId.and.returnValue(of(mockFreeLicense));

      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        expect(component['scheduleFeatureDisabled']()).toBeTrue();
        component['onScheduleSettings']();

        expect(component['showScheduleModal']()).toBeFalse();
        expect(reportServiceSpy.getGlobalSchedule).not.toHaveBeenCalled();
        expect((fixture.nativeElement as HTMLElement).textContent).toContain(
          'Недоступно на лицензии Free. Требуется лицензия Pro.'
        );
        done();
      });
    });

    it('should handle 404 when global schedule does not exist', (done) => {
      const error = new HttpErrorResponse({ status: 404, statusText: 'Not Found' });
      reportServiceSpy.getGlobalSchedule.and.returnValue(throwError(() => error));

      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['onScheduleSettings']();

        setTimeout(() => {
          expect(component['existingSchedule']()).toBeNull();
          expect(component['scheduleLoading']()).toBe(false);
          done();
        });
      });
    });

    it('should handle error when loading global schedule fails', (done) => {
      const error = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });
      reportServiceSpy.getGlobalSchedule.and.returnValue(throwError(() => error));

      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['onScheduleSettings']();

        setTimeout(() => {
          expect(component['scheduleError']()).toBe('Не удалось загрузить расписание');
          done();
        });
      });
    });

    it('should normalize timezone (case-insensitive)', (done) => {
      const scheduleWithUpperTimezone = { ...mockGlobalSchedule, timezone: 'EUROPE/MOSCOW' };
      reportServiceSpy.getGlobalSchedule.and.returnValue(of(scheduleWithUpperTimezone));

      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['onScheduleSettings']();

        setTimeout(() => {
          expect(component['scheduleTimezone']()).toBe('Europe/Moscow');
          done();
        });
      });
    });

    it('should render loaded schedule values in form selects', (done) => {
      const loadedSchedule: GlobalSchedule = {
        ...mockGlobalSchedule,
        global_cron: '00 14 * * 3',
        timezone: 'Europe/Moscow',
        data_period_days: 5
      };
      reportServiceSpy.getGlobalSchedule.and.returnValue(of(loadedSchedule));

      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['onScheduleSettings']();
        fixture.detectChanges();

        setTimeout(() => {
          fixture.detectChanges();

          const selects = fixture.nativeElement.querySelectorAll('select.schedule-select') as NodeListOf<HTMLSelectElement>;
          const dataPeriodInput = fixture.nativeElement.querySelector('input[type="number"]') as HTMLInputElement;
          const timeInput = fixture.nativeElement.querySelector('input[type="time"]') as HTMLInputElement;

          expect(selects[0].selectedOptions[0].textContent?.trim()).toBe('Еженедельно');
          expect(selects[1].selectedOptions[0].textContent?.trim()).toBe('Москва (UTC+3)');
          expect(selects[2].selectedOptions[0].textContent?.trim()).toBe('Среда');
          expect(dataPeriodInput.value).toBe('5');
          expect(timeInput.value).toBe('14:00');
          done();
        });
      });
    });

    it('should fallback to Europe/Moscow when timezone not found', (done) => {
      const scheduleWithUnknownTimezone = { ...mockGlobalSchedule, timezone: 'Unknown/Timezone' };
      reportServiceSpy.getGlobalSchedule.and.returnValue(of(scheduleWithUnknownTimezone));

      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['onScheduleSettings']();

        setTimeout(() => {
          expect(component['scheduleTimezone']()).toBe('Europe/Moscow');
          done();
        });
      });
    });
  });

  describe('CRON parsing', () => {
    beforeEach(() => {
      configureTestingModule({ dbId: '10' });
      reportServiceSpy.getReportsByConnectionId.and.returnValue(of(mockReports));
    });

    it('should parse daily cron expression', (done) => {
      const dailySchedule = { ...mockGlobalSchedule, global_cron: '0 13 * * *' };
      reportServiceSpy.getGlobalSchedule.and.returnValue(of(dailySchedule));

      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['onScheduleSettings']();

        setTimeout(() => {
          expect(component['scheduleFrequency']()).toBe('daily');
          expect(component['scheduleTime']()).toBe('13:00');
          done();
        });
      });
    });

    it('should parse weekly cron expression', (done) => {
      const weeklySchedule = { ...mockGlobalSchedule, global_cron: '30 14 * * 1' };
      reportServiceSpy.getGlobalSchedule.and.returnValue(of(weeklySchedule));

      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['onScheduleSettings']();

        setTimeout(() => {
          expect(component['scheduleFrequency']()).toBe('weekly');
          expect(component['scheduleTime']()).toBe('14:30');
          expect(component['scheduleWeekday']()).toBe(1);
          done();
        });
      });
    });

    it('should parse monthly cron expression', (done) => {
      const monthlySchedule = { ...mockGlobalSchedule, global_cron: '0 9 15 * *' };
      reportServiceSpy.getGlobalSchedule.and.returnValue(of(monthlySchedule));

      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['onScheduleSettings']();

        setTimeout(() => {
          expect(component['scheduleFrequency']()).toBe('monthly');
          expect(component['scheduleTime']()).toBe('09:00');
          expect(component['scheduleDayOfMonth']()).toBe('15');
          done();
        });
      });
    });

    it('should handle cron with single-digit hour and minute', (done) => {
      const schedule = { ...mockGlobalSchedule, global_cron: '5 7 * * *' };
      reportServiceSpy.getGlobalSchedule.and.returnValue(of(schedule));

      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['onScheduleSettings']();

        setTimeout(() => {
          expect(component['scheduleTime']()).toBe('07:05');
          done();
        });
      });
    });
  });

  describe('CRON building', () => {
    beforeEach(() => {
      configureTestingModule({ dbId: '10' });
      reportServiceSpy.getReportsByConnectionId.and.returnValue(of(mockReports));
    });

    it('should build daily cron from form', (done) => {
      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['scheduleFrequency'].set('daily');
        component['scheduleTime'].set('08:30');
        const cron = component['buildCronFromForm']();
        expect(cron).toBe('30 08 * * *');
        done();
      });
    });

    it('should build weekly cron from form', (done) => {
      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['scheduleFrequency'].set('weekly');
        component['scheduleTime'].set('15:45');
        component['scheduleWeekday'].set(5);
        const cron = component['buildCronFromForm']();
        expect(cron).toBe('45 15 * * 5');
        done();
      });
    });

    it('should build monthly cron from form', (done) => {
      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['scheduleFrequency'].set('monthly');
        component['scheduleTime'].set('12:00');
        component['scheduleDayOfMonth'].set('1');
        const cron = component['buildCronFromForm']();
        expect(cron).toBe('00 12 1 * *');
        done();
      });
    });
  });

  describe('saveSchedule', () => {
    beforeEach(() => {
      configureTestingModule({ dbId: '10' });
      reportServiceSpy.getReportsByConnectionId.and.returnValue(of(mockReports));
      spyOn(console, 'error');
    });

    it('should create new global schedule when none exists', (done) => {
      reportServiceSpy.getGlobalSchedule.and.returnValue(throwError(() => ({ status: 404 })));
      reportServiceSpy.createGlobalSchedule.and.returnValue(of(mockGlobalSchedule));

      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['onScheduleSettings']();

        setTimeout(() => {
          component['scheduleFrequency'].set('daily');
          component['scheduleTime'].set('10:00');
          component['scheduleTimezone'].set('Asia/Omsk');
          component['scheduleDataPeriod'].set(14);
          component['saveSchedule']();

          setTimeout(() => {
            expect(reportServiceSpy.createGlobalSchedule).toHaveBeenCalledWith(10, {
              global_cron: '00 10 * * *',
              timezone: 'Asia/Omsk',
              data_period_days: 14
            });
            expect(component['scheduleSaving']()).toBe(false);
            expect(component['showScheduleModal']()).toBe(false);
            done();
          });
        });
      });
    });

    it('should update existing global schedule', (done) => {
      reportServiceSpy.getGlobalSchedule.and.returnValue(of(mockGlobalSchedule));
      reportServiceSpy.updateGlobalSchedule.and.returnValue(of(mockGlobalSchedule));

      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['onScheduleSettings']();

        setTimeout(() => {
          component['scheduleFrequency'].set('weekly');
          component['scheduleTime'].set('16:30');
          component['scheduleWeekday'].set(3);
          component['scheduleTimezone'].set('Europe/Kaliningrad');
          component['scheduleDataPeriod'].set(21);
          component['saveSchedule']();

          setTimeout(() => {
            expect(reportServiceSpy.updateGlobalSchedule).toHaveBeenCalledWith(10, {
              global_cron: '30 16 * * 3',
              timezone: 'Europe/Kaliningrad',
              data_period_days: 21
            });
            done();
          });
        });
      });
    });

    it('should handle error when save fails', (done) => {
      const error = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });
      reportServiceSpy.getGlobalSchedule.and.returnValue(throwError(() => ({ status: 404 })));
      reportServiceSpy.createGlobalSchedule.and.returnValue(throwError(() => error));

      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['onScheduleSettings']();

        setTimeout(() => {
          component['saveSchedule']();

          setTimeout(() => {
            expect(component['scheduleError']()).toBe('Не удалось сохранить расписание (код 500)');
            expect(component['scheduleSaving']()).toBe(false);
            done();
          });
        });
      });
    });

    it('should show license access reason when backend returns 403', (done) => {
      const error = new HttpErrorResponse({ status: 403, statusText: 'Forbidden' });
      reportServiceSpy.getGlobalSchedule.and.returnValue(throwError(() => ({ status: 404 })));
      reportServiceSpy.createGlobalSchedule.and.returnValue(throwError(() => error));

      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['onScheduleSettings']();

        setTimeout(() => {
          component['saveSchedule']();

          setTimeout(() => {
            expect(component['scheduleError']()).toBe(
              'Недостаточно прав: общее расписание доступно только с лицензией Pro или администратору'
            );
            expect(console.error).toHaveBeenCalledWith(
              '[Reports] Global schedule save failed',
              jasmine.objectContaining({
                method: 'POST',
                endpoint: '/schedules/global/10',
                status: 403
              })
            );
            done();
          });
        });
      });
    });

    it('should show validation details when backend returns 422', (done) => {
      const error = new HttpErrorResponse({
        status: 422,
        statusText: 'Unprocessable Entity',
        error: {
          detail: [
            {
              loc: ['body', 'global_cron'],
              msg: 'Invalid cron expression',
              type: 'value_error'
            }
          ]
        }
      });
      reportServiceSpy.getGlobalSchedule.and.returnValue(throwError(() => ({ status: 404 })));
      reportServiceSpy.createGlobalSchedule.and.returnValue(throwError(() => error));

      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['onScheduleSettings']();

        setTimeout(() => {
          component['saveSchedule']();

          setTimeout(() => {
            expect(component['scheduleError']()).toBe(
              'Ошибка валидации расписания: body.global_cron: Invalid cron expression'
            );
            done();
          });
        });
      });
    });
  });

  describe('closeScheduleModal', () => {
    beforeEach(() => {
      configureTestingModule({ dbId: '10' });
      reportServiceSpy.getReportsByConnectionId.and.returnValue(of(mockReports));
    });

    it('should reset all modal state when closing', (done) => {
      reportServiceSpy.getGlobalSchedule.and.returnValue(of(mockGlobalSchedule));

      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['onScheduleSettings']();

        setTimeout(() => {
          component['scheduleFrequency'].set('weekly');
          component['scheduleTime'].set('18:00');
          component['scheduleWeekday'].set(6);
          component['scheduleTimezone'].set('Asia/Vladivostok');
          component['scheduleDataPeriod'].set(30);

          component['closeScheduleModal']();

          expect(component['showScheduleModal']()).toBe(false);
          expect(component['scheduleError']()).toBeNull();
          expect(component['existingSchedule']()).toBeNull();
          expect(component['scheduleFrequency']()).toBe('daily');
          expect(component['scheduleTimezone']()).toBe('Europe/Moscow');
          expect(component['scheduleTime']()).toBe('13:00');
          expect(component['scheduleWeekday']()).toBe(1);
          expect(component['scheduleDayOfMonth']()).toBe('1');
          expect(component['scheduleDataPeriod']()).toBe(7);
          done();
        });
      });
    });
  });

  describe('ngOnInit', () => {
    it('should load reports when valid dbId is provided', (done) => {
      configureTestingModule({ dbId: '10' });
      reportServiceSpy.getReportsByConnectionId.and.returnValue(of(mockReports));

      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        expect(component['dbId']()).toBe(10);
        expect(reportServiceSpy.getReportsByConnectionId).toHaveBeenCalledWith(10);
        expect(component['reports']()).toEqual(mockReports);
        expect(component['loading']()).toBe(false);
        done();
      });
    });

    it('should navigate back when dbId is missing', () => {
      configureTestingModule({});
      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(routerSpy.navigate).toHaveBeenCalled();
    });

    it('should navigate back when dbId is invalid', () => {
      configureTestingModule({ dbId: 'invalid' });
      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(routerSpy.navigate).toHaveBeenCalled();
    });

    it('should parse userId from route params', (done) => {
      configureTestingModule({ dbId: '10', id: '5' });
      reportServiceSpy.getReportsByConnectionId.and.returnValue(of(mockReports));

      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        expect(component['userId']()).toBe(5);
        done();
      });
    });

    it('should handle 404 when no reports exist', (done) => {
      configureTestingModule({ dbId: '10' });
      const error = new HttpErrorResponse({ status: 404, statusText: 'Not Found' });
      reportServiceSpy.getReportsByConnectionId.and.returnValue(throwError(() => error));

      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        expect(component['reports']()).toEqual([]);
        expect(component['loading']()).toBe(false);
        done();
      });
    });

    it('should handle error when loading reports fails', (done) => {
      configureTestingModule({ dbId: '10' });
      const error = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });
      reportServiceSpy.getReportsByConnectionId.and.returnValue(throwError(() => error));

      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        expect(component['error']()).toBe('Не удалось загрузить отчёты');
        expect(component['loading']()).toBe(false);
        done();
      });
    });
  });

  describe('submitSelectedReports', () => {
    beforeEach(() => {
      configureTestingModule({ dbId: '10' });
      reportServiceSpy.getReportsByConnectionId.and.returnValue(of(mockReports));
      reportServiceSpy.createReports.and.returnValue(of(undefined));
    });

    it('should continue onboarding directly to report settings after creating reports', (done) => {
      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      spyOn(component['onboarding'], 'openAtStep');

      setTimeout(() => {
        component['selectedReportIds'].set(new Set(['report-123']));
        component['reportSelectionOpenedFromOnboarding'].set(true);
        component['submitSelectedReports']();

        setTimeout(() => {
          expect(reportServiceSpy.createReports).toHaveBeenCalledWith(10, {
            iiko_reports_ids: ['report-123'],
            format: 'pdf'
          });
          expect(component['onboarding'].openAtStep).toHaveBeenCalledWith('configure_report');
          done();
        });
      });
    });
  });

  describe('onConfigureReport', () => {
    describe('when userId is null', () => {
      beforeEach(() => {
        configureTestingModule({ dbId: '10' });
        reportServiceSpy.getReportsByConnectionId.and.returnValue(of(mockReports));
      });

      it('should navigate to user report settings', (done) => {
        const fixture = TestBed.createComponent(ReportsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();

        setTimeout(() => {
          component['onConfigureReport'](mockReports[0]);
          expect(routerSpy.navigate).toHaveBeenCalledWith(['/user/databases', 10, 'reports', 1, 'settings']);
          done();
        });
      });
    });

    describe('when userId is provided', () => {
      beforeEach(() => {
        configureTestingModule({ dbId: '10', id: '5' });
        reportServiceSpy.getReportsByConnectionId.and.returnValue(of(mockReports));
      });

      it('should navigate to admin report settings', (done) => {
        const fixture = TestBed.createComponent(ReportsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();

        setTimeout(() => {
          component['onConfigureReport'](mockReports[0]);
          expect(routerSpy.navigate).toHaveBeenCalledWith(['/admin/users', 5, 'databases', 10, 'reports', 1, 'settings']);
          done();
        });
      });
    });
  });

  describe('Form event handlers', () => {
    beforeEach(() => {
      configureTestingModule({ dbId: '10' });
      reportServiceSpy.getReportsByConnectionId.and.returnValue(of(mockReports));
    });

    it('should update frequency when onFrequencyChange is called', (done) => {
      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        const event = { target: { value: 'weekly' } } as any;
        component['onFrequencyChange'](event);
        expect(component['scheduleFrequency']()).toBe('weekly');
        done();
      });
    });

    it('should update timezone when onTimezoneChange is called', (done) => {
      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        const event = { target: { value: 'Asia/Krasnoyarsk' } } as any;
        component['onTimezoneChange'](event);
        expect(component['scheduleTimezone']()).toBe('Asia/Krasnoyarsk');
        done();
      });
    });

    it('should update time when onTimeChange is called', (done) => {
      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        const event = { target: { value: '18:45' } } as any;
        component['onTimeChange'](event);
        expect(component['scheduleTime']()).toBe('18:45');
        done();
      });
    });

    it('should update weekday when onWeekdayChange is called', (done) => {
      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        const event = { target: { value: '4' } } as any;
        component['onWeekdayChange'](event);
        expect(component['scheduleWeekday']()).toBe(4);
        done();
      });
    });

    it('should update day of month when onDayOfMonthChange is called', (done) => {
      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        const event = { target: { value: '25' } } as any;
        component['onDayOfMonthChange'](event);
        expect(component['scheduleDayOfMonth']()).toBe('25');
        done();
      });
    });

    it('should update data period when onDataPeriodChange is called', (done) => {
      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        const event = { target: { value: '30' } } as any;
        component['onDataPeriodChange'](event);
        expect(component['scheduleDataPeriod']()).toBe(30);
        done();
      });
    });

    it('should not update data period when value is NaN', (done) => {
      const fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        const initialValue = component['scheduleDataPeriod']();
        const event = { target: { value: 'invalid' } } as any;
        component['onDataPeriodChange'](event);
        expect(component['scheduleDataPeriod']()).toBe(initialValue);
        done();
      });
    });
  });
});
