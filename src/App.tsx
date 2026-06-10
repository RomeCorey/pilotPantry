import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  createContext,
  useContext,
  type FormEvent,
  type MouseEvent,
} from 'react'
import pantryNoText from './assets/PantryPilotNoText.svg'
import cuttingBoard from './assets/cuttingBoard.png'
import {
  CATEGORY_FILES,
  getUnitOptionsForItem,
  getDefaultUnitForItem,
  UNIT_OPTIONS,
  UNIT_SYMBOLS,
  ingredientNameToKey,
} from './categoryConfig'
import { useAuth } from './AuthContext'
import { useRecipes } from './useRecipes'
import type {
  CombinedShoppingItem,
  RecipeIngredient,
  RecipeShoppingStatus,
  SavedRecipe,
  ShoppingListItem,
} from './types/recipe'
import './App.css'

// Import all category JSON files
import produceData from '../categories/produce.json'
import meatData from '../categories/meat_and_poultry.json'
import dairyData from '../categories/dairy.json'
import pantryData from '../categories/pantry_staples.json'
import spicesData from '../categories/spices_and_seasonings.json'
import bakingData from '../categories/baking_supplies.json'
import drinksData from '../categories/drinks.json'
import frozenData from '../categories/frozen_foods.json'
import snacksData from '../categories/snacks.json'
import breakfastData from '../categories/breakfast_cereals.json'
import partyData from '../categories/party_supplies.json'
import condimentsData from '../categories/condiments_and_sauces.json'
import internationalData from '../categories/international_foods.json'
import soupsData from '../categories/soups_and_broths.json'
import bakingMixesData from '../categories/baking_mixes.json'
import organicData from '../categories/organic_and_specialty.json'
import babyData from '../categories/baby_and_toddler.json'

interface GroceryItem {
  item: string
  category: string
  common_units?: Array<{
    unit: string
    symbol: string
    typical_amount: number
    conversions?: Record<string, any>
  }>
}

function shoppingListItemKey(entry: Pick<ShoppingListItem, 'item' | 'unit'>): string {
  return `${entry.item.toLowerCase()}|${entry.unit.toLowerCase()}`
}

const AUTH_LOGIN_DISMISSED_KEY = 'authLoginDismissed'

interface AuthUIContextValue {
  showInlineLogin: boolean
  dismissLogin: () => void
}

const AuthUIContext = createContext<AuthUIContextValue | null>(null)

function useAuthUI() {
  const context = useContext(AuthUIContext)
  if (!context) {
    throw new Error('useAuthUI must be used within App')
  }
  return context
}

function getRecipeShoppingStatuses(
  shoppingList: ShoppingListItem[],
  foundItems: Set<string>
): RecipeShoppingStatus[] {
  const recipeNames = [...new Set(shoppingList.map((entry) => entry.recipeName))].sort(
    (a, b) => a.localeCompare(b)
  )

  return recipeNames.map((recipeName) => {
    const ingredientKeys = new Set(
      shoppingList
        .filter((entry) => entry.recipeName === recipeName)
        .map((entry) => shoppingListItemKey(entry))
    )
    const keys = Array.from(ingredientKeys)
    const ingredientsLeft = keys.filter((key) => !foundItems.has(key)).length

    return {
      recipeName,
      ingredientsLeft,
      isComplete: ingredientsLeft === 0,
    }
  })
}

function combineShoppingList(items: ShoppingListItem[]): CombinedShoppingItem[] {
  const combined = new Map<string, CombinedShoppingItem>()

  items.forEach((entry) => {
    const key = shoppingListItemKey(entry)
    const existing = combined.get(key)

    if (existing) {
      existing.quantity += entry.quantity
      if (!existing.recipeNames.includes(entry.recipeName)) {
        existing.recipeNames.push(entry.recipeName)
      }
      return
    }

    combined.set(key, {
      key,
      item: entry.item,
      category: entry.category,
      quantity: entry.quantity,
      unit: entry.unit,
      recipeNames: [entry.recipeName],
    })
  })

  return Array.from(combined.values()).sort((a, b) =>
    a.item.localeCompare(b.item)
  )
}

