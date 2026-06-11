// Render any serialized cell value as display text. The data layer already converts Date/Decimal/
// BigInt to strings (see db-queries.ts), so here we only need to handle null, booleans, and the
// occasional nested object. A plain hyphen marks an empty value (no em dashes per repo style).
export function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
