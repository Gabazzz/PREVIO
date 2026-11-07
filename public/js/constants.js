/* ==========================================================================
   Previo HUD — Constants (storage keys, categories, category colors)
   ========================================================================== */

export const STORAGE_KEY = 'previo_transactions';
export const FILTER_STORAGE_KEY = 'previo_period_filter';
export const DELTA_STORAGE_KEY = 'previo_last_days';
export const CUSTOM_CATEGORIES_KEY = 'previo_custom_categories';
export const CATEGORY_GOALS_KEY = 'previo_category_goals';
export const AUTONOMY_HISTORY_KEY = 'previo_autonomy_history';
export const NOTIFICATIONS_ENABLED_KEY = 'previo_notifications_enabled';
export const NOTIFICATION_STATE_KEY = 'previo_notification_state';

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
  'Saldo Inicial': '#00ffa8',
  'Salário': '#00ffa8',
  'Freela': '#3b82f6',
  'Rendimentos': '#00ffa8',
  'Outros': '#64748b'
};
