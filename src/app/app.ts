import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Recipe, RecipeDraft } from './models/recipe.model';
import { RecipeCollection, RecipeCollectionDraft } from './models/collection.model';
import { RecipeService } from './services/recipe.service';
import { RecipeForm } from './components/recipe-form/recipe-form';
import { CookPage } from './components/cook-page/cook-page';
import { InspirationSearch } from './components/inspiration-search/inspiration-search';
import { AuthDialog } from './components/auth-dialog/auth-dialog';
import { RecipeComments } from './components/recipe-comments/recipe-comments';
import { ChatBot } from './components/chat-bot/chat-bot';
import { AuthService } from './services/auth.service';
import { AuthCompletion } from './models/auth.model';

@Component({
  selector: 'app-root',
  imports: [RecipeForm, CookPage, InspirationSearch, AuthDialog, RecipeComments, ChatBot],
  template: `
    @if (cookingRecipe(); as recipe) {
      <app-cook-page [recipe]="recipe" (closed)="closeCooking()" />
    } @else {
      <div class="app-shell">
      <header class="topbar">
        <a class="brand" href="#" aria-label="Cook home"><span class="brand-mark">C</span><span>Cook</span></a>
        <nav class="main-nav" aria-label="Main navigation"><a class="active" href="#recipes">Recipes</a><a href="#collections">Collections</a><a href="#about">About</a></nav>
        @if (authService.user(); as user) {
          <button class="add-header" type="button" (click)="logout()" [attr.aria-label]="'Sign out ' + user.name">Log out</button>
        } @else {
          <button class="add-header" type="button" [disabled]="authService.loading()" (click)="openAuthDialog()">
            {{ authService.loading() ? 'Checking…' : 'Log in' }}
          </button>
        }
        <button class="add-header" type="button" (click)="openCreate()">+ Add recipe</button>
      </header>

      <main>
        @if (recipeService.error() ?? authService.sessionError() ?? authService.error(); as error) {
          <div class="api-error" role="alert">{{ error }}</div>
        }
        @if (authFeedback(); as message) {
          <div class="auth-feedback" role="status">
            <span>{{ message }}</span>
            <button type="button" aria-label="Dismiss sign-in confirmation" (click)="dismissAuthFeedback()">×</button>
          </div>
        }
        <section class="hero">
          <div><p class="eyebrow">What are we cooking today?</p><h1>Find your next <em>favorite recipe</em></h1></div>
          <div class="search-wrap"><label class="sr-only" for="recipe-search">Search recipes</label><input id="recipe-search" type="search" placeholder="Search recipes, ingredients..." [value]="query()" (input)="onSearch($event)" /></div>
        </section>

        <app-inspiration-search />

        <section class="collections-section" id="collections">
          <div class="section-heading">
            <div><p class="eyebrow">A little inspiration</p><h2>Your collections</h2></div>
            <button class="create-collection-button" type="button" (click)="openCreateCollection()">+ New collection</button>
          </div>
          @if (recipeService.collectionsLoading()) {
            <p class="collections-message">Loading collections...</p>
          } @else {
            <div class="collection-grid">
              @for (collection of collectionsWithRecipes(); track collection.id) {
                <article class="collection-card">
                  <a class="collection-open" href="#recipes" (click)="openCollection(collection.id)">
                    <img [src]="collection.image" alt="" />
                    <span class="collection-overlay">
                      <span class="collection-count">{{ collection.count }} {{ collection.count === 1 ? 'recipe' : 'recipes' }}</span>
                      <span class="collection-title">{{ collection.name }}</span>
                      <span class="collection-description">{{ collection.description }}</span>
                    </span>
                  </a>
                  <div class="collection-actions">
                    <button type="button" (click)="editCollection(collection)">Edit</button>
                    <button class="delete-button" type="button" (click)="deleteCollection(collection)">Delete</button>
                  </div>
                </article>
              } @empty {
                <p class="collections-message">No collections yet. Create one to group your favorite recipes.</p>
              }
            </div>
          }
        </section>

        <section class="content" id="recipes">
          <div class="section-heading"><div><p class="eyebrow">Made for every mood</p><h2>Explore recipes</h2></div></div>
          @if (activeCollection(); as collection) {
            <div class="collection-filter">
              <span>Showing <strong>{{ collection.name }}</strong></span>
              <button type="button" (click)="clearCollection()">Show all recipes</button>
            </div>
          }
          <div class="category-row">@for (category of categories; track category) {<button type="button" [class.selected]="selectedCategory() === category" (click)="selectCategory(category)">{{ category }}</button>}</div>
          <div class="recipe-grid">
            @for (recipe of filteredRecipes(); track recipe.id) {
              <article class="recipe-card">
                <div class="recipe-card-content">
                  <button class="recipe-card-open" type="button" (click)="viewRecipe(recipe)" [attr.aria-label]="'View ' + recipe.title">
                    <div class="image-wrap"><img [src]="recipe.image" [alt]="recipe.title" /></div>
                    <div class="card-body"><p class="recipe-category">{{ recipe.category }}</p><h3>{{ recipe.title }}</h3><div class="recipe-meta"><span>{{ recipe.time }} min</span><span>★ {{ recipe.rating }}</span></div></div>
                  </button>
                  <button class="save-button" type="button" [class.saved]="savedRecipes().has(recipe.id)" (click)="toggleSaved(recipe.id)" [attr.aria-label]="savedRecipes().has(recipe.id) ? 'Remove from favorites' : 'Save to favorites'">♥</button>
                </div>
                <div class="card-actions"><button class="cook-button" type="button" (click)="startCooking(recipe)">Cook</button><button type="button" (click)="openEdit(recipe)">Edit</button><button class="delete-button" type="button" (click)="deleteRecipe(recipe)">Delete</button></div>
              </article>
            } @empty {
              <div class="empty-state">
                @if (recipeService.loading()) {
                  <p>Loading recipes...</p>
                } @else if (recipeService.error()) {
                  <p>Recipes are unavailable until the server reconnects.</p>
                } @else {
                  <h3>No recipes found</h3><p>Try another search or category.</p>
                }
              </div>
            }
          </div>
        </section>

        @if (formOpen()) {
          <app-recipe-form [recipe]="editingRecipe()" (submitted)="saveRecipe($event)" (cancelled)="closeForm()" />
        }

        @if (collectionFormOpen()) {
          <div class="collection-form-backdrop" role="presentation" (click)="closeCollectionForm()">
            <section class="collection-dialog" role="dialog" aria-modal="true" aria-labelledby="collection-form-title" (click)="$event.stopPropagation()">
              <header class="collection-dialog-header">
                <div>
                  <p>{{ editingCollection() ? 'Organize your kitchen' : 'Make it your own' }}</p>
                  <h2 id="collection-form-title">{{ editingCollection() ? 'Edit collection' : 'New collection' }}</h2>
                </div>
                <button class="collection-close" type="button" aria-label="Close collection form" (click)="closeCollectionForm()">×</button>
              </header>
              <form (submit)="$event.preventDefault(); saveCollection()">
                <label class="collection-field">
                  Collection name
                  <input type="text" [value]="collectionName()" (input)="updateCollectionName($event)" maxlength="80" placeholder="e.g. Quick weeknight meals" />
                </label>
                <label class="collection-field">
                  Description <span class="optional-label">Optional</span>
                  <textarea [value]="collectionDescription()" (input)="updateCollectionDescription($event)" maxlength="240" placeholder="What brings these recipes together?"></textarea>
                </label>
                <fieldset class="recipe-picker">
                  <legend>Choose recipes</legend>
                  @for (recipe of recipeService.recipes(); track recipe.id) {
                    <label class="recipe-picker-option">
                      <input type="checkbox" [checked]="selectedRecipeIds().includes(recipe.id)" (change)="toggleCollectionRecipe(recipe.id, $event)" />
                      <span>{{ recipe.title }}</span>
                      <small>{{ recipe.category }}</small>
                    </label>
                  }
                </fieldset>
                @if (collectionFormError(); as error) {
                  <p class="collection-form-error" role="alert">{{ error }}</p>
                }
                <footer class="collection-dialog-footer">
                  <button class="cancel-collection-button" type="button" (click)="closeCollectionForm()">Cancel</button>
                  <button class="save-collection-button" type="submit">{{ editingCollection() ? 'Save changes' : 'Create collection' }}</button>
                </footer>
              </form>
            </section>
          </div>
        }

        @if (selectedRecipe(); as recipe) {
          <div class="modal-backdrop" (click)="closeDetail()"></div>
          <div class="modal">
            <div class="modal-content">
              <button class="close-detail" type="button" (click)="closeDetail()">✕</button>
              <div class="image-wrap"><img [src]="recipe.image" [alt]="recipe.title" /></div>
              <div class="detail-body">
                <p class="recipe-category">{{ recipe.category }}</p>
                <h3>{{ recipe.title }}</h3>
                <div class="recipe-meta"><span>{{ recipe.time }} min</span></div>
                <div class="rating-control" role="group" [attr.aria-label]="'Rate ' + recipe.title">
                  <span class="rating-label">Your rating</span>
                  <span class="star-buttons">
                    @for (star of [1, 2, 3, 4, 5]; track star) {
                      <span class="star-pair">
                        <button
                          class="star-half star-half-left"
                          type="button"
                          [class.active]="recipe.rating >= star - 0.5"
                          [attr.aria-label]="'Rate ' + (star - 0.5) + ' stars'"
                          [attr.aria-pressed]="recipe.rating === star - 0.5"
                          [disabled]="ratingSaving()"
                          (click)="setRating(recipe, star - 0.5)"
                        ><span class="star-glyph" aria-hidden="true">★</span></button>
                        <button
                          class="star-half star-half-right"
                          type="button"
                          [class.active]="recipe.rating >= star"
                          [attr.aria-label]="'Rate ' + star + ' stars'"
                          [attr.aria-pressed]="recipe.rating === star"
                          [disabled]="ratingSaving()"
                          (click)="setRating(recipe, star)"
                        ><span class="star-glyph" aria-hidden="true">★</span></button>
                      </span>
                    }
                  </span>
                  <span class="rating-value">{{ recipe.rating }} / 5</span>
                </div>
                @if (ratingSaving()) {
                  <p class="rating-status" role="status">Saving rating...</p>
                }
                @if (ratingError(); as error) {
                  <p class="rating-error" role="alert">{{ error }}</p>
                }
                <section class="recipe-steps" aria-labelledby="recipe-steps-title">
                  <h4 id="recipe-steps-title">Method</h4>
                  <ol>@for (step of recipe.steps; track $index; let index = $index) {<li><span class="recipe-step-number">{{ index + 1 }}.</span><span>{{ step }}</span></li>}</ol>
                </section>
                <app-recipe-comments [recipeId]="recipe.id" (loginRequested)="openAuthDialog()" />
                <div class="actions">
                  <button type="button" (click)="openEditFromDetail(recipe)">Edit</button>
                  <button class="delete-button" type="button" (click)="deleteFromDetail(recipe)">Delete</button>
                  <button class="save-button" type="button" [class.saved]="savedRecipes().has(recipe.id)" (click)="toggleSaved(recipe.id)" [attr.aria-label]="savedRecipes().has(recipe.id) ? 'Remove from favorites' : 'Save to favorites'">♥</button>
                </div>
              </div>
            </div>
          </div>
        }
        @if (authDialogOpen()) {
          <app-auth-dialog
            (authenticated)="showAuthFeedback($event)"
            (closed)="closeAuthDialog()"
          />
        }
      </main>
      </div>
    }
    <app-chat-bot />
  `,
  styles: [`
    :host{--ink:#252820;--cream:#f7f5ef;--lime:#b8ca78;--dark:#3d4a31;display:block}*{box-sizing:border-box}.app-shell{min-height:100vh;background:var(--cream);color:var(--ink)}
    .topbar{height:82px;max-width:1280px;margin:auto;padding:0 44px;display:grid;grid-template-columns:1fr auto auto auto;align-items:center;gap:24px}.brand{display:flex;align-items:center;gap:10px;color:var(--ink);text-decoration:none;font:700 23px Georgia,serif}.brand-mark{width:34px;height:34px;border-radius:50%;background:var(--lime);display:grid;place-items:center;color:white}.main-nav{display:flex;gap:34px}.main-nav a{color:#777a70;text-decoration:none;font-weight:700}.main-nav .active{color:var(--ink)}.add-header{border:0;border-radius:9px;background:var(--dark);color:white;padding:12px 16px;font-weight:800;cursor:pointer}
    .hero{min-height:290px;margin:0 24px;border-radius:24px;background:linear-gradient(100deg,#3d4a31ee,#3d4a31cc),url('https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1600&q=85') center/cover;display:grid;grid-template-columns:1fr 420px;align-items:center;padding:54px 8%;color:white}.hero h1{font:500 clamp(42px,5vw,68px)/.98 Georgia,serif;margin:0}.hero h1 em{color:var(--lime)}.eyebrow{text-transform:uppercase;letter-spacing:2px;font-size:11px;font-weight:800}.search-wrap input{width:100%;height:62px;border:0;border-radius:10px;padding:0 18px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
    .content{max-width:1280px;margin:auto;padding:54px 44px 72px}.section-heading h2{margin:0;font:700 38px Georgia,serif}.category-row{display:flex;gap:8px;margin:28px 0 24px}.category-row button{border:1px solid #dde0d5;border-radius:999px;background:transparent;padding:10px 18px;cursor:pointer}.category-row button.selected{background:var(--dark);color:white}.recipe-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.recipe-card{background:white;border-radius:16px;overflow:hidden}.recipe-card-content{position:relative}.recipe-card-open{display:block;width:100%;padding:0;border:0;background:white;color:inherit;text-align:left;cursor:pointer}.image-wrap{height:220px;position:relative}.image-wrap img{width:100%;height:100%;object-fit:cover}.save-button{position:absolute;top:14px;right:14px;width:38px;height:38px;border:0;border-radius:50%;background:white;cursor:pointer}.save-button.saved{color:#e46a5e}.card-body{padding:20px}.recipe-category{color:#9a9d91;text-transform:uppercase;letter-spacing:1.4px;font-size:10px;font-weight:800}.card-body h3{margin:7px 0 18px;font:700 21px Georgia,serif}.recipe-meta{display:flex;justify-content:space-between;color:#777b70;font-size:12px}.card-actions{display:flex;justify-content:flex-end;gap:8px;margin:0;padding:12px 20px 16px;border-top:1px solid #eceee6}.card-actions button{border:0;border-radius:7px;background:#edf0e5;color:#4f5942;padding:8px 11px;font-weight:800;cursor:pointer}.card-actions .delete-button{background:#f7eae7;color:#9a4b43}.empty-state{grid-column:1/-1;text-align:center;background:white;border-radius:16px;padding:60px}
    .modal-backdrop{position:fixed;top:0;right:0;bottom:0;left:0;background:rgba(0,0,0,0.8);z-index:999}
    .modal{max-width:800px;width:calc(100% - 32px);max-height:calc(100vh - 32px);overflow-y:auto;background:var(--dark);border-radius:16px;position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:1000}
    .modal-content{padding:24px}
    .close-detail{position:absolute;top:16px;right:16px;z-index:1;width:32px;height:32px;border:0;border-radius:50%;background:rgba(255,255,255,0.2);color:white;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center}
    @media(max-width:900px){.hero{grid-template-columns:1fr}.recipe-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.main-nav{display:none}}@media(max-width:600px){.topbar{grid-template-columns:1fr auto auto;padding:0 16px}.hero{margin:0 10px;padding:34px 22px}.recipe-grid{grid-template-columns:1fr}.content{padding:42px 16px}.hero h1{font-size:43px}}
  `],
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly recipeService = inject(RecipeService);
  protected readonly authService = inject(AuthService);
  protected readonly authDialogOpen = signal(false);
  protected readonly authFeedback = signal<string | null>(null);
  protected readonly categories = ['All','Breakfast','Lunch','Dinner','Dessert'];
  protected readonly selectedCategory = signal('All');
  protected readonly query = signal('');
  protected readonly savedRecipes = signal(new Set<number>());
  protected readonly formOpen = signal(false);
  protected readonly cookingRecipe = signal<Recipe | null>(null);
  protected readonly editingRecipe = signal<Recipe | null>(null);
  protected readonly selectedRecipe = signal<Recipe | null>(null);
  protected readonly ratingSaving = signal(false);
  protected readonly ratingError = signal<string | null>(null);
  protected readonly selectedCollectionId = signal<number | null>(null);
  protected readonly collectionFormOpen = signal(false);
  protected readonly editingCollection = signal<RecipeCollection | null>(null);
  protected readonly collectionName = signal('');
  protected readonly collectionDescription = signal('');
  protected readonly selectedRecipeIds = signal<number[]>([]);
  protected readonly collectionFormError = signal<string | null>(null);
  protected readonly collectionsWithRecipes = computed(() => {
    const recipes = this.recipeService.recipes();
    return this.recipeService.collections().map((collection) => {
      const matchingRecipes = collection.recipeIds
        .map((id) => recipes.find((recipe) => recipe.id === id))
        .filter((recipe): recipe is Recipe => recipe !== undefined);
      return {
        ...collection,
        count: matchingRecipes.length,
        image:
          matchingRecipes[0]?.image ??
          'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=900&q=85',
      };
    });
  });
  protected readonly activeCollection = computed(() =>
    this.recipeService.collections().find((collection) => collection.id === this.selectedCollectionId()),
  );
  protected readonly filteredRecipes = computed(() => {
    const category = this.selectedCategory();
    const search = this.query().trim().toLowerCase();
    const collection = this.activeCollection();
    return this.recipeService.recipes().filter((recipe) =>
      (!collection || collection.recipeIds.includes(recipe.id)) &&
      (category === 'All' || recipe.category === category) &&
      (!search || recipe.title.toLowerCase().includes(search) || recipe.category.toLowerCase().includes(search)),
    );
  });
  protected openAuthDialog(): void { this.authDialogOpen.set(true); }
  protected closeAuthDialog(): void { this.authDialogOpen.set(false); }
  protected showAuthFeedback(completion: AuthCompletion): void {
    this.authFeedback.set(
      completion.mode === 'login'
        ? `Welcome back, ${completion.user.name}!`
        : `Your account is ready, ${completion.user.name}!`,
    );
  }
  protected dismissAuthFeedback(): void { this.authFeedback.set(null); }
  protected logout(): void {
    this.authService.logout().subscribe({
      error: () => this.authService.setError('Could not sign out. Please try again.'),
    });
  }
  protected selectCategory(category: string): void {
    this.selectedCollectionId.set(null);
    this.selectedCategory.set(category);
  }
  protected openCollection(id: number): void {
    this.query.set('');
    this.selectedCategory.set('All');
    this.selectedCollectionId.set(id);
  }
  protected clearCollection(): void { this.selectedCollectionId.set(null); }
  protected onSearch(event: Event): void { this.query.set((event.target as HTMLInputElement).value); }
  protected toggleSaved(id: number): void { this.savedRecipes.update((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  protected openCreate(): void { this.editingRecipe.set(null); this.formOpen.set(true); }
  protected startCooking(recipe: Recipe): void { this.cookingRecipe.set(recipe); }
  protected closeCooking(): void { this.cookingRecipe.set(null); }
  protected openCreateCollection(): void {
    this.editingCollection.set(null);
    this.collectionName.set('');
    this.collectionDescription.set('');
    this.selectedRecipeIds.set([]);
    this.collectionFormError.set(null);
    this.collectionFormOpen.set(true);
  }
  protected editCollection(collection: RecipeCollection): void {
    this.editingCollection.set(collection);
    this.collectionName.set(collection.name);
    this.collectionDescription.set(collection.description);
    this.selectedRecipeIds.set([...collection.recipeIds]);
    this.collectionFormError.set(null);
    this.collectionFormOpen.set(true);
  }
  protected closeCollectionForm(): void {
    this.collectionFormOpen.set(false);
    this.collectionFormError.set(null);
  }
  protected updateCollectionName(event: Event): void {
    this.collectionName.set((event.target as HTMLInputElement).value);
  }
  protected updateCollectionDescription(event: Event): void {
    this.collectionDescription.set((event.target as HTMLTextAreaElement).value);
  }
  protected toggleCollectionRecipe(id: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedRecipeIds.update((ids) =>
      checked ? [...ids, id] : ids.filter((recipeId) => recipeId !== id),
    );
  }
  protected saveCollection(): void {
    const name = this.collectionName().trim();
    if (!name) {
      this.collectionFormError.set('Enter a name for this collection.');
      return;
    }
    if (this.selectedRecipeIds().length === 0) {
      this.collectionFormError.set('Select at least one recipe for this collection.');
      return;
    }
    const draft: RecipeCollectionDraft = {
      name,
      description: this.collectionDescription().trim(),
      recipeIds: this.selectedRecipeIds(),
    };
    const editing = this.editingCollection();
    const request = editing
      ? this.recipeService.updateCollection(editing.id, draft)
      : this.recipeService.createCollection(draft);
    request.subscribe({
      next: () => this.closeCollectionForm(),
      error: () => this.collectionFormError.set('Could not save this collection. Please try again.'),
    });
  }
  protected deleteCollection(collection: RecipeCollection): void {
    if (window.confirm(`Delete the “${collection.name}” collection?`)) {
      this.recipeService.deleteCollection(collection.id).subscribe({
        next: () => {
          if (this.selectedCollectionId() === collection.id) {
            this.clearCollection();
          }
        },
        error: () => this.recipeService.setError('Could not delete the collection. Please try again.'),
      });
    }
  }
  protected openEdit(recipe: Recipe): void { this.editingRecipe.set(recipe); this.formOpen.set(true); }
  protected closeForm(): void { this.formOpen.set(false); this.editingRecipe.set(null); }
  protected saveRecipe(draft: RecipeDraft): void {
    const editing = this.editingRecipe();
    const request = editing
      ? this.recipeService.update(editing.id, draft)
      : this.recipeService.create(draft);
    request.subscribe({
      next: () => this.closeForm(),
      error: () => this.recipeService.setError('Could not save your recipe. Please try again.'),
    });
  }
  protected deleteRecipe(recipe: Recipe): void {
    if (window.confirm(`Delete “${recipe.title}”?`)) {
      this.recipeService.delete(recipe.id).subscribe({
        next: () => {
          this.savedRecipes.update((current) => {
            const next = new Set(current);
            next.delete(recipe.id);
            return next;
          });
        },
        error: () => this.recipeService.setError('Could not delete the recipe. Please try again.'),
      });
    }
  }
  protected viewRecipe(recipe: Recipe): void {
    this.ratingError.set(null);
    this.selectedRecipe.set(recipe);
  }
  protected setRating(recipe: Recipe, rating: number): void {
    if (this.ratingSaving() || recipe.rating === rating) {
      return;
    }

    this.ratingSaving.set(true);
    this.ratingError.set(null);
    const draft: RecipeDraft = {
      title: recipe.title,
      category: recipe.category,
      time: recipe.time,
      rating,
      steps: recipe.steps,
      image: recipe.image,
    };
    this.recipeService.update(recipe.id, draft).subscribe({
      next: (updatedRecipe) => {
        if (this.selectedRecipe()?.id === updatedRecipe.id) {
          this.selectedRecipe.set(updatedRecipe);
        }
        this.ratingSaving.set(false);
      },
      error: () => {
        this.ratingSaving.set(false);
        this.ratingError.set('Could not save your rating. Please try again.');
      },
    });
  }
  protected closeDetail(): void { this.selectedRecipe.set(null); }
  protected openEditFromDetail(recipe: Recipe): void { this.closeDetail(); this.editingRecipe.set(recipe); this.formOpen.set(true); }
  protected deleteFromDetail(recipe: Recipe): void { this.deleteRecipe(recipe); this.closeDetail(); }
  protected readRecipe(recipe: Recipe): void { this.selectedRecipe.set(recipe); }
}
