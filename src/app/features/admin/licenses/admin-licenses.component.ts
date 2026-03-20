import { Component, ChangeDetectionStrategy, inject, OnInit, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminService } from '../../../core/api/admin.service';
import { License } from '../../../core/api/models/admin.models';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-admin-licenses',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-licenses.component.html',
  styleUrls: ['./admin-licenses.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminLicensesComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly licenses = signal<License[]>([]);
  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);
  protected readonly searchQuery = signal<string>('');
  protected readonly sortAsc = signal<boolean>(true);

  protected readonly filteredLicenses = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const asc = this.sortAsc();

    let result = this.licenses();
    if (query) {
      result = result.filter(license =>
        license.id.toString().includes(query) ||
        license.user_id.toString().includes(query) ||
        license.plan.toLowerCase().includes(query) ||
        (license.comment?.toLowerCase().includes(query) ?? false)
      );
    }

    return [...result].sort((a, b) => {
      const dateA = new Date(a.expiration_date).getTime();
      const dateB = new Date(b.expiration_date).getTime();
      return asc ? dateA - dateB : dateB - dateA;
    });
  });

  ngOnInit(): void {
    this.loadLicenses();
  }

  private loadLicenses(): void {
    this.loading.set(true);
    this.error.set(null);

    this.adminService.getAllLicenses().pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(() => {
        this.error.set('Не удалось загрузить лицензии');
        this.loading.set(false);
        return of([]);
      })
    ).subscribe(licenses => {
      this.licenses.set(licenses);
      this.loading.set(false);
    });
  }

  protected onSearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
  }

  protected retry(): void {
    this.loadLicenses();
  }

  protected toggleSort(): void {
    this.sortAsc.update(v => !v);
  }

  protected formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  protected isExpired(dateString: string): boolean {
    const expirationDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return expirationDate < today;
  }

  protected isExpiringSoon(dateString: string): boolean {
    const expirationDate = new Date(dateString);
    const today = new Date();
    const daysUntilExpiration = Math.floor((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiration >= 0 && daysUntilExpiration <= 30;
  }

  protected trackByLicenseId(index: number, license: License): number {
    return license.id;
  }

  protected onLicenseClick(license: License): void {
    this.router.navigate(['/admin/licenses', license.user_id]);
  }
}
