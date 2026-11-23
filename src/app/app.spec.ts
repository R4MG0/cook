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
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    httpTesting.expectOne('/api/recipes').flush([]);
    httpTesting.expectOne('/api/collections').flush([]);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Find your next');
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
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.recipe-card-open') as HTMLButtonElement).click();
    fixture.detectChanges();
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
