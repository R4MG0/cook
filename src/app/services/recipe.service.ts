import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { RecipeCollection, RecipeCollectionDraft } from '../models/collection.model';
import { Recipe, RecipeDraft } from '../models/recipe.model';

const API_URL = '/api/recipes';
const COLLECTIONS_API_URL = '/api/collections';

@Injectable({ providedIn: 'root' })
export class RecipeService {
  readonly recipes = signal<Recipe[]>([]);
  readonly collections = signal<RecipeCollection[]>([]);
  readonly loading = signal(true);
  readonly collectionsLoading = signal(true);
  readonly error = computed(
    () => this.mutationError() ?? this.recipeLoadError() ?? this.collectionsLoadError(),
  );

  private readonly http = inject(HttpClient);
  private readonly mutationError = signal<string | null>(null);
  private readonly recipeLoadError = signal<string | null>(null);
  private readonly collectionsLoadError = signal<string | null>(null);

  constructor() {
    this.http.get<Recipe[]>(API_URL).subscribe({
      next: (recipes) => {
        this.recipes.set(recipes);
        this.loading.set(false);
        this.recipeLoadError.set(null);
      },
      error: () => {
        this.loading.set(false);
        this.recipeLoadError.set('Could not load recipes. Make sure the recipe server is running.');
      },
    });
    this.http.get<RecipeCollection[]>(COLLECTIONS_API_URL).subscribe({
      next: (collections) => {
        this.collections.set(collections);
        this.collectionsLoading.set(false);
        this.collectionsLoadError.set(null);
      },
      error: () => {
        this.collectionsLoading.set(false);
        this.collectionsLoadError.set('Could not load collections. Make sure the recipe server is running.');
      },
    });
  }

  create(draft: RecipeDraft): Observable<Recipe> {
    return this.http.post<Recipe>(API_URL, draft).pipe(
      tap((recipe) => {
        this.recipes.update((recipes) => [...recipes, recipe]);
        this.mutationError.set(null);
      }),
    );
  }

  update(id: number, draft: RecipeDraft): Observable<Recipe> {
    return this.http.put<Recipe>(`${API_URL}/${id}`, draft).pipe(
      tap((updatedRecipe) => {
        this.recipes.update((recipes) =>
          recipes.map((recipe) => (recipe.id === id ? updatedRecipe : recipe)),
        );
        this.mutationError.set(null);
      }),
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/${id}`).pipe(
      tap(() => {
        this.recipes.update((recipes) => recipes.filter((recipe) => recipe.id !== id));
        this.collections.update((collections) =>
          collections.map((collection) => ({
            ...collection,
            recipeIds: collection.recipeIds.filter((recipeId) => recipeId !== id),
          })),
        );
        this.mutationError.set(null);
      }),
    );
  }

  createCollection(draft: RecipeCollectionDraft): Observable<RecipeCollection> {
    return this.http.post<RecipeCollection>(COLLECTIONS_API_URL, draft).pipe(
      tap((collection) => {
        this.collections.update((collections) => [...collections, collection]);
        this.mutationError.set(null);
      }),
    );
  }

  updateCollection(id: number, draft: RecipeCollectionDraft): Observable<RecipeCollection> {
    return this.http.put<RecipeCollection>(`${COLLECTIONS_API_URL}/${id}`, draft).pipe(
      tap((updatedCollection) => {
        this.collections.update((collections) =>
          collections.map((collection) => (collection.id === id ? updatedCollection : collection)),
        );
        this.mutationError.set(null);
      }),
    );
  }

  deleteCollection(id: number): Observable<void> {
    return this.http.delete<void>(`${COLLECTIONS_API_URL}/${id}`).pipe(
      tap(() => {
        this.collections.update((collections) =>
          collections.filter((collection) => collection.id !== id),
        );
        this.mutationError.set(null);
      }),
    );
  }

  read(id: number): Recipe | undefined {
    return this.recipes().find((recipe) => recipe.id === id);
  }

  setError(message: string): void {
    this.mutationError.set(message);
  }
}
