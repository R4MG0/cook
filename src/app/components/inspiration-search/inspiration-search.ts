import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { InspirationRecipe } from '../../models/inspiration.model';
import { RecipeDraft } from '../../models/recipe.model';
import { RecipeService } from '../../services/recipe.service';

@Component({
  selector: 'app-inspiration-search',
  templateUrl: './inspiration-search.html',
  styleUrl: './inspiration-search.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InspirationSearch {
  protected readonly query = signal('');
  protected readonly results = signal<InspirationRecipe[]>([]);
  protected readonly loading = signal(false);
  protected readonly searched = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly addingRecipeId = signal<string | null>(null);
  protected readonly addError = signal<string | null>(null);

  private readonly recipeService = inject(RecipeService);

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected search(): void {
    const query = this.query().trim();
    if (!query) {
      this.error.set('Enter an ingredient or recipe to search.');
      return;
    }

    this.loading.set(true);
    this.searched.set(true);
    this.error.set(null);
    this.recipeService.searchInspiration(query).subscribe({
      next: (results) => {
        this.results.set(results);
        this.loading.set(false);
      },
      error: () => {
        this.results.set([]);
        this.loading.set(false);
        this.error.set('Recipe inspiration is unavailable right now. Please try again.');
      },
    });
  }

  protected isInMyRecipes(recipe: InspirationRecipe): boolean {
    const title = recipe.name.trim().toLowerCase();
    return this.recipeService.recipes().some((savedRecipe) => savedRecipe.title.trim().toLowerCase() === title);
  }

  protected addRecipe(recipe: InspirationRecipe): void {
    if (this.addingRecipeId() || this.isInMyRecipes(recipe)) {
      return;
    }

    this.addingRecipeId.set(recipe.id);
    this.addError.set(null);
    const draft: RecipeDraft = {
      title: recipe.name,
      category: ['Breakfast', 'Lunch', 'Dinner', 'Dessert'].includes(recipe.category)
        ? recipe.category
        : 'Dinner',
      time: 30,
      rating: 4.5,
      image: recipe.image,
      steps: this.toSteps(recipe),
    };

    this.recipeService.create(draft).subscribe({
      next: () => this.addingRecipeId.set(null),
      error: () => {
        this.addingRecipeId.set(null);
        this.addError.set(`Could not add "${recipe.name}". Please try again.`);
      },
    });
  }

  private toSteps(recipe: InspirationRecipe): string[] {
    const steps = recipe.instructions
      .split(/\r?\n|(?<=[.!?])\s+/)
      .map((step) => step.replace(/^\s*\d+[.)]\s*/, '').trim())
      .filter(Boolean);
    return steps.length > 0 ? steps : ['See the original recipe for preparation instructions.'];
  }
}
