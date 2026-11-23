import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { Recipe } from './models/recipe.model';

describe('App', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    httpTesting.expectOne('/api/recipes').flush([]);
    httpTesting.expectOne('/api/collections').flush([]);
    httpTesting.expectOne('/api/auth/me').flush({ user: null });
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    httpTesting.expectOne('/api/recipes').flush([]);
    httpTesting.expectOne('/api/collections').flush([]);
    httpTesting.expectOne('/api/auth/me').flush({ user: null });
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Find your next');
  });

  it('shows a welcome message after a successful login', () => {
    const fixture = TestBed.createComponent(App);
    httpTesting.expectOne('/api/recipes').flush([]);
    httpTesting.expectOne('/api/collections').flush([]);
    httpTesting.expectOne('/api/auth/me').flush({ user: null });
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.topbar .add-header') as HTMLButtonElement).click();
    fixture.detectChanges();
    const email = fixture.nativeElement.querySelector('app-auth-dialog input[type="email"]') as HTMLInputElement;
    const password = fixture.nativeElement.querySelector('app-auth-dialog input[type="password"]') as HTMLInputElement;
    email.value = 'jamie@example.com';
    email.dispatchEvent(new Event('input'));
    password.value = 'a-secure-password';
    password.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.auth-submit') as HTMLButtonElement).click();

    httpTesting.expectOne({ method: 'POST', url: '/api/auth/login' }).flush({
      user: { id: 1, name: 'Jamie', email: 'jamie@example.com' },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain(
      'Welcome back, Jamie!',
    );
    expect(fixture.nativeElement.querySelector('app-auth-dialog')).toBeNull();
  });

  it('confirms account creation after a successful signup', () => {
    const fixture = TestBed.createComponent(App);
    httpTesting.expectOne('/api/recipes').flush([]);
    httpTesting.expectOne('/api/collections').flush([]);
    httpTesting.expectOne('/api/auth/me').flush({ user: null });
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.topbar .add-header') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.auth-mode button:last-child') as HTMLButtonElement).click();
    fixture.detectChanges();
    const inputs = fixture.nativeElement.querySelectorAll('app-auth-dialog input') as NodeListOf<HTMLInputElement>;
    inputs[0].value = 'Jamie Cook';
    inputs[0].dispatchEvent(new Event('input'));
    inputs[1].value = 'jamie@example.com';
    inputs[1].dispatchEvent(new Event('input'));
    inputs[2].value = 'a-secure-password';
    inputs[2].dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.auth-submit') as HTMLButtonElement).click();

    httpTesting.expectOne({ method: 'POST', url: '/api/auth/register' }).flush({
      user: { id: 1, name: 'Jamie Cook', email: 'jamie@example.com' },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain(
      'Your account is ready, Jamie Cook!',
    );
  });

  it('updates and persists a recipe rating when stars are selected', () => {
    const recipe: Recipe = {
      id: 1,
      title: 'Test recipe',
      category: 'Dinner',
      time: 30,
      rating: 2,
      steps: ['Cook until ready.'],
      image: 'https://example.com/recipe.jpg',
      accent: '#b85d45',
    };
    const fixture = TestBed.createComponent(App);
    httpTesting.expectOne('/api/recipes').flush([recipe]);
    httpTesting.expectOne('/api/collections').flush([]);
    httpTesting.expectOne('/api/auth/me').flush({ user: null });
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.recipe-card-open') as HTMLButtonElement).click();
    fixture.detectChanges();
    httpTesting.expectOne('/api/recipes/1/comments').flush([]);
    const thirdStar = fixture.nativeElement.querySelector(
      '.star-buttons button[aria-label="Rate 3.5 stars"]',
    ) as HTMLButtonElement;
    thirdStar.click();

    const request = httpTesting.expectOne({ method: 'PUT', url: '/api/recipes/1' });
    expect(request.request.body).toEqual({
      title: recipe.title,
      category: recipe.category,
      time: recipe.time,
      rating: 3.5,
      steps: recipe.steps,
      image: recipe.image,
    });
    request.flush({ ...recipe, rating: 3.5 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.star-buttons button.active').length).toBe(7);
    expect(fixture.nativeElement.querySelector('.rating-value')?.textContent).toContain('3.5 / 5');
  });
});
