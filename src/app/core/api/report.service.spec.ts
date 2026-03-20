import { TestBed } from '@angular/core/testing';
import { ReportService } from './report.service';
import { ApiClientService } from './api-client.service';
import { of, throwError } from 'rxjs';
import {
  Report,
  IikoReport,
  CreateReportsRequest,
  GlobalSchedule,
  CreateGlobalScheduleRequest,
  UpdateGlobalScheduleRequest,
  UpdateReportRequest,
  IndividualSchedule,
  CreateIndividualScheduleRequest,
  UpdateIndividualScheduleRequest
} from './models/report.models';

describe('ReportService', () => {
  let service: ReportService;
  let apiClientSpy: jasmine.SpyObj<ApiClientService>;

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

  const mockReports: Report[] = [
    mockReport,
    {
      id: 2,
      iiko_connection_id: 10,
      user_id: 5,
      iiko_report_id: 'report-456',
      delivery_type: null,
      address: null,
      format: null,
      iiko_report_structure: null,
      report_type: 'STOCK',
      name: 'Test Stock Report',
      schedule_type: null,
      created_at: '2026-01-02T00:00:00Z'
    }
  ];

  const mockIikoReports: IikoReport[] = [
    {
      id: 'iiko-1',
      name: 'Sales Report',
      reportType: 'SALES'
    },
    {
      id: 'iiko-2',
      name: 'Inventory Report',
      reportType: 'STOCK'
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

  const mockIndividualSchedule: IndividualSchedule = {
    id: 1,
    report_id: 1,
    individual_cron: '30 14 * * 1',
    timezone: 'Asia/Yekaterinburg',
    data_period_days: 14,
    next_run_at: '2026-03-24T14:30:00Z'
  };

  beforeEach(() => {
    const apiClientSpyObj = jasmine.createSpyObj('ApiClientService', [
      'get',
      'post',
      'patch',
      'delete'
    ]);

    TestBed.configureTestingModule({
      providers: [
        ReportService,
        { provide: ApiClientService, useValue: apiClientSpyObj }
      ]
    });

    service = TestBed.inject(ReportService);
    apiClientSpy = TestBed.inject(ApiClientService) as jasmine.SpyObj<ApiClientService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getReportsByConnectionId', () => {
    it('should fetch reports for a given connection ID', (done) => {
      apiClientSpy.get.and.returnValue(of(mockReports));

      service.getReportsByConnectionId(10).subscribe(reports => {
        expect(reports).toEqual(mockReports);
        expect(apiClientSpy.get).toHaveBeenCalledWith('/reports/10');
        done();
      });
    });

    it('should handle empty array response', (done) => {
      apiClientSpy.get.and.returnValue(of([]));

      service.getReportsByConnectionId(10).subscribe(reports => {
        expect(reports).toEqual([]);
        expect(reports.length).toBe(0);
        done();
      });
    });

    it('should propagate errors from API', (done) => {
      const error = new Error('Network error');
      apiClientSpy.get.and.returnValue(throwError(() => error));

      service.getReportsByConnectionId(10).subscribe({
        next: () => fail('Should have failed'),
        error: (err) => {
          expect(err).toBe(error);
          done();
        }
      });
    });
  });

  describe('getIikoReports', () => {
    it('should fetch iiko reports for a given connection ID', (done) => {
      apiClientSpy.get.and.returnValue(of(mockIikoReports));

      service.getIikoReports(10).subscribe(reports => {
        expect(reports).toEqual(mockIikoReports);
        expect(apiClientSpy.get).toHaveBeenCalledWith('/reports/10/iiko_reports');
        done();
      });
    });
  });

  describe('createReports', () => {
    it('should create reports with given IDs and format', (done) => {
      const request: CreateReportsRequest = {
        iiko_reports_ids: ['iiko-1', 'iiko-2'],
        format: 'xlsx'
      };
      apiClientSpy.post.and.returnValue(of(void 0));

      service.createReports(10, request).subscribe(() => {
        expect(apiClientSpy.post).toHaveBeenCalledWith('/reports/10', request);
        done();
      });
    });
  });

  describe('getReport', () => {
    it('should fetch a single report by ID', (done) => {
      apiClientSpy.get.and.returnValue(of(mockReport));

      service.getReport(1).subscribe(report => {
        expect(report).toEqual(mockReport);
        expect(apiClientSpy.get).toHaveBeenCalledWith('/reports/report/1');
        done();
      });
    });

    it('should handle report with null fields', (done) => {
      const reportWithNulls: Report = {
        ...mockReport,
        delivery_type: null,
        address: null,
        format: null,
        schedule_type: null
      };
      apiClientSpy.get.and.returnValue(of(reportWithNulls));

      service.getReport(1).subscribe(report => {
        expect(report.delivery_type).toBeNull();
        expect(report.format).toBeNull();
        expect(report.schedule_type).toBeNull();
        done();
      });
    });
  });

  describe('updateReport', () => {
    it('should update report with all fields provided', (done) => {
      const request: UpdateReportRequest = {
        delivery_type: 'email',
        format: 'pdf',
        schedule_type: 'global'
      };
      const updatedReport = { ...mockReport, ...request };
      apiClientSpy.patch.and.returnValue(of(updatedReport));

      service.updateReport(1, request).subscribe(report => {
        expect(report).toEqual(updatedReport);
        expect(apiClientSpy.patch).toHaveBeenCalledWith('/reports/1', request);
        done();
      });
    });

    it('should correctly handle null values in request', (done) => {
      const request: UpdateReportRequest = {
        delivery_type: null,
        format: null,
        schedule_type: null
      };
      const expectedPayload = {
        delivery_type: null,
        format: null,
        schedule_type: null
      };
      apiClientSpy.patch.and.returnValue(of(mockReport));

      service.updateReport(1, request).subscribe(() => {
        expect(apiClientSpy.patch).toHaveBeenCalledWith('/reports/1', expectedPayload);
        done();
      });
    });

    it('should only include defined fields in payload', (done) => {
      const request: UpdateReportRequest = {
        format: 'csv'
      };
      const expectedPayload = { format: 'csv' };
      apiClientSpy.patch.and.returnValue(of(mockReport));

      service.updateReport(1, request).subscribe(() => {
        expect(apiClientSpy.patch).toHaveBeenCalledWith('/reports/1', expectedPayload);
        done();
      });
    });

    it('should handle partial updates with undefined fields', (done) => {
      const request: UpdateReportRequest = {
        schedule_type: 'individual'
      };
      apiClientSpy.patch.and.returnValue(of(mockReport));

      service.updateReport(1, request).subscribe(() => {
        const callArgs = apiClientSpy.patch.calls.mostRecent().args[1] as UpdateReportRequest;
        expect(callArgs.schedule_type).toBe('individual');
        expect('delivery_type' in callArgs).toBe(false);
        expect('format' in callArgs).toBe(false);
        done();
      });
    });
  });

  describe('updateReportStructure', () => {
    it('should call update structure endpoint', (done) => {
      apiClientSpy.post.and.returnValue(of(void 0));

      service.updateReportStructure(1).subscribe(() => {
        expect(apiClientSpy.post).toHaveBeenCalledWith('/reports/1/update_structure', {});
        done();
      });
    });

    it('should propagate errors', (done) => {
      const error = new Error('Update failed');
      apiClientSpy.post.and.returnValue(throwError(() => error));

      service.updateReportStructure(1).subscribe({
        next: () => fail('Should have failed'),
        error: (err) => {
          expect(err).toBe(error);
          done();
        }
      });
    });
  });

  describe('deleteReport', () => {
    it('should delete a report by ID', (done) => {
      apiClientSpy.delete.and.returnValue(of(void 0));

      service.deleteReport(1).subscribe(() => {
        expect(apiClientSpy.delete).toHaveBeenCalledWith('/reports/1');
        done();
      });
    });

    it('should propagate deletion errors', (done) => {
      const error = new Error('Delete failed');
      apiClientSpy.delete.and.returnValue(throwError(() => error));

      service.deleteReport(1).subscribe({
        next: () => fail('Should have failed'),
        error: (err) => {
          expect(err).toBe(error);
          done();
        }
      });
    });
  });

  describe('getGlobalSchedule', () => {
    it('should fetch global schedule for a connection', (done) => {
      apiClientSpy.get.and.returnValue(of(mockGlobalSchedule));

      service.getGlobalSchedule(10).subscribe(schedule => {
        expect(schedule).toEqual(mockGlobalSchedule);
        expect(apiClientSpy.get).toHaveBeenCalledWith('/schedules/global/10');
        done();
      });
    });

    it('should handle 404 when schedule does not exist', (done) => {
      const error = { status: 404 };
      apiClientSpy.get.and.returnValue(throwError(() => error));

      service.getGlobalSchedule(10).subscribe({
        next: () => fail('Should have failed'),
        error: (err) => {
          expect(err.status).toBe(404);
          done();
        }
      });
    });
  });

  describe('createGlobalSchedule', () => {
    it('should create global schedule with all required fields', (done) => {
      const request: CreateGlobalScheduleRequest = {
        global_cron: '0 9 * * *',
        timezone: 'Asia/Vladivostok',
        data_period_days: 30
      };
      apiClientSpy.post.and.returnValue(of(mockGlobalSchedule));

      service.createGlobalSchedule(10, request).subscribe(schedule => {
        expect(schedule).toEqual(mockGlobalSchedule);
        expect(apiClientSpy.post).toHaveBeenCalledWith('/schedules/global/10', request);
        done();
      });
    });

    it('should handle various cron expressions', (done) => {
      const request: CreateGlobalScheduleRequest = {
        global_cron: '30 14 15 * *', // Monthly on 15th at 14:30
        timezone: 'Europe/Moscow',
        data_period_days: 7
      };
      apiClientSpy.post.and.returnValue(of(mockGlobalSchedule));

      service.createGlobalSchedule(10, request).subscribe(() => {
        expect(apiClientSpy.post).toHaveBeenCalledWith('/schedules/global/10', request);
        done();
      });
    });
  });

  describe('updateGlobalSchedule', () => {
    it('should update global schedule with all fields', (done) => {
      const request: UpdateGlobalScheduleRequest = {
        global_cron: '0 12 * * *',
        timezone: 'Asia/Krasnoyarsk',
        data_period_days: 14
      };
      apiClientSpy.patch.and.returnValue(of(mockGlobalSchedule));

      service.updateGlobalSchedule(10, request).subscribe(schedule => {
        expect(schedule).toEqual(mockGlobalSchedule);
        expect(apiClientSpy.patch).toHaveBeenCalledWith('/schedules/global/10', request);
        done();
      });
    });

    it('should handle null values in update', (done) => {
      const request: UpdateGlobalScheduleRequest = {
        global_cron: null,
        timezone: null,
        data_period_days: 7
      };
      apiClientSpy.patch.and.returnValue(of(mockGlobalSchedule));

      service.updateGlobalSchedule(10, request).subscribe(() => {
        expect(apiClientSpy.patch).toHaveBeenCalledWith('/schedules/global/10', request);
        done();
      });
    });
  });

  describe('getIndividualSchedule', () => {
    it('should fetch individual schedule for a report', (done) => {
      apiClientSpy.get.and.returnValue(of(mockIndividualSchedule));

      service.getIndividualSchedule(1).subscribe(schedule => {
        expect(schedule).toEqual(mockIndividualSchedule);
        expect(apiClientSpy.get).toHaveBeenCalledWith('/schedules/individual/1');
        done();
      });
    });

    it('should handle 404 when individual schedule does not exist', (done) => {
      const error = { status: 404 };
      apiClientSpy.get.and.returnValue(throwError(() => error));

      service.getIndividualSchedule(1).subscribe({
        next: () => fail('Should have failed'),
        error: (err) => {
          expect(err.status).toBe(404);
          done();
        }
      });
    });
  });

  describe('createIndividualSchedule', () => {
    it('should create individual schedule with all required fields', (done) => {
      const request: CreateIndividualScheduleRequest = {
        individual_cron: '0 10 * * 1',
        timezone: 'Europe/Kaliningrad',
        data_period_days: 7
      };
      apiClientSpy.post.and.returnValue(of(mockIndividualSchedule));

      service.createIndividualSchedule(1, request).subscribe(schedule => {
        expect(schedule).toEqual(mockIndividualSchedule);
        expect(apiClientSpy.post).toHaveBeenCalledWith('/schedules/individual/1', request);
        done();
      });
    });

    it('should handle daily cron expression', (done) => {
      const request: CreateIndividualScheduleRequest = {
        individual_cron: '0 8 * * *',
        timezone: 'Europe/Moscow',
        data_period_days: 1
      };
      apiClientSpy.post.and.returnValue(of(mockIndividualSchedule));

      service.createIndividualSchedule(1, request).subscribe(() => {
        expect(apiClientSpy.post).toHaveBeenCalledWith('/schedules/individual/1', request);
        done();
      });
    });

    it('should handle monthly cron expression', (done) => {
      const request: CreateIndividualScheduleRequest = {
        individual_cron: '0 12 1 * *',
        timezone: 'Asia/Kamchatka',
        data_period_days: 30
      };
      apiClientSpy.post.and.returnValue(of(mockIndividualSchedule));

      service.createIndividualSchedule(1, request).subscribe(() => {
        expect(apiClientSpy.post).toHaveBeenCalledWith('/schedules/individual/1', request);
        done();
      });
    });
  });

  describe('updateIndividualSchedule', () => {
    it('should update individual schedule with all fields', (done) => {
      const request: UpdateIndividualScheduleRequest = {
        individual_cron: '30 15 * * 5',
        timezone: 'Asia/Omsk',
        data_period_days: 21
      };
      const expectedPayload = {
        individual_cron: '30 15 * * 5',
        timezone: 'Asia/Omsk',
        data_period_days: 21
      };
      apiClientSpy.patch.and.returnValue(of(mockIndividualSchedule));

      service.updateIndividualSchedule(1, request).subscribe(schedule => {
        expect(schedule).toEqual(mockIndividualSchedule);
        expect(apiClientSpy.patch).toHaveBeenCalledWith('/schedules/individual/1', expectedPayload);
        done();
      });
    });

    it('should handle null values in individual schedule update', (done) => {
      const request: UpdateIndividualScheduleRequest = {
        individual_cron: null,
        timezone: null,
        data_period_days: 7
      };
      const expectedPayload = {
        individual_cron: null,
        timezone: null,
        data_period_days: 7
      };
      apiClientSpy.patch.and.returnValue(of(mockIndividualSchedule));

      service.updateIndividualSchedule(1, request).subscribe(() => {
        expect(apiClientSpy.patch).toHaveBeenCalledWith('/schedules/individual/1', expectedPayload);
        done();
      });
    });

    it('should only include defined fields in payload', (done) => {
      const request: UpdateIndividualScheduleRequest = {
        data_period_days: 10
      };
      apiClientSpy.patch.and.returnValue(of(mockIndividualSchedule));

      service.updateIndividualSchedule(1, request).subscribe(() => {
        const callArgs = apiClientSpy.patch.calls.mostRecent().args[1] as UpdateIndividualScheduleRequest;
        expect(callArgs.data_period_days).toBe(10);
        expect('individual_cron' in callArgs).toBe(false);
        expect('timezone' in callArgs).toBe(false);
        done();
      });
    });

    it('should handle partial update with only cron', (done) => {
      const request: UpdateIndividualScheduleRequest = {
        individual_cron: '0 6 * * *'
      };
      apiClientSpy.patch.and.returnValue(of(mockIndividualSchedule));

      service.updateIndividualSchedule(1, request).subscribe(() => {
        const callArgs = apiClientSpy.patch.calls.mostRecent().args[1] as UpdateIndividualScheduleRequest;
        expect(callArgs.individual_cron).toBe('0 6 * * *');
        expect('timezone' in callArgs).toBe(false);
        expect('data_period_days' in callArgs).toBe(false);
        done();
      });
    });
  });
});
