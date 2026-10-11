/**
 * Category-overlap matching. Pure and read-only: it never computes scores and never
 * changes a person's or advisor's categories. A match = at least one shared category.
 * No ranking formula — results keep the advisor input order.
 */
export interface CategorizedAdvisor { id: string; categories: string[]; isActive: boolean }
export interface CategoryMatch { advisorId: string; sharedCategories: string[] }

export function matchByCategories(personCategories: readonly string[], advisors: readonly CategorizedAdvisor[]): CategoryMatch[] {
  if (!personCategories.length) return []; // no categories → no false matches
  const mine = new Set(personCategories);
  return advisors
    .filter((a) => a.isActive)
    .map((a) => ({ advisorId: a.id, sharedCategories: a.categories.filter((c) => mine.has(c)).sort() }))
    .filter((m) => m.sharedCategories.length > 0);
}
