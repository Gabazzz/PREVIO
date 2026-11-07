/* ==========================================================================
   Previo HUD — Category Budget Goals
   ==========================================================================
   A "meta" is a monthly spending cap the user sets for one expense category.
   Stored client-side only (localStorage) — there's no Supabase table for
   this, and it's a personal planning aid rather than data that needs to
   survive a device switch for now. */

import { CATEGORY_GOALS_KEY } from './constants.js';

export function getGoals() {
  try {
    const raw = localStorage.getItem(CATEGORY_GOALS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function getGoal(category) {
  const goals = getGoals();
  return typeof goals[category] === 'number' ? goals[category] : null;
}

export function setGoal(category, limit) {
  const goals = getGoals();
  const parsed = parseFloat(limit);
  if (isNaN(parsed) || parsed <= 0) {
    delete goals[category];
  } else {
    goals[category] = parsed;
  }
  localStorage.setItem(CATEGORY_GOALS_KEY, JSON.stringify(goals));
  return goals;
}

export function removeGoal(category) {
  const goals = getGoals();
  delete goals[category];
  localStorage.setItem(CATEGORY_GOALS_KEY, JSON.stringify(goals));
}
