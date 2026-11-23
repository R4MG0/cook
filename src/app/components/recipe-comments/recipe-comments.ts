import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { CommentService } from '../../services/comment.service';
import { RecipeComment } from '../../models/comment.model';

@Component({
  selector: 'app-recipe-comments',
  templateUrl: './recipe-comments.html',
  styleUrl: './recipe-comments.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeComments {
  readonly recipeId = input.required<number>();
  readonly loginRequested = output<void>();

  protected readonly comments = signal<RecipeComment[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly commentBody = signal('');
  protected readonly submitting = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly authService = inject(AuthService);

  private readonly commentService = inject(CommentService);

  constructor() {
    effect((onCleanup) => {
      const recipeId = this.recipeId();
      this.loading.set(true);
      this.loadError.set(null);
      const subscription = this.commentService.list(recipeId).subscribe({
        next: (comments) => {
          this.comments.set(comments);
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set('Could not load experiences for this recipe.');
          this.loading.set(false);
        },
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  protected updateCommentBody(event: Event): void {
    this.commentBody.set((event.target as HTMLTextAreaElement).value);
  }

  protected submitComment(event: Event): void {
    event.preventDefault();
    const body = this.commentBody().trim();
    if (!body || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.formError.set(null);
    this.commentService.create(this.recipeId(), body).subscribe({
      next: (comment) => {
        this.comments.update((comments) => [comment, ...comments]);
        this.commentBody.set('');
        this.submitting.set(false);
      },
      error: (error: unknown) => {
        this.formError.set(this.getErrorMessage(error));
        this.submitting.set(false);
      },
    });
  }

  protected requestLogin(): void {
    this.loginRequested.emit();
  }

  protected formatDate(value: string): string {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 401) {
      return 'Your session expired. Sign in again to share your experience.';
    }
    if (error instanceof HttpErrorResponse && typeof error.error?.error === 'string') {
      return error.error.error;
    }
    return 'Could not post your experience. Please try again.';
  }
}
