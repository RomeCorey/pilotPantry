import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import {
  createRecipe,
  fetchRecipes,
  loadLocalRecipes,
  saveRecipe,
} from './recipeStorage'
import type { RecipeIngredient, SavedRecipe } from './types/recipe'

export function useRecipes() {
  const { user, isConfigured } = useAuth()
  const [recipes, setRecipes] = useState<SavedRecipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      if (user && isConfigured) {
        setRecipes(await fetchRecipes(user.id))
      } else {
        setRecipes(loadLocalRecipes())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recipes')
      setRecipes(loadLocalRecipes())
    } finally {
      setLoading(false)
    }
  }, [user, isConfigured])

  useEffect(() => {
    reload()
  }, [reload])

  const addRecipe = useCallback(
    async (name: string, ingredients: RecipeIngredient[]) => {
      const recipe = createRecipe(name, ingredients)

      if (user && isConfigured) {
        await saveRecipe(recipe, user.id)
        try {
          await reload()
        } catch {
          setRecipes((prev) => [recipe, ...prev])
        }
        return recipe
      }

      await saveRecipe(recipe, '')
      setRecipes(loadLocalRecipes())
      return recipe
    },
    [user, isConfigured, reload]
  )

  return {
    recipes,
    loading,
    error,
    reload,
    addRecipe,
    isCloudBacked: Boolean(user && isConfigured),
  }
}