function AuthForm() {
  const { authError, clearAuthError, signIn, signUp, isConfigured } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMessage, setAuthMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isConfigured) return null

  const handleSignIn = async (event: FormEvent) => {
    event.preventDefault()
    clearAuthError()
    setAuthMessage(null)
    setIsSubmitting(true)
    await signIn(email, password)
    setIsSubmitting(false)
  }

  const handleSignUp = async (event: FormEvent) => {
    event.preventDefault()
    clearAuthError()
    setAuthMessage(null)
    setIsSubmitting(true)
    const message = await signUp(email, password)
    setAuthMessage(message)
    setIsSubmitting(false)
  }

  return (
    <form className="auth-form" onSubmit={handleSignIn}>
      <p className="auth-status">Sign in to save recipes to your account.</p>
      <label className="auth-field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          inputMode="email"
          required
        />
      </label>
      <label className="auth-field">
        <span>Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          minLength={6}
          required
        />
      </label>
      <div className="auth-actions">
        <button
          type="submit"
          className="auth-button auth-button-primary"
          disabled={isSubmitting}
        >
          Sign In
        </button>
        <button
          type="button"
          className="auth-button auth-button-secondary"
          onClick={handleSignUp}
          disabled={isSubmitting}
        >
          Create Account
        </button>
      </div>
      {authError && <p className="auth-error">{authError}</p>}
      {authMessage && <p className="auth-message">{authMessage}</p>}
    </form>
  )
}

function AuthSectionCard({
  onDismiss,
  className = '',
  onClick,
}: {
  onDismiss: () => void
  className?: string
  onClick?: (event: MouseEvent<HTMLElement>) => void
}) {
  return (
    <section
      className={`auth-section${className ? ` ${className}` : ''}`}
      onClick={onClick}
    >
      <button
        type="button"
        className="auth-section-dismiss"
        onClick={onDismiss}
        aria-label="Close login"
      >
        ✕
      </button>
      <AuthForm />
    </section>
  )
}

function InlineAuthPanel({ className = '' }: { className?: string }) {
  const { showInlineLogin, dismissLogin } = useAuthUI()

  if (!showInlineLogin) return null

  return (
    <div className={`inline-auth-panel${className ? ` ${className}` : ''}`}>
      <AuthSectionCard onDismiss={dismissLogin} />
    </div>
  )
}

function AuthBar({ inline = false }: { inline?: boolean }) {
  const { user, loading, isConfigured, signOut } = useAuth()

  if (!isConfigured || (!loading && !user)) return null

  return (
    <div
      className={`auth-bar${inline ? ' auth-bar-inline' : ''}`}
      aria-live="polite"
    >
      {loading ? (
        <span className="auth-bar-status">Checking account...</span>
      ) : (
        <>
          <span className="auth-bar-email" title={user?.email}>
            {user?.email}
          </span>
          <button
            type="button"
            className="auth-bar-signout"
            onClick={() => signOut()}
          >
            Sign Out
          </button>
        </>
      )}
    </div>
  )
}

function HomePage({ onRecipeClick, onShoppingClick, onGoShoppingClick }: any) {
  return (
    <div className="homepage light-mode">
      <header className="header">
        <img src={pantryNoText} alt="" className="header-logo" aria-hidden="true" />
      </header>

      <div className="homepage-hero">
        <h1 className="homepage-title">Pantry Pilot</h1>
      </div>

      <div className="homepage-bottom">
        <InlineAuthPanel className="homepage-auth-panel" />

        <div className="button-container">
          <button className="action-button button-primary" onClick={onRecipeClick}>
            Input Recipe
          </button>
          <button
            className="action-button button-tertiary"
            onClick={onShoppingClick}
          >
            Build Shopping List from Recipes
          </button>
          <button
            className="action-button button-quaternary"
            onClick={onGoShoppingClick}
          >
            Let's Go Shopping
          </button>
        </div>
      </div>
    </div>
  )
}

