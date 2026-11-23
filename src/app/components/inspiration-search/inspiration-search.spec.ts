import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { InspirationSearch } from './inspiration-search';

describe('InspirationSearch', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InspirationSearch],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('searches and renders recipe inspiration results', async () => {
    const fixture = TestBed.createComponent(InspirationSearch);
    httpTesting.expectOne('/api/recipes').flush([]);
    httpTesting.expectOne('/api/collections').flush([]);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#inspiration-query') as HTMLInputElement;
    input.value = 'chicken curry';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );

    const request = httpTesting.expectOne(
      (candidate) =>
        candidate.url === '/api/inspiration' && candidate.params.get('q') === 'chicken curry',
    );
    request.flush([{
      id: '52772',
      name: 'Chicken Curry',
      category: 'Chicken',
      area: 'Indian',
      image: 'https://example.com/curry.jpg',
      source: 'https://example.com/recipe',
      instructions: 'Simmer until cooked.',
      ingredients: [{ name: 'Chicken', measure: '2 cups' }],
    }]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.inspiration-card h3')?.textContent).toContain('Chicken Curry');
    expect(compiled.querySelector('.source-link')?.getAttribute('href')).toBe(
      'https://example.com/recipe',
    );
    expect(compiled.textContent).toContain('2 cups Chicken');
  });

  it('shows an error when the inspiration request fails', () => {
    const fixture = TestBed.createComponent(InspirationSearch);
    httpTesting.expectOne('/api/recipes').flush([]);
    httpTesting.expectOne('/api/collections').flush([]);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#inspiration-query') as HTMLInputElement;
    input.value = 'pasta';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    httpTesting.expectOne('/api/inspiration?q=pasta').flush(
      { error: 'Unavailable' },
      { status: 502, statusText: 'Bad Gateway' },
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'unavailable right now',
    );
  });

  it('saves an inspiration recipe and marks it as added', () => {
    const fixture = TestBed.createComponent(InspirationSearch);
    httpTesting.expectOne('/api/recipes').flush([]);
    httpTesting.expectOne('/api/collections').flush([]);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#inspiration-query') as HTMLInputElement;
    input.value = 'chicken';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    httpTesting.expectOne('/api/inspiration?q=chicken').flush([{
      id: '52772',
      name: 'Chicken Curry',
      category: 'Chicken',
      area: 'Indian',
      image: 'https://example.com/curry.jpg',
      source: 'https://example.com/recipe',
      instructions: 'Brown chicken. Simmer with sauce.',
      ingredients: [],
    }]);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.add-recipe-button') as HTMLButtonElement).click();
    const createRequest = httpTesting.expectOne(
      (request) => request.url === '/api/recipes' && request.method === 'POST',
    );
    expect(createRequest.request.body).toEqual({
      title: 'Chicken Curry',
      category: 'Dinner',
      time: 30,
      rating: 4.5,
      image: 'https://example.com/curry.jpg',
      steps: ['Brown chicken.', 'Simmer with sauce.'],
    });
    createRequest.flush({
      ...createRequest.request.body,
      id: 8,
      accent: '#b85d45',
    });
    fixture.detectChanges();

    const addButton = fixture.nativeElement.querySelector('.add-recipe-button') as HTMLButtonElement;
    expect(addButton.textContent).toContain('Added to my recipes');
    expect(addButton.disabled).toBe(true);
  });
});
