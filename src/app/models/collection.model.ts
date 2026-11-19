export interface RecipeCollection {
  id: number;
  name: string;
  description: string;
  recipeIds: number[];
}

export type RecipeCollectionDraft = Omit<RecipeCollection, 'id'>;
