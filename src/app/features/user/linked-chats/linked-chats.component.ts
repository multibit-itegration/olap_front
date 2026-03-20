import { Component, ChangeDetectionStrategy, inject, OnInit, OnDestroy, signal, DestroyRef, input, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { LinkedChatsService } from '../../../core/api/linked-chats.service';
import { AuthService } from '../../../core/api/auth.service';
import { LinkedChat } from '../../../core/api/models/linked-chats.models';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-linked-chats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './linked-chats.component.html',
  styleUrls: ['./linked-chats.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LinkedChatsComponent implements OnInit, OnDestroy {
  private readonly linkedChatsService = inject(LinkedChatsService);
  protected readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  // Optional input for viewing a specific user's chats (used by admin)
  // If not provided, defaults to current user's chats
  readonly targetUserId = input<number | undefined>(undefined);

  protected readonly chats = signal<LinkedChat[]>([]);
  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);
  protected readonly updateError = signal<string | null>(null);
  protected readonly userId = signal<number>(0);

  // Computed signal to check if viewing another user's chats (admin mode)
  protected readonly isAdminView = computed(() => {
    const currentUser = this.authService.currentUser();
    return currentUser && this.userId() !== currentUser.id;
  });

  // Track which chat is being updated
  protected readonly updatingChatId = signal<number | null>(null);

  // Timeout ID for cleanup
  private errorTimeoutId?: number;

  private extractUserIdFromRoute(): string | null {
    // Most reliable: extract from current URL (e.g. /admin/users/89/linked-chats)
    const urlMatch = this.router.url.match(/\/users\/(\d+)\/linked-chats/);
    if (urlMatch) return urlMatch[1];

    // Try own route params
    const ownId = this.route.snapshot.paramMap.get('id');
    if (ownId) return ownId;

    // Try parent route params
    const parentId = this.route.parent?.snapshot.paramMap.get('id');
    if (parentId) return parentId;

    return null;
  }

  ngOnInit(): void {
    // Check if userId is provided via route params (admin viewing specific user)
    const routeUserId = this.extractUserIdFromRoute();

    if (routeUserId) {
      // Admin viewing specific user's chats
      this.userId.set(Number(routeUserId));
      this.loadLinkedChats();
    } else if (this.targetUserId() !== undefined) {
      // userId provided via input
      this.userId.set(this.targetUserId()!);
      this.loadLinkedChats();
    } else {
      // Default: current user's chats
      const currentUser = this.authService.currentUser();

      if (!currentUser) {
        // If user not loaded yet, try to load
        this.authService.loadCurrentUser().pipe(
          takeUntilDestroyed(this.destroyRef)
        ).subscribe({
          next: user => {
            this.userId.set(user.id);
            this.loadLinkedChats();
          },
          error: () => {
            this.router.navigate(['/login']);
          }
        });
      } else {
        this.userId.set(currentUser.id);
        this.loadLinkedChats();
      }
    }
  }

  private loadLinkedChats(): void {
    this.loading.set(true);
    this.error.set(null);

    this.linkedChatsService.getLinkedChats(this.userId()).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err: HttpErrorResponse) => {
        if (err.status === 404) {
          // No linked chats found - return empty array
          return of([]);
        }
        this.error.set('Не удалось загрузить привязанные чаты');
        this.loading.set(false);
        return of([]);
      })
    ).subscribe(chats => {
      this.chats.set(chats);
      this.loading.set(false);
    });
  }

  protected retry(): void {
    this.loadLinkedChats();
  }

  protected onToggleStatus(chat: LinkedChat): void {
    this.updatingChatId.set(chat.id);
    this.updateError.set(null);

    const newStatus = !chat.is_active;

    this.linkedChatsService.updateLinkedChat(chat.id, { is_active: newStatus }).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((err: HttpErrorResponse) => {
        this.updateError.set('Не удалось обновить статус чата');
        this.updatingChatId.set(null);
        // Auto-clear error after 5 seconds
        if (this.errorTimeoutId !== undefined) {
          clearTimeout(this.errorTimeoutId);
        }
        this.errorTimeoutId = window.setTimeout(() => this.updateError.set(null), 5000);
        return of(null);
      })
    ).subscribe(updatedChat => {
      if (updatedChat) {
        // Update the chat in the list
        const updatedChats = this.chats().map(c =>
          c.id === updatedChat.id ? updatedChat : c
        );
        this.chats.set(updatedChats);
      }
      this.updatingChatId.set(null);
    });
  }

  protected trackByChatId(index: number, chat: LinkedChat): number {
    return chat.id;
  }

  protected onBack(): void {
    const routeUserId = this.extractUserIdFromRoute();
    if (routeUserId) {
      this.router.navigate(['/admin/users', routeUserId]);
    } else {
      this.router.navigate(['/admin/users']);
    }
  }

  ngOnDestroy(): void {
    if (this.errorTimeoutId !== undefined) {
      clearTimeout(this.errorTimeoutId);
    }
  }
}
