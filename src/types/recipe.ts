export interface RecipeIngredient {
  id: string
  item: string
  category: string
  quantity: number
  unit: string
}

export interface SavedRecipe {
  id: string
  name: string
  ingredients: RecipeIngredient[]
  createdAt: string
}

export interface ShoppingListItem {
  id: string
  item: string
  category: string
  quantity: number
  unit: string
  recipeId?: string
  recipeName: string
  addedAt: string
}

export interface CombinedShoppingItem {
  key: string
  item: string
  category: string
  quantity: number
  unit: string
  recipeNames: string[]
}

export interface RecipeShoppingStatus {
  recipeName: string
  ingredientsLeft: number
  isComplete: boolean
}
