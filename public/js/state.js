/* ==========================================================================
   Previo HUD — Shared Mutable State
   ========================================================================== */
// ES modules give importers a read-only LIVE BINDING for a `let` export: other
// files can read the current value and mutate object/array properties freely
// (push, sort, property assignment), but cannot reassign the binding itself
// (`transactions = x`) from outside this file. Anywhere the original code
// reassigned one of these variables wholesale, that now goes through the
// matching setter below instead.

export let transactions = [];
export function setTransactions(newTransactions) {
  transactions = newTransactions;
}

// Global Filter State (retrieved from storage or defaults to month)
export let activePeriodFilter = {
  type: 'month',       // 'today' | '7d' | 'month' | 'last_month' | 'custom'
  from: null,          // ISO date string
  to: null             // ISO date string
};
export function setActivePeriodFilter(newFilter) {
  activePeriodFilter = newFilter;
}

// Modal & Swipe State
export let activeEditId = null;
export function setActiveEditId(id) {
  activeEditId = id;
}

export let activeSwipedItem = null;
export function setActiveSwipedItem(item) {
  activeSwipedItem = item;
}

export let currentView = 'dashboard';
export function setCurrentView(view) {
  currentView = view;
}
