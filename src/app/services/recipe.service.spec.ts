import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Recipe, RecipeDraft } from '../models/recipe.model';
import { RecipeService } from './recipe.service';

describe('RecipeService', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RecipeService, provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('loads recipes and updates the local list after backend CRUD operations', () => {
    const service = TestBed.inject(RecipeService);
    const original: Recipe = {
      id: 1,
      title: 'Test recipe',
      category: 'Dinner',
      time: 30,
      rating: 4.5,
      steps: ['First step'],
      image: 'https://example.com/image.jpg',
      accent: '#b85d45',
    };
    httpTesting.expectOne('/api/recipes').flush([original]);
    httpTesting.expectOne('/api/collections').flush([]);
    expect(service.recipes()).toEqual([original]);
    expect(service.loading()).toBe(false);

    const draft: RecipeDraft = { ...original, steps: ['Mix', 'Bake'] };
    let created: Recipe | undefined;
    service.create(draft).subscribe((recipe) => {
      created = recipe;
    });
    httpTesting.expectOne({ method: 'POST', url: '/api/recipes' }).flush({ ...draft, id: 2 });
    expect(created?.steps).toEqual(['Mix', 'Bake']);
    expect(service.recipes().map((recipe) => recipe.id)).toEqual([1, 2]);

    service.update(2, { ...draft, title: 'Updated recipe' }).subscribe();
    httpTesting
      .expectOne({ method: 'PUT', url: '/api/recipes/2' })
      .flush({ ...draft, id: 2, title: 'Updated recipe' });
    expect(service.read(2)?.title).toBe('Updated recipe');

    service.delete(2).subscribe();
    httpTesting.expectOne({ method: 'DELETE', url: '/api/recipes/2' }).flush(null);
    expect(service.recipes().map((recipe) => recipe.id)).toEqual([1]);

    service
      .createCollection({ name: 'Dinner ideas', description: '', recipeIds: [1] })
      .subscribe();
    httpTesting
      .expectOne({ method: 'POST', url: '/api/collections' })
      .flush({ id: 3, name: 'Dinner ideas', description: '', recipeIds: [1] });
    expect(service.collections()[0].name).toBe('Dinner ideas');

    service.updateCollection(3, { name: 'Favorites', description: '', recipeIds: [1] }).subscribe();
    httpTesting
      .expectOne({ method: 'PUT', url: '/api/collections/3' })
      .flush({ id: 3, name: 'Favorites', description: '', recipeIds: [1] });
    expect(service.collections()[0].name).toBe('Favorites');

    service.deleteCollection(3).subscribe();
    httpTesting.expectOne({ method: 'DELETE', url: '/api/collections/3' }).flush(null);
    expect(service.collections()).toEqual([]);
  });

  it('surfaces a recipe-load failure', () => {
    const service = TestBed.inject(RecipeService);
    httpTesting.expectOne('/api/collections').flush([]);
    httpTesting.expectOne('/api/recipes').flush('offline', {
      status: 500,
      statusText: 'Server error',
    });
    expect(service.loading()).toBe(false);
    expect(service.error()).toContain('recipe server');
  });
});
