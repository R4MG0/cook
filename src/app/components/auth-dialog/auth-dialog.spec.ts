import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthDialog } from './auth-dialog';

describe('AuthDialog', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthDialog],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('creates an account and closes after successful signup', () => {
    const fixture = TestBed.createComponent(AuthDialog);
    fixture.detectChanges();
    httpTesting.expectOne('/api/auth/me').flush({ user: null });
    const component = fixture.componentInstance;
    let closed = false;
    let authenticated: { mode: string; user: { id: number; name: string; email: string } } | undefined;
    component.closed.subscribe(() => {
      closed = true;
    });
    component.authenticated.subscribe((completion) => {
      authenticated = completion;
    });

    (fixture.nativeElement.querySelector('.auth-mode button:last-child') as HTMLButtonElement).click();
    fixture.detectChanges();
    const inputs = fixture.nativeElement.querySelectorAll('input') as NodeListOf<HTMLInputElement>;
    inputs[0].value = 'Jamie Cook';
    inputs[0].dispatchEvent(new Event('input'));
    inputs[1].value = 'jamie@example.com';
    inputs[1].dispatchEvent(new Event('input'));
    inputs[2].value = 'a-secure-password';
    inputs[2].dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.auth-submit') as HTMLButtonElement).click();
    const request = httpTesting.expectOne({ method: 'POST', url: '/api/auth/register' });
    expect(request.request.body).toEqual({
      name: 'Jamie Cook',
      email: 'jamie@example.com',
      password: 'a-secure-password',
    });
    request.flush({ user: { id: 1, name: 'Jamie Cook', email: 'jamie@example.com' } });
    expect(closed).toBe(true);
    expect(authenticated).toEqual({
      mode: 'register',
      user: { id: 1, name: 'Jamie Cook', email: 'jamie@example.com' },
    });
  });
});
