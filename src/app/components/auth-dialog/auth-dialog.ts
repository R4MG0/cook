import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { AuthCompletion } from '../../models/auth.model';
import { AuthService } from '../../services/auth.service';

type AuthMode = 'login' | 'register';

@Component({
  selector: 'app-auth-dialog',
  templateUrl: './auth-dialog.html',
  styleUrl: './auth-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthDialog {
  readonly closed = output<void>();
  readonly authenticated = output<AuthCompletion>();

  protected readonly mode = signal<AuthMode>('login');
  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly submitting = signal(false);
  protected readonly formError = signal<string | null>(null);

  private readonly authService = inject(AuthService);

  protected setMode(mode: AuthMode): void {
    this.mode.set(mode);
    this.password.set('');
    this.formError.set(null);
  }

  protected updateName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }

  protected updateEmail(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
  }

  protected updatePassword(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    if (this.submitting()) {
      return;
    }

    this.formError.set(null);
    this.submitting.set(true);
    const mode = this.mode();
    const request = mode === 'register'
      ? this.authService.register({
          name: this.name().trim(),
          email: this.email().trim(),
          password: this.password(),
        })
      : this.authService.login({
          email: this.email().trim(),
          password: this.password(),
        });

    request.pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: (user) => {
        this.authenticated.emit({ mode, user });
        this.closed.emit();
      },
      error: (error: unknown) => this.formError.set(this.getErrorMessage(error)),
    });
  }

  protected close(): void {
    if (!this.submitting()) {
      this.closed.emit();
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && typeof error.error?.error === 'string') {
      return error.error.error;
    }
    return 'Could not sign in. Please try again.';
  }
}
