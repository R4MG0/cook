import { TestBed } from '@angular/core/testing';
import { Recipe } from '../../models/recipe.model';
import { RecipeForm } from './recipe-form';

describe('RecipeForm', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipeForm],
    }).compileComponents();
  });

  it('submits recipe steps in order', async () => {
    const fixture = TestBed.createComponent(RecipeForm);
    const recipe: Recipe = {
      id: 1,
      title: 'Test recipe',
      category: 'Dinner',
      time: 30,
      rating: 4.5,
      steps: ['First step', 'Second step'],
      image: 'https://example.com/image.jpg',
      accent: '#b85d45',
    };
    fixture.componentRef.setInput('recipe', recipe);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    let submittedSteps: string[] | undefined;
    fixture.componentInstance.submitted.subscribe((draft) => {
      submittedSteps = draft.steps;
    });

    const addButton = fixture.nativeElement.querySelector('.add-step-button') as HTMLButtonElement;
    addButton.click();
    fixture.detectChanges();

    const textareas = fixture.nativeElement.querySelectorAll('textarea') as NodeListOf<HTMLTextAreaElement>;
    textareas[2].value = 'Third step';
    textareas[2].dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(submittedSteps).toEqual(['First step', 'Second step', 'Third step']);
  });
});
