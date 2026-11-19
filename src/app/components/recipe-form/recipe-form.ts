import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { FormArray, FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Recipe, RecipeDraft } from '../../models/recipe.model';

@Component({
  selector: 'app-recipe-form',
  imports: [ReactiveFormsModule],
  templateUrl: './recipe-form.html',
  styleUrl: './recipe-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeForm {
  readonly recipe = input<Recipe | null>(null);
  readonly submitted = output<RecipeDraft>();
  readonly cancelled = output<void>();

  private readonly fb = inject(FormBuilder);

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(80)]],
    category: ['Dinner', Validators.required],
    time: [30, [Validators.required, Validators.min(1), Validators.max(999)]],
    rating: [4.5, [Validators.required, Validators.min(1), Validators.max(5)]],
    image: ['', Validators.required],
    steps: this.fb.array([this.createStepControl()]),
  });

  protected get steps(): FormArray<FormControl<string>> {
    return this.form.controls.steps;
  }

  constructor() {
    effect(() => {
      const recipe = this.recipe();
      this.steps.clear();
      for (const step of recipe?.steps ?? ['']) {
        this.steps.push(this.createStepControl(step));
      }

      if (recipe) {
        this.form.reset({
          title: recipe.title,
          category: recipe.category,
          time: recipe.time,
          rating: recipe.rating,
          image: recipe.image,
          steps: recipe.steps,
        });
      } else {
        this.form.reset({ title: '', category: 'Dinner', time: 30, rating: 4.5, image: '', steps: [''] });
      }
    });
  }

  protected addStep(): void {
    this.steps.push(this.createStepControl());
  }

  protected removeStep(index: number): void {
    if (this.steps.length > 1) {
      this.steps.removeAt(index);
    }
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const draft = this.form.getRawValue();
    this.submitted.emit({ ...draft, steps: draft.steps.map((step) => step.trim()) });
  }

  protected close(): void {
    this.cancelled.emit();
  }

  private createStepControl(value = ''): FormControl<string> {
    return this.fb.nonNullable.control(value, Validators.required);
  }
}
