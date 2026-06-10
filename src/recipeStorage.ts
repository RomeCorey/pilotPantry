import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { RecipeIngredient, SavedRecipe } from './types/recipe'

const LOCAL_RECIPES_KEY = 'recipes'
const RECIPES_MIGRATED_KEY = 'recipesMigratedToSupabase'

type DbRecipeRow = {
  id: string
  name: string
  created_at: string
  recipe_ingredients: Array<{
    id: string
    item: string
    category: string
    quantity: number
    unit: string
    sort_order: number
  }> | null
}

function normalizeIngredient(ingredient: Partial<RecipeIngredient>): RecipeIngredient {
  return {
    id: ingredient.id ?? crypto.randomUUID(),
    item: ingredient.item ?? '',
    category: ingredient.category ?? '',
    quantity: ingredient.quantity ?? 0,
    unit: ingredient.unit ?? '',
  }
}

export function normalizeRecipe(recipe: Partial<SavedRecipe>): SavedRecipe {
  return {
    id: recipe.id ?? crypto.randomUUID(),
    name: recipe.name ?? '',
    ingredients: (recipe.ingredients ?? []).map((ingredient) =>
      normalizeIngredient(ingredient)
    ),
    createdAt: recipe.createdAt ?? new Date().toISOString(),
  }
}

export function loadLocalRecipes(): SavedRecipe[] {
  const stored = JSON.parse(localStorage.getItem(LOCAL_RECIPES_KEY) || '[]')
  if (!Array.isArray(stored)) return []
  return stored.map((recipe) => normalizeRecipe(recipe))
}

function mapDbRecipe(row: DbRecipeRow): SavedRecipe {
  const ingredients = (row.recipe_ingredients ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((ingredient) => ({
      id: ingredient.id,
      item: ingredient.item,
      category: ingredient.category,
      quantity: Number(ingredient.quantity),
      unit: ingredient.unit,
    }))

  return {
    id: row.id,
    name: row.name,
    ingredients,
    createdAt: row.created_at,
  }
}

export async function fetchRecipes(userId: string): Promise<SavedRecipe[]> {
  if (!isSupabaseConfigured) {
    return loadLocalRecipes()
  }

  const { data, error } = await supabase
    .from('recipes')
    .select(
      'id, name, created_at, recipe_ingredients (id, item, category, quantity, unit, sort_order)'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data as DbRecipeRow[]).map(mapDbRecipe)
}

export async function saveRecipe(
  recipe: SavedRecipe,
  userId: string
): Promise<void> {
  const normalized = normalizeRecipe(recipe)

  if (!isSupabaseConfigured || !userId) {
    const recipes = loadLocalRecipes()
    recipes.push(normalized)
    localStorage.setItem(LOCAL_RECIPES_KEY, JSON.stringify(recipes))
    return
  }

  const { error: recipeError } = await supabase.from('recipes').insert({
    id: normalized.id,
    user_id: userId,
    name: normalized.name,
    created_at: normalized.createdAt,
  })

  if (recipeError) {
    throw recipeError
  }

  const ingredientRows = normalized.ingredients.map((ingredient, index) => ({
    id: ingredient.id,
    recipe_id: normalized.id,
    item: ingredient.item,
    category: ingredient.category,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    sort_order: index,
  }))

  const { error: ingredientError } = await supabase
    .from('recipe_ingredients')
    .insert(ingredientRows)

  if (ingredientError) {
    throw ingredientError
  }
}

export async function migrateLocalRecipesToSupabase(
  userId: string
): Promise<number> {
  if (!isSupabaseConfigured) {
    return 0
  }

  if (localStorage.getItem(RECIPES_MIGRATED_KEY) === userId) {
    return 0
  }

  const localRecipes = loadLocalRecipes()
  if (localRecipes.length === 0) {
    localStorage.setItem(RECIPES_MIGRATED_KEY, userId)
    return 0
  }

  for (const recipe of localRecipes) {
    await saveRecipe(normalizeRecipe(recipe), userId)
  }

  localStorage.removeItem(LOCAL_RECIPES_KEY)
  localStorage.setItem(RECIPES_MIGRATED_KEY, userId)
  return localRecipes.length
}

export function createRecipe(name: string, ingredients: RecipeIngredient[]): SavedRecipe {
  return normalizeRecipe({
    id: crypto.randomUUID(),
    name: name.trim(),
    ingredients: ingredients.map((ingredient) => ({
      ...ingredient,
      id: ingredient.id || crypto.randomUUID(),
    })),
    createdAt: new Date().toISOString(),
  })
}

export async function updateRecipe(
  recipe: SavedRecipe,
  userId: string
): Promise<void> {
  const normalized = normalizeRecipe(recipe)

  if (!isSupabaseConfigured || !userId) {
    const recipes = loadLocalRecipes()
    const index = recipes.findIndex((entry) => entry.id === normalized.id)
    if (index === -1) {
      throw new Error('Recipe not found')
    }

    recipes[index] = {
      ...normalized,
      createdAt: recipes[index].createdAt,
    }
    localStorage.setItem(LOCAL_RECIPES_KEY, JSON.stringify(recipes))
    return
  }

  const { error: recipeError } = await supabase
    .from('recipes')
    .update({ name: normalized.name })
    .eq('id', normalized.id)
    .eq('user_id', userId)

  if (recipeError) {
    throw recipeError
  }

  const { error: deleteError } = await supabase
    .from('recipe_ingredients')
    .delete()
    .eq('recipe_id', normalized.id)

  if (deleteError) {
    throw deleteError
  }

  const ingredientRows = normalized.ingredients.map((ingredient, index) => ({
    id: ingredient.id,
    recipe_id: normalized.id,
    item: ingredient.item,
    category: ingredient.category,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    sort_order: index,
  }))

  if (ingredientRows.length > 0) {
    const { error: ingredientError } = await supabase
      .from('recipe_ingredients')
      .insert(ingredientRows)

    if (ingredientError) {
      throw ingredientError
    }
  }
}
