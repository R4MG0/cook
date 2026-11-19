import { TestBed } from '@angular/core/testing';
import { Recipe } from '../../models/recipe.model';
import { CookPage } from './cook-page';

describe('CookPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CookPage],
    }).compileComponents();
  });

  it('moves through the recipe instructions and finishes cooking', () => {
    const fixture = TestBed.createComponent(CookPage);
    const recipe: Recipe = {
      id: 1,
      title: 'Test recipe',
      category: 'Dinner',
      time: 30,
      rating: 4.5,
      steps: ['Stir together', 'Bake until golden'],
      image: 'https://example.com/image.jpg',
      accent: '#b85d45',
    };
    fixture.componentRef.setInput('recipe', recipe);
    fixture.detectChanges();

    const instruction = (): string =>
      (fixture.nativeElement.querySelector('.instruction-card p') as HTMLElement).textContent ?? '';
    expect(instruction()).toContain('Stir together');

    const nextButton = fixture.nativeElement.querySelector('.next-button') as HTMLButtonElement;
    nextButton.click();
    fixture.detectChanges();
    expect(instruction()).toContain('Bake until golden');
    expect(fixture.nativeElement.querySelector('.step-count')?.textContent).toContain('Step 2 of 2');

    let closed = false;
    fixture.componentInstance.closed.subscribe(() => {
      closed = true;
    });
    const finishButton = fixture.nativeElement.querySelector('.next-button') as HTMLButtonElement;
    finishButton.click();
    expect(closed).toBe(true);
  });
});
