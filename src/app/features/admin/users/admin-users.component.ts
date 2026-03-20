import { Component, ChangeDetectionStrategy, inject, OnInit, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminService } from '../../../core/api/admin.service';
import { User } from '../../../core/api/models/user.models';
import { IikoConnection } from '../../../core/api/models/admin.models';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

interface UserWithConnections extends User {
  iikoConnections: IikoConnection[];
  iikoConnectionsLoading: boolean;
}

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminUsersComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly users = signal<UserWithConnections[]>([]);
  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);
  protected readonly searchQuery = signal<string>('');
  protected readonly sortAsc = signal<boolean>(true);
  protected readonly showMobileSearch = signal<boolean>(false);

  protected readonly filteredUsers = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const asc = this.sortAsc();

    let result = this.users();
    if (query) {
      result = result.filter(user =>
        user.name.toLowerCase().includes(query)
      );
    }

    return [...result].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, 'ru');
      return asc ? cmp : -cmp;
    });
  });

  ngOnInit(): void {
    this.loadUsers();
  }

  private loadUsers(): void {
    this.loading.set(true);
    this.error.set(null);

    this.adminService.getAllUsers().pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(() => {
        this.error.set('Не удалось загрузить пользователей');
        this.loading.set(false);
        return of([]);
      })
    ).subscribe(users => {
      const usersWithConnections: UserWithConnections[] = users.map(user => ({
        ...user,
        iikoConnections: [],
        iikoConnectionsLoading: true
      }));

      this.users.set(usersWithConnections);
      this.loading.set(false);

      this.loadIikoConnections(usersWithConnections);
    });
  }

  private loadIikoConnections(users: UserWithConnections[]): void {
    if (users.length === 0) return;

    // TODO: Performance Issue - N+1 Query Problem
    // This creates N separate HTTP requests (one per user).
    // For 100 users = 100 HTTP requests, which is inefficient.
    //
    // Recommendation: Implement a batch endpoint in the backend:
    // GET /iiko_connections/batch?user_ids=1,2,3,4,5
    // Returns: { "1": [...], "2": [...], "3": [...] }
    //
    // Then replace this method with a single request:
    // this.adminService.getIikoConnectionsByUserIds(users.map(u => u.id))
    const requests = users.map(user =>
      this.adminService.getIikoConnectionsByUserId(user.id).pipe(
        catchError((error) => {
          // Handle any error (404, network error, timeout) by returning empty array
          console.debug(`Failed to load iiko connections for user ${user.id}:`, error.status || 'network error');
          return of([] as IikoConnection[]);
        }),
        map(connections => ({ userId: user.id, connections }))
      )
    );

    forkJoin(requests).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(() => {
        // Fallback: if forkJoin itself fails, reset all loading states
        const updatedUsers = this.users().map(user => ({
          ...user,
          iikoConnections: [],
          iikoConnectionsLoading: false
        }));
        this.users.set(updatedUsers);
        return of([]);
      })
    ).subscribe(results => {
      if (results.length === 0) return; // Already handled in catchError

      const connectionsMap = new Map(results.map(r => [r.userId, r.connections]));
      const updatedUsers = this.users().map(user => ({
        ...user,
        iikoConnections: connectionsMap.get(user.id) ?? [],
        iikoConnectionsLoading: false
      }));
      this.users.set(updatedUsers);
    });
  }

  protected onSearchChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
  }

  protected retry(): void {
    this.loadUsers();
  }

  protected toggleSort(): void {
    this.sortAsc.update(v => !v);
  }

  protected getConnectionsDisplay(user: UserWithConnections): string {
    if (user.iikoConnectionsLoading) {
      return 'Загрузка...';
    }

    if (user.iikoConnections.length === 0) {
      return '—';
    }

    const names = user.iikoConnections.map(c => c.name);
    if (names.length <= 2) {
      return names.join(', ');
    }

    return `${names.slice(0, 2).join(', ')}...`;
  }

  protected getConnectionsTooltip(user: UserWithConnections): string {
    if (user.iikoConnectionsLoading || user.iikoConnections.length === 0) {
      return '';
    }
    return user.iikoConnections.map(c => c.name).join(', ');
  }

  protected trackByUserId(index: number, user: UserWithConnections): number {
    return user.id;
  }

  protected onUserClick(user: UserWithConnections): void {
    this.router.navigate(['/admin/users', user.id, 'databases']);
  }

  protected onUserSettings(user: UserWithConnections, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/admin/users', user.id]);
  }

  protected toggleMobileSearch(): void {
    this.showMobileSearch.update(v => !v);
    if (!this.showMobileSearch()) {
      this.searchQuery.set('');
    }
  }
}
