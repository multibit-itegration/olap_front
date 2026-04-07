import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ReportSettingsComponent } from './report-settings.component';
import { ReportService } from '../../../core/api/report.service';
import { AuthService } from '../../../core/api/auth.service';
import { LinkedChatsService } from '../../../core/api/linked-chats.service';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Report, IndividualSchedule } from '../../../core/api/models/report.models';
import { User } from '../../../core/api/models/user.models';

describe('ReportSettingsComponent', () => {
  let component: ReportSettingsComponent;
  let reportServiceSpy: jasmine.SpyObj<ReportService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let linkedChatsServiceSpy: jasmine.SpyObj<LinkedChatsService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let fixture: any;

  const mockUser: User = {
    id: 5,
    name: 'Test User',
    phone: '+79001234567',
    email: 'test@example.com',
    telegram_id: 123456789,
    role: 'user'
  };

  afterEach((done) => {
    // Wait for any pending async operations to complete
    setTimeout(() => {
      if (fixture) {
        fixture.destroy();
        fixture = null;
      }
      done();
    }, 50);
  });

  const mockReport: Report = {
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
  };

  const mockIndividualSchedule: IndividualSchedule = {
    id: 1,
    report_id: 1,
    individual_cron: '30 14 * * 1',
    timezone: 'Europe/Moscow',
    data_period_days: 7,
    next_run_at: '2026-03-24T14:30:00Z'
  };

  function configureTestingModule(routeParams: { [key: string]: string }, url: string = '/user/databases/10/reports/1') {
    const reportSpy = jasmine.createSpyObj('ReportService', [
      'getReport',
      'updateReport',
      'updateReportStructure',
      'deleteReport',
      'getIndividualSchedule',
      'createIndividualSchedule',
      'updateIndividualSchedule',
      'getGroupSchedule',
      'createGroupSchedule',
      'updateGroupSchedule'
    ]);
    const authSpy = jasmine.createSpyObj('AuthService', ['loadCurrentUser'], {
      currentUser: signal(mockUser)
    });
    const linkedChatsSpy = jasmine.createSpyObj('LinkedChatsService', ['getLinkedChats', 'updateLinkedChat']);
    const routerSpyObj = jasmine.createSpyObj('Router', ['navigate'], { url });

    TestBed.configureTestingModule({
      imports: [ReportSettingsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ReportService, useValue: reportSpy },
        { provide: AuthService, useValue: authSpy },
        { provide: LinkedChatsService, useValue: linkedChatsSpy },
        { provide: Router, useValue: routerSpyObj },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(routeParams) }, parent: null } }
      ]
    });

    reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
    authServiceSpy = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    linkedChatsServiceSpy = TestBed.inject(LinkedChatsService) as jasmine.SpyObj<LinkedChatsService>;
    routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
  }

  describe('Component creation and initialization', () => {
    it('should create', () => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      component = TestBed.createComponent(ReportSettingsComponent).componentInstance;
      expect(component).toBeTruthy();
    });
  });

  describe('ngOnInit', () => {
    it('should load report when valid reportId is provided', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        expect(component['reportId']()).toBe(1);
        expect(reportServiceSpy.getReport).toHaveBeenCalledWith(1);
        expect(component['report']()).toEqual(mockReport);
        expect(component['loading']()).toBe(false);
        done();
      });
    });

    it('should navigate back when reportId is missing', () => {
      configureTestingModule({ dbId: '10' });
      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(routerSpy.navigate).toHaveBeenCalled();
    });

    it('should navigate back when reportId is invalid', () => {
      configureTestingModule({ reportId: 'invalid', dbId: '10' });
      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(routerSpy.navigate).toHaveBeenCalled();
    });

    it('should parse dbId and userId from route params', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10', id: '5' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        expect(component['dbId']()).toBe(10);
        expect(component['userId']()).toBe(5);
        done();
      });
    });

    it('should sync local state with loaded report', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        expect(component['selectedFormat']()).toBe('xlsx');
        expect(component['selectedDeliveryType']()).toBe('telegram');
        expect(component['selectedScheduleType']()).toBe('individual');
        done();
      });
    });

    it('should load individual schedule when report has schedule_type individual', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        expect(reportServiceSpy.getIndividualSchedule).toHaveBeenCalledWith(1);
        expect(component['existingIndividualSchedule']()).toEqual(mockIndividualSchedule);
        done();
      }, 100);
    });

    it('should handle error when loading report fails', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      const error = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });
      reportServiceSpy.getReport.and.returnValue(throwError(() => error));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        expect(component['error']()).toBe('Не удалось загрузить отчёт');
        expect(component['loading']()).toBe(false);
        done();
      });
    });
  });

  describe('Selector changes', () => {
    it('should update format when onFormatChange is called', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        const event = { target: { value: 'pdf' } } as any;
        component['onFormatChange'](event);
        expect(component['selectedFormat']()).toBe('pdf');
        done();
      });
    });

    it('should update delivery type when onDeliveryTypeChange is called', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        const event = { target: { value: 'email' } } as any;
        component['onDeliveryTypeChange'](event);
        expect(component['selectedDeliveryType']()).toBe('email');
        done();
      });
    });

    it('should update schedule type when onScheduleTypeChange is called', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        const event = { target: { value: 'global' } } as any;
        component['onScheduleTypeChange'](event);
        expect(component['selectedScheduleType']()).toBe('global');
        done();
      });
    });

    it('should handle null schedule type', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        const event = { target: { value: 'null' } } as any;
        component['onScheduleTypeChange'](event);
        expect(component['selectedScheduleType']()).toBeNull();
        done();
      });
    });

    it('should load individual schedule when schedule type changed to individual', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        // Reset spy to track new calls
        reportServiceSpy.getIndividualSchedule.calls.reset();

        const event = { target: { value: 'individual' } } as any;
        component['onScheduleTypeChange'](event);

        setTimeout(() => {
          expect(reportServiceSpy.getIndividualSchedule).toHaveBeenCalled();
          done();
        });
      });
    });
  });

  describe('hasUnsavedChanges computed', () => {
    it('should return false when no changes are made', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        expect(component['hasUnsavedChanges']()).toBe(false);
        done();
      });
    });

    it('should return true when format is changed', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['selectedFormat'].set('pdf');
        expect(component['hasUnsavedChanges']()).toBe(true);
        done();
      });
    });

    it('should return true when delivery type is changed', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['selectedDeliveryType'].set('email');
        expect(component['hasUnsavedChanges']()).toBe(true);
        done();
      });
    });

    it('should return true when schedule type is changed', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['selectedScheduleType'].set('global');
        expect(component['hasUnsavedChanges']()).toBe(true);
        done();
      });
    });
  });

  describe('saveSettings', () => {
    it('should save settings when there are unsaved changes', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      const updatedReport = { ...mockReport, format: 'pdf' };
      reportServiceSpy.updateReport.and.returnValue(of(updatedReport));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['selectedFormat'].set('pdf');
        component['saveSettings']();

        setTimeout(() => {
          expect(reportServiceSpy.updateReport).toHaveBeenCalledWith(1, {
            format: 'pdf',
            delivery_type: 'telegram',
            schedule_type: 'individual'
          });
          expect(component['report']()).toEqual(updatedReport);
          expect(component['saving']()).toBe(false);
          done();
        });
      });
    });

    it('should not save when there are no unsaved changes', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['saveSettings']();
        expect(reportServiceSpy.updateReport).not.toHaveBeenCalled();
        done();
      });
    });

    it('should not save when already saving', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['saving'].set(true);
        component['selectedFormat'].set('pdf');
        component['saveSettings']();
        expect(reportServiceSpy.updateReport).not.toHaveBeenCalled();
        done();
      });
    });

    it('should handle error when save fails', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      const error = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });
      reportServiceSpy.updateReport.and.returnValue(throwError(() => error));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['selectedFormat'].set('pdf');
        component['saveSettings']();

        setTimeout(() => {
          expect(component['error']()).toBe('Не удалось сохранить настройки');
          expect(component['saving']()).toBe(false);
          done();
        });
      });
    });
  });

  describe('Individual schedule', () => {
    beforeEach(() => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    });

    it('should show individual schedule block when schedule_type is individual', (done) => {
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        expect(component['showIndividualSchedule']()).toBe(true);
        done();
      });
    });

    it('should hide individual schedule block when schedule_type is not individual', (done) => {
      const reportWithGlobal: Report = { ...mockReport, schedule_type: 'global' };
      reportServiceSpy.getReport.and.returnValue(of(reportWithGlobal));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        expect(component['showIndividualSchedule']()).toBe(false);
        done();
      });
    });

    it('should handle 404 when individual schedule does not exist', (done) => {
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      const error = new HttpErrorResponse({ status: 404, statusText: 'Not Found' });
      reportServiceSpy.getIndividualSchedule.and.returnValue(throwError(() => error));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        expect(component['existingIndividualSchedule']()).toBeNull();
        expect(component['individualScheduleLoading']()).toBe(false);
        done();
      }, 100);
    });

    it('should normalize timezone (case-insensitive)', (done) => {
      const scheduleWithUpperTimezone = { ...mockIndividualSchedule, timezone: 'EUROPE/MOSCOW' };
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(scheduleWithUpperTimezone));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        expect(component['individualTimezone']()).toBe('Europe/Moscow');
        done();
      }, 100);
    });

    it('should fallback to Europe/Moscow when timezone not found', (done) => {
      const scheduleWithUnknownTimezone = { ...mockIndividualSchedule, timezone: 'Unknown/Timezone' };
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(scheduleWithUnknownTimezone));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        expect(component['individualTimezone']()).toBe('Europe/Moscow');
        done();
      }, 100);
    });
  });

  describe('CRON parsing', () => {
    // These tests directly call parseIndividualCronToForm, no need for beforeEach setup

    it('should parse daily cron expression', () => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      const reportWithoutSchedule: Report = { ...mockReport, schedule_type: null };
      reportServiceSpy.getReport.and.returnValue(of(reportWithoutSchedule));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;

      // Manually call the parsing method
      component['parseIndividualCronToForm']('0 13 * * *');

      expect(component['individualFrequency']()).toBe('daily');
      expect(component['individualTime']()).toBe('13:00');
    });

    it('should parse weekly cron expression', () => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      const reportWithoutSchedule: Report = { ...mockReport, schedule_type: null };
      reportServiceSpy.getReport.and.returnValue(of(reportWithoutSchedule));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;

      component['parseIndividualCronToForm']('30 14 * * 1');

      expect(component['individualFrequency']()).toBe('weekly');
      expect(component['individualTime']()).toBe('14:30');
      expect(component['individualWeekday']()).toBe(1);
    });

    it('should parse monthly cron expression', () => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      const reportWithoutSchedule: Report = { ...mockReport, schedule_type: null };
      reportServiceSpy.getReport.and.returnValue(of(reportWithoutSchedule));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;

      component['parseIndividualCronToForm']('0 9 15 * *');

      expect(component['individualFrequency']()).toBe('monthly');
      expect(component['individualTime']()).toBe('09:00');
      expect(component['individualDayOfMonth']()).toBe('15');
    });
  });

  describe('CRON building', () => {
    // These tests directly call buildIndividualCronFromForm, minimal setup needed

    it('should build daily cron from form', () => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      const reportWithoutSchedule: Report = { ...mockReport, schedule_type: null };
      reportServiceSpy.getReport.and.returnValue(of(reportWithoutSchedule));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;

      component['individualFrequency'].set('daily');
      component['individualTime'].set('08:30');
      const cron = component['buildIndividualCronFromForm']();
      expect(cron).toBe('30 08 * * *');
    });

    it('should build weekly cron from form', () => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      const reportWithoutSchedule: Report = { ...mockReport, schedule_type: null };
      reportServiceSpy.getReport.and.returnValue(of(reportWithoutSchedule));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;

      component['individualFrequency'].set('weekly');
      component['individualTime'].set('15:45');
      component['individualWeekday'].set(5);
      const cron = component['buildIndividualCronFromForm']();
      expect(cron).toBe('45 15 * * 5');
    });

    it('should build monthly cron from form', () => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      const reportWithoutSchedule: Report = { ...mockReport, schedule_type: null };
      reportServiceSpy.getReport.and.returnValue(of(reportWithoutSchedule));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;

      component['individualFrequency'].set('monthly');
      component['individualTime'].set('12:00');
      component['individualDayOfMonth'].set('1');
      const cron = component['buildIndividualCronFromForm']();
      expect(cron).toBe('00 12 1 * *');
    });
  });

  describe('saveSchedule', () => {
    it('should create new individual schedule when none exists', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(throwError(() => ({ status: 404 })));
      reportServiceSpy.createIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['individualFrequency'].set('daily');
        component['individualTime'].set('10:00');
        component['individualTimezone'].set('Asia/Omsk');
        component['individualDataPeriod'].set(14);
        component['saveSchedule']();

        setTimeout(() => {
          expect(reportServiceSpy.createIndividualSchedule).toHaveBeenCalledWith(1, {
            individual_cron: '00 10 * * *',
            timezone: 'Asia/Omsk',
            data_period_days: 14
          });
          expect(component['existingIndividualSchedule']()).toEqual(mockIndividualSchedule);
          expect(component['individualScheduleSaving']()).toBe(false);
          done();
        });
      }, 100);
    });

    it('should update existing individual schedule', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(mockIndividualSchedule));
      reportServiceSpy.updateIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['individualFrequency'].set('weekly');
        component['individualTime'].set('16:30');
        component['individualWeekday'].set(3);
        component['individualTimezone'].set('Europe/Kaliningrad');
        component['individualDataPeriod'].set(21);
        component['saveSchedule']();

        setTimeout(() => {
          expect(reportServiceSpy.updateIndividualSchedule).toHaveBeenCalledWith(1, {
            individual_cron: '30 16 * * 3',
            timezone: 'Europe/Kaliningrad',
            data_period_days: 21
          });
          done();
        });
      }, 100);
    });

    it('should handle error when save fails', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      const error = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });
      reportServiceSpy.getIndividualSchedule.and.returnValue(throwError(() => ({ status: 404 })));
      reportServiceSpy.createIndividualSchedule.and.returnValue(throwError(() => error));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['saveSchedule']();

        setTimeout(() => {
          expect(component['individualScheduleError']()).toBe('Не удалось сохранить индивидуальное расписание');
          expect(component['individualScheduleSaving']()).toBe(false);
          done();
        });
      }, 100);
    });
  });

  describe('updateReportStructure', () => {
    it('should update report structure after confirmation', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      spyOn(window, 'confirm').and.returnValue(true);
      reportServiceSpy.updateReportStructure.and.returnValue(of(void 0));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['onUpdateStructure']();
        expect(reportServiceSpy.updateReportStructure).toHaveBeenCalledWith(1);
        done();
      });
    });

    it('should not update when confirmation is cancelled', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      spyOn(window, 'confirm').and.returnValue(false);

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['onUpdateStructure']();
        expect(reportServiceSpy.updateReportStructure).not.toHaveBeenCalled();
        done();
      });
    });

    it('should reload report after successful update', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      spyOn(window, 'confirm').and.returnValue(true);
      reportServiceSpy.updateReportStructure.and.returnValue(of(void 0));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        reportServiceSpy.getReport.calls.reset();
        component['onUpdateStructure']();

        setTimeout(() => {
          expect(reportServiceSpy.getReport).toHaveBeenCalled();
          done();
        });
      });
    });
  });

  describe('deleteReport', () => {
    it('should delete report after confirmation', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      spyOn(window, 'confirm').and.returnValue(true);
      reportServiceSpy.deleteReport.and.returnValue(of(void 0));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['onDeleteReport']();
        expect(reportServiceSpy.deleteReport).toHaveBeenCalledWith(1);
        done();
      });
    });

    it('should not delete when confirmation is cancelled', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      spyOn(window, 'confirm').and.returnValue(false);

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['onDeleteReport']();
        expect(reportServiceSpy.deleteReport).not.toHaveBeenCalled();
        done();
      });
    });

    it('should navigate back after successful deletion', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      spyOn(window, 'confirm').and.returnValue(true);
      reportServiceSpy.deleteReport.and.returnValue(of(void 0));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['onDeleteReport']();

        setTimeout(() => {
          expect(routerSpy.navigate).toHaveBeenCalled();
          done();
        });
      });
    });
  });

  describe('goBack navigation', () => {
    it('should navigate to user reports when userId is null', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['goBack']();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/user/databases', 10, 'reports']);
        done();
      });
    });

    it('should navigate to admin reports when userId is provided', (done) => {
      configureTestingModule({ reportId: '1', dbId: '10', id: '5' });
      reportServiceSpy = TestBed.inject(ReportService) as jasmine.SpyObj<ReportService>;
      routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      reportServiceSpy.getReport.and.returnValue(of(mockReport));
      reportServiceSpy.getIndividualSchedule.and.returnValue(of(mockIndividualSchedule));

      fixture = TestBed.createComponent(ReportSettingsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      setTimeout(() => {
        component['goBack']();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/admin/users', 5, 'databases', 10, 'reports']);
        done();
      });
    });
  });
});
