/**
 * Supabase renvoie les relations imbriquées tantôt comme objet, tantôt comme
 * tableau selon la cardinalité inférée. Ce helper renvoie toujours le premier
 * élément (ou l'objet tel quel), ou null.
 */
export function firstRelation<T>(value: T[] | T | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}
