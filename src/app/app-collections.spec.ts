import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App collections', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  it('shows collections and filters recipes when one is selected', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    httpTesting.expectOne('/api/recipes').flush([
      {
        id: 1,
        title: 'Pasta',
        category: 'Dinner',
        time: 35,
        rating: 4.8,
        steps: ['Cook pasta'],
        accent: '#b85d45',
        image: 'https://example.com/pasta.jpg',
      },
      {
        id: 2,
        title: 'Salmon',
        category: 'Dinner',
        time: 40,
        rating: 4.9,
        steps: ['Cook salmon'],
        accent: '#c7865c',
        image: 'https://example.com/salmon.jpg',
      },
      {
        id: 3,
        title: 'Toast',
        category: 'Breakfast',
        time: 15,
        rating: 4.9,
        steps: ['Toast bread'],
        accent: '#9aa66c',
        image: 'https://example.com/toast.jpg',
      },
    ]);
    httpTesting.expectOne('/api/collections').flush([
      { id: 1, name: 'Weeknight Favorites', description: 'Comforting meals.', recipeIds: [1, 2] },
      { id: 2, name: 'Breakfast', description: 'Morning recipes.', recipeIds: [3] },
      { id: 3, name: 'Lunch', description: 'Lunch recipes.', recipeIds: [3] },
      { id: 4, name: 'Dessert', description: 'Sweet recipes.', recipeIds: [1] },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    const collections = fixture.nativeElement.querySelectorAll('.collection-card') as NodeListOf<HTMLElement>;
    expect(collections.length).toBe(4);

    const dinnerCollection = Array.from(collections).find((collection) =>
      collection.textContent?.includes('Weeknight Favorites'),
    );
    dinnerCollection?.querySelector('.collection-open')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    const recipeCards = fixture.nativeElement.querySelectorAll('.recipe-card') as NodeListOf<HTMLElement>;
    expect(recipeCards.length).toBe(2);
    expect(
      Array.from(recipeCards).every((card) => card.querySelector('.recipe-category')?.textContent?.trim() === 'Dinner'),
    ).toBe(true);
  });

  it('creates a collection with the selected recipes', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    httpTesting.expectOne('/api/recipes').flush([
      {
        id: 1,
        title: 'Pasta',
        category: 'Dinner',
        time: 35,
        rating: 4.8,
        steps: ['Cook pasta'],
        accent: '#b85d45',
        image: 'https://example.com/pasta.jpg',
      },
      {
        id: 2,
        title: 'Toast',
        category: 'Breakfast',
        time: 15,
        rating: 4.9,
        steps: ['Toast bread'],
        accent: '#9aa66c',
        image: 'https://example.com/toast.jpg',
      },
    ]);
    httpTesting.expectOne('/api/collections').flush([]);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.create-collection-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const nameInput = fixture.nativeElement.querySelector('.collection-field input') as HTMLInputElement;
    nameInput.value = 'Quick meals';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    const recipeCheckboxes = fixture.nativeElement.querySelectorAll(
      '.recipe-picker-option input',
    ) as NodeListOf<HTMLInputElement>;
    recipeCheckboxes[0].checked = true;
    recipeCheckboxes[0].dispatchEvent(new Event('change', { bubbles: true }));
    recipeCheckboxes[1].checked = true;
    recipeCheckboxes[1].dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('.collection-dialog form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const request = httpTesting.expectOne({ method: 'POST', url: '/api/collections' });
    expect(request.request.body).toEqual({
      name: 'Quick meals',
      description: '',
      recipeIds: [1, 2],
    });
    request.flush({ id: 1, name: 'Quick meals', description: '', recipeIds: [1, 2] });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.collection-title')?.textContent).toContain('Quick meals');
  });
});