function InputRecipePage({ onBack }: any) {
  const { addRecipe, isCloudBacked } = useRecipes()
  const [recipeName, setRecipeName] = useState('')
  const [isSavingRecipe, setIsSavingRecipe] = useState(false)
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null)
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null)
  const [newIngredientSuccessMessage, setNewIngredientSuccessMessage] = useState<
    string | null
  >(null)
  const [newIngredientErrorMessage, setNewIngredientErrorMessage] = useState<
    string | null
  >(null)
  const [isSavingNewIngredient, setIsSavingNewIngredient] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1)
  const [selectedUnit, setSelectedUnit] = useState('')
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [selectedIngredient, setSelectedIngredient] = useState<GroceryItem | null>(null)
  const [customIngredients, setCustomIngredients] = useState<GroceryItem[]>(() =>
    JSON.parse(localStorage.getItem('customIngredients') || '[]')
  )
  const [showAddIngredientForm, setShowAddIngredientForm] = useState(false)
  const [newIngredientName, setNewIngredientName] = useState('')
  const [newCategoryFile, setNewCategoryFile] = useState<string>(
    CATEGORY_FILES[0].value
  )
  const [newSubCategory, setNewSubCategory] = useState('')
  const [newUnit, setNewUnit] = useState<string>(UNIT_OPTIONS[0])
  const [newUnitSymbol, setNewUnitSymbol] = useState(UNIT_SYMBOLS[UNIT_OPTIONS[0]])
  const [newTypicalAmount, setNewTypicalAmount] = useState<number>(1)
  const addIngredientSectionRef = useRef<HTMLDivElement>(null)

  const categoryDatas = useMemo(
    () => [
      produceData,
      meatData,
      dairyData,
      pantryData,
      spicesData,
      bakingData,
      drinksData,
      frozenData,
      snacksData,
      breakfastData,
      partyData,
      condimentsData,
      internationalData,
      soupsData,
      bakingMixesData,
      organicData,
      babyData,
    ],
    []
  )

  // Combine all grocery items from all categories
  const allGroceryItems: GroceryItem[] = useMemo(() => {
    const items: GroceryItem[] = []

    categoryDatas.forEach((categoryData: any) => {
      if (categoryData.items) {
        Object.values(categoryData.items).forEach((item: any) => {
          items.push(item)
        })
      }
    })

    return [...items, ...customIngredients]
  }, [categoryDatas, customIngredients])

  // Filter items based on search term
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return []
    return allGroceryItems
      .filter((item) =>
        item.item.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .slice(0, 10) // Limit to 10 results
  }, [searchTerm, allGroceryItems])

  const activeIngredient = useMemo(() => {
    if (selectedIngredient) return selectedIngredient
    if (!searchTerm.trim()) return null
    return (
      allGroceryItems.find(
        (item) => item.item.toLowerCase() === searchTerm.toLowerCase()
      ) ?? null
    )
  }, [selectedIngredient, searchTerm, allGroceryItems])

  // Get available units for selected item (common units first, then all others)
  const availableUnits = useMemo(() => {
    return getUnitOptionsForItem(activeIngredient)
  }, [activeIngredient])

  useEffect(() => {
    if (activeIngredient) {
      setSelectedUnit(getDefaultUnitForItem(activeIngredient))
    } else {
      setSelectedUnit('')
    }
  }, [activeIngredient])

  // Handle adding ingredient
  const handleAddIngredient = (item: GroceryItem) => {
    if (!selectedUnit) {
      setNewIngredientErrorMessage('Please select a unit')
      return
    }

    const newIngredient: RecipeIngredient = {
      id: crypto.randomUUID(),
      item: item.item,
      category: item.category,
      quantity: selectedQuantity,
      unit: selectedUnit,
    }
    setIngredients([...ingredients, newIngredient])
    setSearchTerm('')
    setSelectedIngredient(null)
    setSelectedQuantity(1)
    setSelectedUnit('')
    setShowSearchResults(false)
  }

  // Handle removing ingredient
  const handleRemoveIngredient = (id: string) => {
    setIngredients(ingredients.filter((ing) => ing.id !== id))
  }

  const handleNewUnitChange = (unit: string) => {
    setNewUnit(unit)
    setNewUnitSymbol(UNIT_SYMBOLS[unit] ?? unit)
  }

  const handleSaveNewIngredient = async () => {
    const trimmedName = newIngredientName.trim()
    const trimmedSubCategory = newSubCategory.trim()

    if (!trimmedName) {
      setNewIngredientErrorMessage('Please enter an ingredient name')
      return
    }
    if (!trimmedSubCategory) {
      setNewIngredientErrorMessage('Please enter a sub-category')
      return
    }
    if (!Number.isFinite(newTypicalAmount) || newTypicalAmount <= 0) {
      setNewIngredientErrorMessage('Please enter a valid typical amount')
      return
    }

    const itemKey = ingredientNameToKey(trimmedName)
    if (!itemKey) {
      setNewIngredientErrorMessage('Please enter a valid ingredient name')
      return
    }

    const newItem: GroceryItem = {
      item: trimmedName,
      category: trimmedSubCategory,
      common_units: [
        {
          unit: newUnit,
          symbol: newUnitSymbol.trim() || UNIT_SYMBOLS[newUnit] || newUnit,
          typical_amount: newTypicalAmount,
        },
      ],
    }

    const duplicate = allGroceryItems.find(
      (item) => item.item.toLowerCase() === trimmedName.toLowerCase()
    )
    if (duplicate) {
      setNewIngredientErrorMessage('An ingredient with this name already exists')
      return
    }

    setIsSavingNewIngredient(true)
    let savedToCategoryFile = false

    try {
      const response = await fetch('/api/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryFile: newCategoryFile,
          itemKey,
          item: newItem,
        }),
      })

      if (response.ok) {
        savedToCategoryFile = true
      } else if (response.status !== 404) {
        let errorMessage = 'Failed to save ingredient to category file'
        try {
          const error = await response.json()
          if (error?.error) errorMessage = error.error
        } catch {
          // Non-JSON error response
        }
        setNewIngredientErrorMessage(errorMessage)
        return
      }
    } catch {
      // Dev API unavailable (e.g. production build) — fall back to local storage
    } finally {
      setIsSavingNewIngredient(false)
    }

    const updatedCustom = [...customIngredients, newItem]
    setCustomIngredients(updatedCustom)
    localStorage.setItem('customIngredients', JSON.stringify(updatedCustom))

    setNewIngredientName('')
    setNewSubCategory('')
    setNewCategoryFile(CATEGORY_FILES[0].value)
    setNewUnit(UNIT_OPTIONS[0])
    setNewUnitSymbol(UNIT_SYMBOLS[UNIT_OPTIONS[0]])
    setNewTypicalAmount(1)
    setShowAddIngredientForm(false)

    setNewIngredientSuccessMessage(
      savedToCategoryFile
        ? `"${trimmedName}" was added to the category file and is now available in search.`
        : `"${trimmedName}" was saved and is now available in search.`
    )
  }

  const handleSaveRecipe = async () => {
    if (!recipeName.trim()) {
      alert('Please enter a recipe name')
      return
    }
    if (ingredients.length === 0) {
      alert('Please add at least one ingredient')
      return
    }

    setIsSavingRecipe(true)

    try {
      const savedRecipe = await addRecipe(recipeName, ingredients)
      const storageMessage = isCloudBacked
        ? 'saved to your account'
        : 'saved on this device'
      setRecipeName('')
      setIngredients([])
      setSaveSuccessMessage(`Recipe "${savedRecipe.name}" ${storageMessage}!`)
    } catch (error) {
      setSaveErrorMessage(
        error instanceof Error ? error.message : 'Failed to save recipe. Try again.'
      )
    } finally {
      setIsSavingRecipe(false)
    }
  }

  useEffect(() => {
    if (!saveSuccessMessage) return

    const timer = window.setTimeout(() => {
      setSaveSuccessMessage(null)
      onBack()
    }, 2000)

    return () => window.clearTimeout(timer)
  }, [saveSuccessMessage, onBack])

  useEffect(() => {
    if (!newIngredientSuccessMessage) return

    const timer = window.setTimeout(() => {
      setNewIngredientSuccessMessage(null)
    }, 2500)

    return () => window.clearTimeout(timer)
  }, [newIngredientSuccessMessage])

  useEffect(() => {
    if (!showAddIngredientForm) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (
        target instanceof Node &&
        addIngredientSectionRef.current?.contains(target)
      ) {
        return
      }
      setShowAddIngredientForm(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [showAddIngredientForm])

  return (
    <div
      className="page input-recipe-page light-mode"
      style={{
        backgroundImage: `url(${pantryNoText})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div
        className="page-content produce-background-content"
        style={
          {
            '--produce-bg': `url(${cuttingBoard})`,
          } as React.CSSProperties
        }
      >
        <InlineAuthPanel className="page-inline-auth" />
        <div className="page-header">
          <button className="back-button" onClick={onBack}>
            ← Back
          </button>
          <h1>Input Recipe</h1>
        </div>

        {/* Recipe Name Input */}
        <div className="recipe-section">
          <label className="section-label">Recipe Name</label>
          <input
            type="text"
            placeholder="Enter recipe name..."
            value={recipeName}
            onChange={(e) => setRecipeName(e.target.value)}
            className="recipe-name-input"
          />
        </div>

        {/* Ingredient Search and Add Section */}
        <div className="recipe-section">
          <label className="section-label">Search and Add Ingredients</label>
          <div className="ingredient-search-container">
            <input
              type="text"
              placeholder="Search ingredients..."
              value={searchTerm}
              onChange={(e) => {
                const value = e.target.value
                setSearchTerm(value)
                setShowSearchResults(true)
                if (
                  selectedIngredient &&
                  value.toLowerCase() !== selectedIngredient.item.toLowerCase()
                ) {
                  setSelectedIngredient(null)
                }
              }}
              onFocus={() => setShowSearchResults(true)}
              className="ingredient-search-input"
            />

            {showSearchResults && searchResults.length > 0 && (
              <div className="search-results-dropdown">
                {searchResults.map((item, idx) => (
                  <div
                    key={idx}
                    className="search-result-item"
                    onPointerDown={(e) => {
                      e.preventDefault()
                      setSearchTerm(item.item)
                      setSelectedIngredient(item)
                      setSelectedUnit(getDefaultUnitForItem(item))
                      setShowSearchResults(false)
                    }}
                  >
                    <span className="result-item-name">{item.item}</span>
                    <span className="result-item-category">{item.category}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quantity and Unit Input */}
          <div className="quantity-section">
            <div className="quantity-input-group">
              <label>Quantity</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={selectedQuantity}
                onChange={(e) => setSelectedQuantity(parseFloat(e.target.value))}
                className="quantity-input"
              />
            </div>

            <div className="unit-input-group">
              <label>Unit</label>
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className={`unit-select${selectedUnit ? '' : ' unit-select-placeholder'}`}
              >
                <option value="" disabled>
                  Select unit
                </option>
                {availableUnits.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="add-ingredient-btn"
              onClick={() => {
                const selectedItem = allGroceryItems.find(
                  (item) => item.item.toLowerCase() === searchTerm.toLowerCase()
                )
                if (!selectedUnit) {
                  setNewIngredientErrorMessage('Please select a unit')
                  return
                }
                if (selectedItem) {
                  handleAddIngredient(selectedItem)
                } else {
                  setNewIngredientErrorMessage(
                    'Please select a valid ingredient from the list'
                  )
                }
              }}
            >
              Add Ingredient
            </button>
          </div>
        </div>

        {/* Ingredients List */}
        {ingredients.length > 0 && (
          <div className="recipe-section">
            <label className="section-label">
              Ingredients ({ingredients.length})
            </label>
            <div className="ingredients-list">
              {ingredients.map((ingredient) => (
                <div key={ingredient.id} className="ingredient-item">
                  <div className="ingredient-info">
                    <span className="ingredient-name">{ingredient.item}</span>
                    <span className="ingredient-amount">
                      {ingredient.quantity} {ingredient.unit}
                    </span>
                  </div>
                  <button
                    className="remove-ingredient-btn"
                    onClick={() => handleRemoveIngredient(ingredient.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Missing Ingredient */}
        <div
          ref={addIngredientSectionRef}
          className="recipe-section add-new-ingredient-section"
        >
          <button
            type="button"
            className={`add-new-ingredient-toggle${showAddIngredientForm ? ' expanded' : ''}`}
            onClick={() => setShowAddIngredientForm(!showAddIngredientForm)}
            aria-expanded={showAddIngredientForm}
          >
            <span>Add Missing Ingredient</span>
            <span className="add-new-ingredient-chevron" aria-hidden="true">
              {showAddIngredientForm ? '▾' : '▸'}
            </span>
          </button>

          {showAddIngredientForm && (
            <div className="add-new-ingredient-form">
              <div className="form-field">
                <label htmlFor="new-ingredient-name">Ingredient Name</label>
                <input
                  id="new-ingredient-name"
                  type="text"
                  placeholder="e.g. Table Salt"
                  value={newIngredientName}
                  onChange={(e) => setNewIngredientName(e.target.value)}
                  className="recipe-name-input"
                />
              </div>

              <div className="form-field">
                <label htmlFor="new-category-file">Category</label>
                <select
                  id="new-category-file"
                  value={newCategoryFile}
                  onChange={(e) => setNewCategoryFile(e.target.value)}
                  className="unit-select"
                >
                  {CATEGORY_FILES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="new-sub-category">Sub-category</label>
                <input
                  id="new-sub-category"
                  type="text"
                  placeholder="e.g. vegetables, spices, cheese"
                  value={newSubCategory}
                  onChange={(e) => setNewSubCategory(e.target.value)}
                  className="recipe-name-input"
                />
              </div>

              <div className="new-ingredient-units">
                <div className="form-field">
                  <label htmlFor="new-unit">Unit</label>
                  <select
                    id="new-unit"
                    value={newUnit}
                    onChange={(e) => handleNewUnitChange(e.target.value)}
                    className="unit-select"
                  >
                    {UNIT_OPTIONS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="new-unit-symbol">Symbol</label>
                  <input
                    id="new-unit-symbol"
                    type="text"
                    value={newUnitSymbol}
                    onChange={(e) => setNewUnitSymbol(e.target.value)}
                    className="quantity-input"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="new-typical-amount">Typical Amount</label>
                  <input
                    id="new-typical-amount"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={newTypicalAmount}
                    onChange={(e) =>
                      setNewTypicalAmount(parseFloat(e.target.value))
                    }
                    className="quantity-input"
                  />
                </div>
              </div>

              <button
                type="button"
                className="save-new-ingredient-btn"
                onClick={handleSaveNewIngredient}
                disabled={isSavingNewIngredient}
              >
                {isSavingNewIngredient ? 'Saving...' : 'Save Ingredient'}
              </button>
            </div>
          )}
        </div>

        {/* Save Recipe Button */}
        <button
          type="button"
          className="save-recipe-btn"
          onClick={handleSaveRecipe}
          disabled={isSavingRecipe}
        >
          {isSavingRecipe ? 'Saving...' : 'Save Recipe'}
        </button>
      </div>

      {saveSuccessMessage && (
        <div
          className="shopping-popup-overlay"
          role="presentation"
        >
          <div
            className="shopping-popup"
            role="alertdialog"
            aria-live="polite"
          >
            {saveSuccessMessage}
          </div>
        </div>
      )}

      {saveErrorMessage && (
        <div
          className="shopping-popup-overlay"
          onClick={() => setSaveErrorMessage(null)}
          role="presentation"
        >
          <div
            className="shopping-popup shopping-popup-error"
            role="alertdialog"
            aria-live="assertive"
            onClick={(e) => e.stopPropagation()}
          >
            {saveErrorMessage}
          </div>
        </div>
      )}

      {newIngredientSuccessMessage && (
        <div className="shopping-popup-overlay" role="presentation">
          <div
            className="shopping-popup"
            role="alertdialog"
            aria-live="polite"
          >
            {newIngredientSuccessMessage}
          </div>
        </div>
      )}

      {newIngredientErrorMessage && (
        <div
          className="shopping-popup-overlay"
          onClick={() => setNewIngredientErrorMessage(null)}
          role="presentation"
        >
          <div
            className="shopping-popup shopping-popup-error"
            role="alertdialog"
            aria-live="assertive"
            onClick={(e) => e.stopPropagation()}
          >
            {newIngredientErrorMessage}
          </div>
        </div>
      )}
    </div>
  )
}

function ShoppingPage({ onBack }: any) {
  const { recipes: savedRecipes, loading: recipesLoading } = useRecipes()
  const [expandedRecipeKey, setExpandedRecipeKey] = useState<string | null>(null)
  const [selectedByRecipe, setSelectedByRecipe] = useState<Record<string, string[]>>({})
  const [showAddedPopup, setShowAddedPopup] = useState(false)

  const getRecipeKey = (recipe: SavedRecipe) => recipe.id

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const toggleRecipe = (recipeKey: string, ingredients: RecipeIngredient[]) => {
    if (expandedRecipeKey === recipeKey) {
      setExpandedRecipeKey(null)
      return
    }

    setExpandedRecipeKey(recipeKey)
    if (!selectedByRecipe[recipeKey]) {
      setSelectedByRecipe((prev) => ({
        ...prev,
        [recipeKey]: ingredients.map((ingredient) => ingredient.id),
      }))
    }
  }

  const toggleIngredient = (recipeKey: string, ingredientId: string) => {
    setSelectedByRecipe((prev) => {
      const current = prev[recipeKey] ?? []
      const isSelected = current.includes(ingredientId)
      return {
        ...prev,
        [recipeKey]: isSelected
          ? current.filter((id) => id !== ingredientId)
          : [...current, ingredientId],
      }
    })
  }

  const handleAddToShoppingList = (recipe: SavedRecipe, recipeKey: string) => {
    const selectedIds = selectedByRecipe[recipeKey] ?? []
    if (selectedIds.length === 0) {
      alert('Please select at least one ingredient')
      return
    }

    const itemsToAdd: ShoppingListItem[] = recipe.ingredients
      .filter((ingredient) => selectedIds.includes(ingredient.id))
      .map((ingredient) => ({
        id: `${ingredient.id}-${Date.now()}-${Math.random()}`,
        item: ingredient.item,
        category: ingredient.category,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        recipeId: recipe.id,
        recipeName: recipe.name,
        addedAt: new Date().toISOString(),
      }))

    const shoppingList: ShoppingListItem[] = JSON.parse(
      localStorage.getItem('shoppingList') || '[]'
    )
    localStorage.setItem(
      'shoppingList',
      JSON.stringify([...shoppingList, ...itemsToAdd])
    )

    setShowAddedPopup(true)
  }

  useEffect(() => {
    if (!showAddedPopup) return

    const timer = window.setTimeout(() => {
      setShowAddedPopup(false)
    }, 2500)

    return () => window.clearTimeout(timer)
  }, [showAddedPopup])

  return (
    <div
      className="page shopping-page light-mode"
      style={{
        backgroundImage: `url(${pantryNoText})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div
        className="page-content produce-background-content"
        style={
          {
            '--produce-bg': `url(${cuttingBoard})`,
          } as React.CSSProperties
        }
      >
        <InlineAuthPanel className="page-inline-auth" />
        <div className="page-header">
          <button className="back-button" onClick={onBack}>
            ← Back
          </button>
          <h1>Build Shopping List from Recipes</h1>
        </div>

        {recipesLoading ? (
          <p className="empty-recipes-message">Loading recipes...</p>
        ) : savedRecipes.length === 0 ? (
          <p className="empty-recipes-message">
            No saved recipes yet. Add recipes on the Input Recipe page to see
            them here.
          </p>
        ) : (
          <div className="saved-recipes-list">
            {savedRecipes.map((recipe) => {
              const recipeKey = getRecipeKey(recipe)
              const isExpanded = expandedRecipeKey === recipeKey
              const selectedIds = selectedByRecipe[recipeKey] ?? []

              return (
                <div key={recipeKey} className="saved-recipe-card">
                  <button
                    type="button"
                    className={`saved-recipe-header${isExpanded ? ' expanded' : ''}`}
                    onClick={() => toggleRecipe(recipeKey, recipe.ingredients)}
                    aria-expanded={isExpanded}
                  >
                    <h2 className="saved-recipe-name">{recipe.name}</h2>
                    <div className="saved-recipe-header-meta">
                      <span className="saved-recipe-date">
                        {formatDate(recipe.createdAt)}
                      </span>
                      <span className="saved-recipe-toggle" aria-hidden="true">
                        {isExpanded ? '▾' : '▸'}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="saved-recipe-details">
                      <ul className="saved-recipe-ingredients">
                        {recipe.ingredients.map((ingredient) => (
                          <li key={ingredient.id}>
                            <label className="saved-recipe-ingredient">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(ingredient.id)}
                                onChange={() =>
                                  toggleIngredient(recipeKey, ingredient.id)
                                }
                              />
                              <span className="ingredient-name">
                                {ingredient.item}
                              </span>
                              <span className="ingredient-amount">
                                {ingredient.quantity} {ingredient.unit}
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        className="add-to-shopping-list-btn"
                        onClick={() => handleAddToShoppingList(recipe, recipeKey)}
                      >
                        Add to my shopping list
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showAddedPopup && (
        <div
          className="shopping-popup-overlay"
          onClick={() => setShowAddedPopup(false)}
          role="presentation"
        >
          <div
            className="shopping-popup"
            role="alertdialog"
            aria-live="polite"
            onClick={(e) => e.stopPropagation()}
          >
            Items added to shopping list
          </div>
        </div>
      )}
    </div>
  )
}

function GoShoppingPage({ onBack }: any) {
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([])
  const [foundItems, setFoundItems] = useState<Set<string>>(new Set())
  const [showCheckoutPopup, setShowCheckoutPopup] = useState(false)

  useEffect(() => {
    const items: ShoppingListItem[] = JSON.parse(
      localStorage.getItem('shoppingList') || '[]'
    )
    setShoppingList(items)
  }, [])

  const combinedList = useMemo(
    () => combineShoppingList(shoppingList),
    [shoppingList]
  )

  const ingredientsLeftToFind = useMemo(
    () => combinedList.filter((item) => !foundItems.has(item.key)).length,
    [combinedList, foundItems]
  )

  const recipeStatuses = useMemo(
    () => getRecipeShoppingStatuses(shoppingList, foundItems),
    [shoppingList, foundItems]
  )

  useEffect(() => {
    const allFound =
      combinedList.length > 0 &&
      combinedList.every((item) => foundItems.has(item.key))

    if (allFound) {
      setShowCheckoutPopup(true)
    } else {
      setShowCheckoutPopup(false)
    }
  }, [combinedList, foundItems])

  useEffect(() => {
    if (!showCheckoutPopup) return

    const timer = window.setTimeout(() => {
      setShowCheckoutPopup(false)
    }, 2500)

    return () => window.clearTimeout(timer)
  }, [showCheckoutPopup])

  const toggleFoundItem = (key: string) => {
    setFoundItems((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleClearShoppingList = () => {
    localStorage.setItem('shoppingList', '[]')
    setShoppingList([])
    setFoundItems(new Set())
    setShowCheckoutPopup(false)
  }

  return (
    <div
      className="page go-shopping-page light-mode"
      style={{
        backgroundImage: `url(${pantryNoText})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div
        className="page-content produce-background-content"
        style={
          {
            '--produce-bg': `url(${cuttingBoard})`,
          } as React.CSSProperties
        }
      >
        <InlineAuthPanel className="page-inline-auth" />
        <div className="page-header">
          <button className="back-button" onClick={onBack}>
            ← Back
          </button>
          <h1>Let's Go Shopping</h1>
        </div>

        {shoppingList.length === 0 ? (
          <p className="empty-recipes-message">
            Your shopping list is empty. Go to Build Shopping List from Recipes
            to add ingredients from your saved recipes.
          </p>
        ) : (
          <div className="shopping-list-section">
            <p className="shopping-list-count">
              {ingredientsLeftToFind} ingredient
              {ingredientsLeftToFind === 1 ? '' : 's'} left to find
            </p>
            <div className="recipe-shopping-status-list">
              {recipeStatuses.map((status) => (
                <p
                  key={status.recipeName}
                  className={`recipe-shopping-status${
                    status.isComplete ? ' complete' : ''
                  }`}
                >
                  {status.isComplete
                    ? `${status.recipeName} — recipe complete`
                    : `${status.recipeName} — ${status.ingredientsLeft} ingredient${
                        status.ingredientsLeft === 1 ? '' : 's'
                      } left to find`}
                </p>
              ))}
            </div>
            <ul className="shopping-list">
              {combinedList.map((item) => {
                const isFound = foundItems.has(item.key)

                return (
                  <li
                    key={item.key}
                    className={`shopping-list-item${isFound ? ' found' : ''}`}
                  >
                    <div className="shopping-list-item-info">
                      <span className="ingredient-name">{item.item}</span>
                      <span className="ingredient-amount">
                        {item.quantity % 1 === 0
                          ? item.quantity
                          : Number(item.quantity.toFixed(1))}{' '}
                        {item.unit}
                      </span>
                      <span className="shopping-list-recipe">
                        {item.recipeNames.join(', ')}
                      </span>
                    </div>
                    <label className="shopping-list-found-label">
                      <input
                        type="checkbox"
                        checked={isFound}
                        onChange={() => toggleFoundItem(item.key)}
                      />
                      Found item
                    </label>
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              className="clear-shopping-list-btn"
              onClick={handleClearShoppingList}
            >
              Clear Shopping List
            </button>
          </div>
        )}
      </div>

      {showCheckoutPopup && (
        <div
          className="shopping-popup-overlay"
          onClick={() => setShowCheckoutPopup(false)}
          role="presentation"
        >
          <div
            className="shopping-popup"
            role="alertdialog"
            aria-live="polite"
            onClick={(e) => e.stopPropagation()}
          >
            Time to checkout!
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  const { user, loading, isConfigured } = useAuth()
  const [currentPage, setCurrentPage] = useState('home')
  const [loginDismissed, setLoginDismissed] = useState(
    () => localStorage.getItem(AUTH_LOGIN_DISMISSED_KEY) === 'true'
  )
  const [loginPanelOpen, setLoginPanelOpen] = useState(false)

  const dismissLogin = useCallback(() => {
    setLoginDismissed(true)
    setLoginPanelOpen(false)
    localStorage.setItem(AUTH_LOGIN_DISMISSED_KEY, 'true')
  }, [])

  const openLogin = useCallback(() => {
    setLoginPanelOpen(true)
  }, [])

  useEffect(() => {
    if (user) {
      setLoginPanelOpen(false)
    }
  }, [user])

  const showInlineLogin =
    isConfigured && !loading && !user && !loginDismissed && !loginPanelOpen
  const showLoginButton =
    isConfigured && !loading && !user && loginDismissed && !loginPanelOpen
  const showLoginModal = isConfigured && !loading && !user && loginPanelOpen

  const authUIValue = useMemo(
    () => ({
      showInlineLogin,
      dismissLogin,
    }),
    [showInlineLogin, dismissLogin]
  )

  return (
    <AuthUIContext.Provider value={authUIValue}>
      {isConfigured && (loading || user) && <AuthBar />}
      {showLoginButton && (
        <button type="button" className="auth-login-trigger" onClick={openLogin}>
          Login
        </button>
      )}
      {showLoginModal && (
        <div
          className="auth-login-overlay"
          onClick={() => setLoginPanelOpen(false)}
          role="presentation"
        >
          <AuthSectionCard
            className="auth-login-modal"
            onDismiss={dismissLogin}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
      {currentPage === 'home' && (
        <HomePage
          onRecipeClick={() => setCurrentPage('input-recipe')}
          onShoppingClick={() => setCurrentPage('shopping')}
          onGoShoppingClick={() => setCurrentPage('go-shopping')}
        />
      )}
      {currentPage === 'input-recipe' && (
        <InputRecipePage onBack={() => setCurrentPage('home')} />
      )}
      {currentPage === 'shopping' && (
        <ShoppingPage onBack={() => setCurrentPage('home')} />
      )}
      {currentPage === 'go-shopping' && (
        <GoShoppingPage onBack={() => setCurrentPage('home')} />
      )}
    </AuthUIContext.Provider>
  )
}

export default App
