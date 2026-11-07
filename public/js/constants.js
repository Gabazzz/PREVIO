/* ==========================================================================
   Previo HUD — Constants (storage keys, categories, category colors)
   ========================================================================== */

export const STORAGE_KEY = 'previo_transactions';
export const FILTER_STORAGE_KEY = 'previo_period_filter';
export const DELTA_STORAGE_KEY = 'previo_last_days';

// Available Categories
export const CATEGORIES = {
  saída: ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Outros'],
  entrada: ['Saldo Inicial', 'Salário', 'Freela', 'Rendimentos', 'Outros']
};

export const CATEGORY_COLORS = {
  'Alimentação': '#f59e0b',
  'Transporte': '#3b82f6',
  'Moradia': '#8b5cf6',
  'Saúde': '#ef4444',
  'Lazer': '#ec4899',
  'Saldo Inicial': '#10d98c',
  'Salário': '#10d98c',
  'Freela': '#3b82f6',
  'Rendimentos': '#10d98c',
  'Outros': '#64748b'
};
