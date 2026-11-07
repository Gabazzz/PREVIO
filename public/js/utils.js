/* ==========================================================================
   Previo HUD — Shared Utilities
   ========================================================================== */

// Date helper — returns YYYY-MM-DD for a LOCAL calendar date.
// Using Date#toISOString() for "today"/"ontem" is a bug for any timezone behind UTC
// (like Brazil): toISOString() converts to UTC first, so in the evening the UTC
// date can already be tomorrow even though it's still "today" locally.
export function getLocalDateStr(date = new Date()) {
  const d = new Date(date);
  const offsetMs = d.getTimezoneOffset() * 60 * 1000;
  const localMidnight = new Date(d.getTime() - offsetMs);
  return localMidnight.toISOString().split('T')[0];
}

// Format Currency Utility BRL
export function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}
