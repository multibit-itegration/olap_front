import { Component, ChangeDetectionStrategy, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AdminService } from '../../../core/api/admin.service';
import { License, LicenseUpdateRequest } from '../../../core/api/models/admin.models';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-admin-license-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-license-settings.component.html',
  styleUrls: ['./admin-license-settings.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminLicenseSettingsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly adminService = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly license = signal<License | null>(null);
  protected readonly loading = signal<boolean>(true);
  protected readonly saving = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  // Form fields
  protected readonly formPlan = signal<string>('');
  protected readonly formExpirationDate = signal<string>('');
  protected readonly formRmsId = signal<string>('');
  protected readonly formContractNum = signal<string>('');
  protected readonly formComment = signal<string>('');

  ngOnInit(): void {
    const userId = this.route.snapshot.paramMap.get('id');
    if (!userId || isNaN(Number(userId))) {
      this.error.set('Неверный ID пользователя');
      this.loading.set(false);
      return;
    }

    this.loadLicense(Number(userId));
  }

  private loadLicense(userId: number): void {
    this.loading.set(true);
    this.error.set(null);

    this.adminService.getLicenseByUserId(userId).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(() => {
        this.error.set('Не удалось загрузить данные лицензии');
        this.loading.set(false);
        return of(null);
      })
    ).subscribe(license => {
      if (license) {
        this.license.set(license);
        this.formPlan.set(license.plan);
        this.formExpirationDate.set(license.expiration_date);
        this.formRmsId.set(license.rms_id || '');
        this.formContractNum.set(license.contract_num || '');
        this.formComment.set(license.comment || '');
      }
      this.loading.set(false);
    });
  }

  protected onInputChange(event: Event, field: 'plan' | 'expirationDate' | 'rmsId' | 'contractNum' | 'comment'): void {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    switch (field) {
      case 'plan': this.formPlan.set(value); break;
      case 'expirationDate': this.formExpirationDate.set(value); break;
      case 'rmsId': this.formRmsId.set(value); break;
      case 'contractNum': this.formContractNum.set(value); break;
      case 'comment': this.formComment.set(value); break;
    }
  }

  protected retry(): void {
    const userId = this.route.snapshot.paramMap.get('id');
    if (userId) this.loadLicense(Number(userId));
  }

  protected onSave(): void {
    const license = this.license();
    if (!license || this.saving()) return;

    this.successMessage.set(null);
    this.error.set(null);

    // Validate required fields
    if (!this.formPlan().trim()) {
      this.error.set('План обязателен для заполнения');
      return;
    }

    if (!this.formExpirationDate().trim()) {
      this.error.set('Дата истечения обязательна для заполнения');
      return;
    }

    // Build update request with only changed fields
    const updateData: LicenseUpdateRequest = {};

    if (this.formPlan() !== license.plan) {
      updateData.plan = this.formPlan();
    }

    if (this.formExpirationDate() !== license.expiration_date) {
      updateData.expiration_date = this.formExpirationDate();
    }

    if (this.formRmsId() !== (license.rms_id || '')) {
      updateData.rms_id = this.formRmsId() || null;
    }

    if (this.formContractNum() !== (license.contract_num || '')) {
      updateData.contract_num = this.formContractNum() || null;
    }

    if (this.formComment() !== (license.comment || '')) {
      updateData.comment = this.formComment() || null;
    }

    // If no changes, show message
    if (Object.keys(updateData).length === 0) {
      this.successMessage.set('Нет изменений для сохранения');
      return;
    }

    this.saving.set(true);

    this.adminService.updateLicense(license.id, updateData).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(() => {
        this.error.set('Не удалось обновить данные лицензии');
        this.saving.set(false);
        return of(null);
      })
    ).subscribe(response => {
      if (response) {
        // Update local license data
        this.license.set(response);
        this.formPlan.set(response.plan);
        this.formExpirationDate.set(response.expiration_date);
        this.formRmsId.set(response.rms_id || '');
        this.formContractNum.set(response.contract_num || '');
        this.formComment.set(response.comment || '');
        this.successMessage.set('Изменения успешно сохранены');
      }
      this.saving.set(false);
    });
  }

  protected onDelete(): void {
    const license = this.license();
    if (!license || this.saving()) return;

    const confirmed = confirm(
      `Вы уверены, что хотите удалить лицензию #${license.id}?\n\nЭто действие нельзя отменить.`
    );

    if (!confirmed) return;

    this.saving.set(true);
    this.error.set(null);

    this.adminService.deleteLicense(license.id).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(() => {
        this.error.set('Не удалось удалить лицензию');
        this.saving.set(false);
        return of(null);
      })
    ).subscribe(() => {
      this.saving.set(false);
      this.router.navigate(['/admin/licenses']);
    });
  }

  protected onBack(): void {
    this.router.navigate(['/admin/licenses']);
  }
}
