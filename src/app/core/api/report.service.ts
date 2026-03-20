import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { Report, IikoReport, CreateReportsRequest, GlobalSchedule, CreateGlobalScheduleRequest, UpdateGlobalScheduleRequest, UpdateReportRequest, IndividualSchedule, CreateIndividualScheduleRequest, UpdateIndividualScheduleRequest, GroupSchedule, CreateGroupScheduleRequest, UpdateGroupScheduleRequest } from './models/report.models';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private readonly apiClient = inject(ApiClientService);

  getReportsByConnectionId(connectionId: number): Observable<Report[]> {
    return this.apiClient.get<Report[]>(`/reports/${connectionId}`);
  }

  getIikoReports(connectionId: number): Observable<IikoReport[]> {
    return this.apiClient.get<IikoReport[]>(`/reports/${connectionId}/iiko_reports`);
  }

  createReports(connectionId: number, request: CreateReportsRequest): Observable<void> {
    return this.apiClient.post<void>(`/reports/${connectionId}`, request);
  }

  getGlobalSchedule(connectionId: number): Observable<GlobalSchedule> {
    return this.apiClient.get<GlobalSchedule>(`/schedules/global/${connectionId}`);
  }

  createGlobalSchedule(connectionId: number, request: CreateGlobalScheduleRequest): Observable<GlobalSchedule> {
    return this.apiClient.post<GlobalSchedule>(`/schedules/global/${connectionId}`, request);
  }

  updateGlobalSchedule(connectionId: number, request: UpdateGlobalScheduleRequest): Observable<GlobalSchedule> {
    return this.apiClient.patch<GlobalSchedule>(`/schedules/global/${connectionId}`, request);
  }

  getReport(reportId: number): Observable<Report> {
    return this.apiClient.get<Report>(`/reports/report/${reportId}`);
  }

  updateReport(reportId: number, request: UpdateReportRequest): Observable<Report> {
    // Явно включаем поля с null для корректной передачи на сервер
    const payload: UpdateReportRequest = {};

    if (request.delivery_type !== undefined) {
      payload.delivery_type = request.delivery_type;
    }
    if (request.format !== undefined) {
      payload.format = request.format;
    }
    if (request.schedule_type !== undefined) {
      payload.schedule_type = request.schedule_type;
    }

    return this.apiClient.patch<Report>(`/reports/${reportId}`, payload);
  }

  updateReportStructure(reportId: number): Observable<void> {
    return this.apiClient.post<void>(`/reports/${reportId}/update_structure`, {});
  }

  deleteReport(reportId: number): Observable<void> {
    return this.apiClient.delete<void>(`/reports/${reportId}`);
  }

  getIndividualSchedule(reportId: number): Observable<IndividualSchedule> {
    return this.apiClient.get<IndividualSchedule>(`/schedules/individual/${reportId}`);
  }

  createIndividualSchedule(reportId: number, request: CreateIndividualScheduleRequest): Observable<IndividualSchedule> {
    return this.apiClient.post<IndividualSchedule>(`/schedules/individual/${reportId}`, request);
  }

  updateIndividualSchedule(reportId: number, request: UpdateIndividualScheduleRequest): Observable<IndividualSchedule> {
    const payload: UpdateIndividualScheduleRequest = {};

    if (request.individual_cron !== undefined) {
      payload.individual_cron = request.individual_cron;
    }
    if (request.timezone !== undefined) {
      payload.timezone = request.timezone;
    }
    if (request.data_period_days !== undefined) {
      payload.data_period_days = request.data_period_days;
    }

    return this.apiClient.patch<IndividualSchedule>(`/schedules/individual/${reportId}`, payload);
  }

  getGroupSchedule(reportId: number, linkedChatId: number): Observable<GroupSchedule> {
    return this.apiClient.get<GroupSchedule>(`/schedules/groups_schedules/${reportId}/${linkedChatId}`);
  }

  createGroupSchedule(reportId: number, linkedChatId: number, request: CreateGroupScheduleRequest): Observable<GroupSchedule> {
    return this.apiClient.post<GroupSchedule>(`/schedules/groups_schedules/${reportId}/${linkedChatId}`, request);
  }

  updateGroupSchedule(reportId: number, linkedChatId: number, request: UpdateGroupScheduleRequest): Observable<GroupSchedule> {
    const payload: UpdateGroupScheduleRequest = {};

    if (request.group_cron !== undefined) {
      payload.group_cron = request.group_cron;
    }
    if (request.timezone !== undefined) {
      payload.timezone = request.timezone;
    }
    if (request.data_period_days !== undefined) {
      payload.data_period_days = request.data_period_days;
    }
    if (request.is_active !== undefined) {
      payload.is_active = request.is_active;
    }

    return this.apiClient.patch<GroupSchedule>(`/schedules/groups_schedules/${reportId}/${linkedChatId}`, payload);
  }
}
