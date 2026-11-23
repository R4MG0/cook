import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RecipeComments } from './recipe-comments';

describe('RecipeComments', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipeComments],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('loads signed-in users’ experiences and posts a new comment', () => {
    const fixture = TestBed.createComponent(RecipeComments);
    fixture.componentRef.setInput('recipeId', 1);
    fixture.detectChanges();
    httpTesting.expectOne('/api/auth/me').flush({
      user: { id: 1, name: 'Jamie', email: 'jamie@example.com' },
    });
    httpTesting.expectOne('/api/recipes/1/comments').flush([
      { id: 1, author: 'Alex', body: 'Added extra herbs.', createdAt: '2026-01-01T10:00:00.000Z' },
    ]);
    fixture.detectChanges();

    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'Excellent for leftovers.';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.comment-submit') as HTMLButtonElement).click();

    const request = httpTesting.expectOne({ method: 'POST', url: '/api/recipes/1/comments' });
    expect(request.request.body).toEqual({ body: 'Excellent for leftovers.' });
    request.flush({
      id: 2,
      author: 'Jamie',
      body: 'Excellent for leftovers.',
      createdAt: '2026-01-02T10:00:00.000Z',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Added extra herbs.');
    expect(fixture.nativeElement.textContent).toContain('Excellent for leftovers.');
  });

  it('asks signed-out visitors to sign in before commenting', () => {
    const fixture = TestBed.createComponent(RecipeComments);
    fixture.componentRef.setInput('recipeId', 1);
    fixture.detectChanges();
    httpTesting.expectOne('/api/auth/me').flush({ user: null });
    httpTesting.expectOne('/api/recipes/1/comments').flush([]);
    fixture.detectChanges();

    let loginRequested = false;
    fixture.componentInstance.loginRequested.subscribe(() => {
      loginRequested = true;
    });
    (fixture.nativeElement.querySelector('.comment-signin button') as HTMLButtonElement).click();
    expect(loginRequested).toBe(true);
  });
});
