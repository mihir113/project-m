// Predefined color palette for categories
export const CATEGORY_COLORS = [
  "#4f6ff5", "#e879a0", "#a78bfa", "#60a5fa",
  "#34d399", "#fbbf24", "#fb923c", "#f472b6",
  "#38bdf8", "#4ade80", "#c084fc", "#fb7185",
];

const DEFAULT_COLOR = "#4f6ff5";

/**
 * Build a deterministic mapping of category → color from existing projects.
 * Each unique category gets a unique color from the palette.
 * Uncategorized projects use the default color.
 */
export function buildCategoryColorMap(
  projects: Array<{ category: string | null }>
): Record<string, string> {
  const map: Record<string, string> = {};
  const usedColors = new Set<string>();

  // Extract unique categories in order of first appearance
  const seenCategories: string[] = [];
  for (const p of projects) {
    if (p.category && !seenCategories.includes(p.category)) {
      seenCategories.push(p.category);
    }
  }

  // Assign colors round-robin from the palette
  for (let i = 0; i < seenCategories.length; i++) {
    const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
    map[seenCategories[i]] = color;
    usedColors.add(color);
  }

  return map;
}

/**
 * Get the color for a category. If the category is new (not in map),
 * pick the next unused color from the palette.
 */
export function getCategoryColor(
  category: string | null | undefined,
  categoryColorMap: Record<string, string>
): string {
  if (!category) return DEFAULT_COLOR;
  if (categoryColorMap[category]) return categoryColorMap[category];

  // New category — pick next unused color
  const usedColors = new Set(Object.values(categoryColorMap));
  const available = CATEGORY_COLORS.find((c) => !usedColors.has(c));
  return available || CATEGORY_COLORS[Object.keys(categoryColorMap).length % CATEGORY_COLORS.length];
}
