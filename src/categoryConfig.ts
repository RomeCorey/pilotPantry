export const CATEGORY_FILES = [
  { value: 'produce', label: 'Produce' },
  { value: 'meat_and_poultry', label: 'Meat and Poultry' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'pantry_staples', label: 'Pantry Staples' },
  { value: 'spices_and_seasonings', label: 'Spices and Seasonings' },
  { value: 'baking_supplies', label: 'Baking Supplies' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'frozen_foods', label: 'Frozen Foods' },
  { value: 'snacks', label: 'Snacks' },
  { value: 'breakfast_cereals', label: 'Breakfast Cereals' },
  { value: 'party_supplies', label: 'Party Supplies' },
  { value: 'condiments_and_sauces', label: 'Condiments and Sauces' },
  { value: 'international_foods', label: 'International Foods' },
  { value: 'soups_and_broths', label: 'Soups and Broths' },
  { value: 'baking_mixes', label: 'Baking Mixes' },
  { value: 'organic_and_specialty', label: 'Organic and Specialty' },
  { value: 'baby_and_toddler', label: 'Baby and Toddler' },
] as const

export const UNIT_OPTIONS = [
  'ounces',
  'pounds',
  'grams',
  'kilograms',
  'cups',
  'tablespoons',
  'teaspoons',
  'fluid ounces',
  'milliliters',
  'liters',
  'gallons',
  'quarts',
  'count',
] as const

export const UNIT_SYMBOLS: Record<string, string> = {
  ounces: 'oz',
  pounds: 'lb',
  grams: 'g',
  kilograms: 'kg',
  cups: 'cup',
  tablespoons: 'tbsp',
  teaspoons: 'tsp',
  'fluid ounces': 'fl oz',
  milliliters: 'ml',
  liters: 'L',
  gallons: 'gal',
  quarts: 'qt',
  count: 'count',
}

export function getUnitOptionsForItem(
  item: { common_units?: Array<{ unit: string }> } | null | undefined
): string[] {
  const preferred = item?.common_units?.map((unit) => unit.unit) ?? []
  const preferredSet = new Set(preferred)
  const remainder = UNIT_OPTIONS.filter((unit) => !preferredSet.has(unit))

  if (preferred.length === 0) {
    return [...UNIT_OPTIONS]
  }

  return [...preferred, ...remainder]
}

export function getDefaultUnitForItem(
  item: { common_units?: Array<{ unit: string }> } | null | undefined
): string {
  return item?.common_units?.[0]?.unit ?? UNIT_OPTIONS[0]
}

export function ingredientNameToKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}
