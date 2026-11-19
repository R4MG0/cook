export interface Recipe {
  id: number;
  title: string;
  category: string;
  time: number;
  rating: number;
  steps: string[];
  image: string;
  accent: string;
}

export type RecipeDraft = Omit<Recipe, 'id' | 'accent'>;
