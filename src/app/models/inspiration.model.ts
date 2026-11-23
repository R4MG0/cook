export interface InspirationIngredient {
  name: string;
  measure: string;
}

export interface InspirationRecipe {
  id: string;
  name: string;
  category: string;
  area: string;
  image: string;
  source: string;
  instructions: string;
  ingredients: InspirationIngredient[];
}
