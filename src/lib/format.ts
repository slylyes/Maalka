/**
 * Formatage partagé pour toute l'application (cohérence d'affichage).
 */

/** Montant en dinars algériens, format fr-FR avec séparateurs de milliers. Ex: 5000 → "5 000,00 DA" */
export function formatAmount(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return `${safe.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} DA`;
}

/** Date ISO "YYYY-MM-DD" → "JJ-MM-AAAA". Renvoie la valeur telle quelle si non parsable. */
export function formatDateFr(value: string): string {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

/** Vrai si la chaîne est une date calendaire valide au format "YYYY-MM-DD". */
export function isValidDate(value: string | undefined | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}
