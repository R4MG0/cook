import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { Recipe } from '../../models/recipe.model';

@Component({
  selector: 'app-cook-page',
  templateUrl: './cook-page.html',
  styleUrl: './cook-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CookPage {
  readonly recipe = input.required<Recipe>();
  readonly closed = output<void>();

  protected readonly currentStepIndex = signal(0);
  protected readonly totalSteps = computed(() => this.recipe().steps.length);
  protected readonly progress = computed(() =>
    this.totalSteps() ? ((this.currentStepIndex() + 1) / this.totalSteps()) * 100 : 0,
  );

  constructor() {
    effect(() => {
      this.recipe();
      this.currentStepIndex.set(0);
    });
  }

  protected previousStep(): void {
    this.currentStepIndex.update((index) => Math.max(0, index - 1));
  }

  protected nextStep(): void {
    this.currentStepIndex.update((index) => Math.min(this.totalSteps() - 1, index + 1));
  }

  protected finish(): void {
    this.closed.emit();
  }
}
