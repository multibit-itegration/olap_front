import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApiClientService } from './api-client.service';
import { Report, IikoReport, CreateReportsRequest, GlobalSchedule, CreateGlobalScheduleRequest, UpdateGlobalScheduleRequest, UpdateReportRequest, IndividualSchedule, CreateIndividualScheduleRequest, UpdateIndividualScheduleRequest, GroupSchedule, CreateGroupScheduleRequest, UpdateGroupScheduleRequest } from './models/report.models';
import { getCachedRequest, RequestCacheEntry, setCachedValue } from './request-cache';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private readonly apiClient = inject(ApiClientService);
  private readonly shortCacheTtlMs = 2 * 60 * 1000;
  private readonly catalogCacheTtlMs = 10 * 60 * 1000;
  private readonly reportsCache = new Map<string, RequestCacheEntry<Report[]>>();
  private readonly iikoReportsCache = new Map<string, RequestCacheEntry<IikoReport[]>>();
  private readonly reportCache = new Map<string, RequestCacheEntry<Report>>();
  private readonly globalScheduleCache = new Map<string, RequestCacheEntry<GlobalSchedule>>();
  private readonly individualScheduleCache = new Map<string, RequestCacheEntry<IndividualSchedule>>();
  private readonly groupScheduleCache = new Map<string, RequestCacheEntry<GroupSchedule>>();

  getReportsByConnectionId(connectionId: number): Observable<Report[]> {
    return getCachedRequest(
      this.reportsCache,
      String(connectionId),
      this.shortCacheTtlMs,
      () => this.apiClient.get<Report[]>(`/reports/${connectionId}`)
    );
  }

  getIikoReports(connectionId: number): Observable<IikoReport[]> {
    return getCachedRequest(
      this.iikoReportsCache,
      String(connectionId),
      this.catalogCacheTtlMs,
      () => this.apiClient.get<IikoReport[]>(`/reports/${connectionId}/iiko_reports`)
    );
  }

  createReports(connectionId: number, request: CreateReportsRequest): Observable<void> {
    return this.apiClient.post<void>(`/reports/${connectionId}`, request).pipe(
      tap(() => this.reportsCache.delete(String(connectionId)))
    );
  }

  getGlobalSchedule(connectionId: number): Observable<GlobalSchedule> {
    return getCachedRequest(
      this.globalScheduleCache,
      String(connectionId),
      this.shortCacheTtlMs,
      () => this.apiClient.get<GlobalSchedule>(`/schedules/global/${connectionId}`)
    );
  }

  createGlobalSchedule(connectionId: number, request: CreateGlobalScheduleRequest): Observable<GlobalSchedule> {
    return this.apiClient.post<GlobalSchedule>(`/schedules/global/${connectionId}`, request).pipe(
      tap(schedule => setCachedValue(this.globalScheduleCache, String(connectionId), schedule, this.shortCacheTtlMs))
    );
  }

  updateGlobalSchedule(connectionId: number, request: UpdateGlobalScheduleRequest): Observable<GlobalSchedule> {
    return this.apiClient.patch<GlobalSchedule>(`/schedules/global/${connectionId}`, request).pipe(
      tap(schedule => setCachedValue(this.globalScheduleCache, String(connectionId), schedule, this.shortCacheTtlMs))
    );
  }

  getReport(reportId: number): Observable<Report> {
    return getCachedRequest(
      this.reportCache,
      String(reportId),
      this.shortCacheTtlMs,
      () => this.apiClient.get<Report>(`/reports/report/${reportId}`)
    );
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

    return this.apiClient.patch<Report>(`/reports/${reportId}`, payload).pipe(
      tap(report => {
        setCachedValue(this.reportCache, String(reportId), report, this.shortCacheTtlMs);
        this.reportsCache.clear();
      })
    );
  }

  updateReportStructure(reportId: number): Observable<void> {
    return this.apiClient.post<void>(`/reports/${reportId}/update_structure`, {}).pipe(
      tap(() => {
        this.reportCache.delete(String(reportId));
        this.reportsCache.clear();
      })
    );
  }

  deleteReport(reportId: number): Observable<void> {
    return this.apiClient.delete<void>(`/reports/${reportId}`).pipe(
      tap(() => {
        this.reportCache.delete(String(reportId));
        this.reportsCache.clear();
        this.individualScheduleCache.delete(String(reportId));
      })
    );
  }

  getIndividualSchedule(reportId: number): Observable<IndividualSchedule> {
    return getCachedRequest(
      this.individualScheduleCache,
      String(reportId),
      this.shortCacheTtlMs,
      () => this.apiClient.get<IndividualSchedule>(`/schedules/individual/${reportId}`)
    );
  }

  createIndividualSchedule(reportId: number, request: CreateIndividualScheduleRequest): Observable<IndividualSchedule> {
    return this.apiClient.post<IndividualSchedule>(`/schedules/individual/${reportId}`, request).pipe(
      tap(schedule => setCachedValue(this.individualScheduleCache, String(reportId), schedule, this.shortCacheTtlMs))
    );
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

    return this.apiClient.patch<IndividualSchedule>(`/schedules/individual/${reportId}`, payload).pipe(
      tap(schedule => setCachedValue(this.individualScheduleCache, String(reportId), schedule, this.shortCacheTtlMs))
    );
  }

  getGroupSchedule(reportId: number, linkedChatId: number): Observable<GroupSchedule> {
    return getCachedRequest(
      this.groupScheduleCache,
      this.getGroupScheduleCacheKey(reportId, linkedChatId),
      this.shortCacheTtlMs,
      () => this.apiClient.get<GroupSchedule>(`/schedules/groups_schedules/${reportId}/${linkedChatId}`)
    );
  }

  createGroupSchedule(reportId: number, linkedChatId: number, request: CreateGroupScheduleRequest): Observable<GroupSchedule> {
    return this.apiClient.post<GroupSchedule>(`/schedules/groups_schedules/${reportId}/${linkedChatId}`, request).pipe(
      tap(schedule => setCachedValue(
        this.groupScheduleCache,
        this.getGroupScheduleCacheKey(reportId, linkedChatId),
        schedule,
        this.shortCacheTtlMs
      ))
    );
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

    return this.apiClient.patch<GroupSchedule>(`/schedules/groups_schedules/${reportId}/${linkedChatId}`, payload).pipe(
      tap(schedule => setCachedValue(
        this.groupScheduleCache,
        this.getGroupScheduleCacheKey(reportId, linkedChatId),
        schedule,
        this.shortCacheTtlMs
      ))
    );
  }

  private getGroupScheduleCacheKey(reportId: number, linkedChatId: number): string {
    return `${reportId}:${linkedChatId}`;
  }
}
