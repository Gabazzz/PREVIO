/* ==========================================================================
   Previo HUD — Custom Categories
   ==========================================================================
   The fixed CATEGORIES/CATEGORY_COLORS in constants.js stay untouched (they
   anchor existing data and the recurring-engine's category matching). This
   module layers user-added categories on top, stored in localStorage, so a
   custom category behaves the same as a built-in one everywhere it's read
   through the helpers below instead of the raw constants. */

import { CATEGORIES, CATEGORY_COLORS, CUSTOM_CATEGORIES_KEY } from './constants.js';

// Cycled by creation order so each new custom category gets a distinct,
// legible color without the user having to pick one.
const PALETTE = ['#06b6d4', '#a855f7', '#eab308', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#d946ef'];

function loadCustom() {
  try {
    const raw = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return { saída: (parsed && parsed.saída) || [], entrada: (parsed && parsed.entrada) || [] };
  } catch (e) {
    return { saída: [], entrada: [] };
  }
}

function saveCustom(data) {
  localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(data));
}

// Full list (built-in + custom) of category names for a transaction type —
// this is what the transaction modal's category chips should iterate over.
export function getCategories(type) {
  const custom = loadCustom();
  return [...CATEGORIES[type], ...custom[type].map(c => c.name)];
}

export function getCustomCategories() {
  return loadCustom();
}

export function getCategoryColor(name) {
  if (CATEGORY_COLORS[name]) return CATEGORY_COLORS[name];
  const custom = loadCustom();
  const found = custom.saída.find(c => c.name === name) || custom.entrada.find(c => c.name === name);
  return found ? found.color : '#64748b';
}

export function addCustomCategory(type, rawName) {
  const name = (rawName || '').trim();
  if (!name) return { ok: false, error: 'Dê um nome para a categoria.' };
  if (name.length > 24) return { ok: false, error: 'Nome muito longo (máx. 24 caracteres).' };

  const existing = getCategories(type);
  if (existing.some(c => c.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: 'Essa categoria já existe.' };
  }

  const custom = loadCustom();
  const color = PALETTE[custom[type].length % PALETTE.length];
  custom[type].push({ name, color });
  saveCustom(custom);
  return { ok: true };
}

// Removing a category never touches past transactions already filed under
// it — they just keep showing that name/color via getCategoryColor's
// fallback. It only stops it from appearing as a choice going forward.
export function removeCustomCategory(type, name) {
  const custom = loadCustom();
  custom[type] = custom[type].filter(c => c.name !== name);
  saveCustom(custom);
}
