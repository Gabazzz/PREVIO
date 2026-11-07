/* ==========================================================================
   Previo HUD — Core Calculations & Projections Engine (v2 Evolutions)
   ========================================================================== */

import { transactions, activePeriodFilter } from './state.js';

export let stats = {
  currentBalance: 0,
  freeBalance: 0,
  committedFixed: 0,
  burnRate: 0,
  burnRate3d: 0,
  burnAccelerating: false,
  burnDecelerating: false,
  daysRemaining: 0,
  projectedCollapse: null,
  zone: 'safe',
  dailyCeilingSafe: 0,
  dailyCeilingBreakeven: 0
};

// Date range selector helper
export function getFilterDateRange() {
  const today = new Date();
  today.setHours(0,0,0,0);

  let from = null;
  let to = null;

  switch (activePeriodFilter.type) {
    case 'today':
      from = new Date(today);
      to = new Date(today);
      break;
    case '7d':
      from = new Date(today);
      from.setDate(today.getDate() - 6);
      to = new Date(today);
      break;
    case 'month':
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      break;
    case 'last_month':
      from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      to = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    case 'custom':
      if (activePeriodFilter.from && activePeriodFilter.to) {
        from = new Date(activePeriodFilter.from + 'T00:00:00');
        to = new Date(activePeriodFilter.to + 'T00:00:00');
      } else {
        // Fallback to month
        from = new Date(today.getFullYear(), today.getMonth(), 1);
        to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      }
      break;
  }

  return { from, to };
}

export function runCoreCalculations() {
  transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

  // 1. Calculate Absolute Balance (Always all transactions)
  let balance = 0;
  transactions.forEach(tx => {
    if (tx.type === 'entrada') {
      balance += tx.value;
    } else if (tx.type === 'saída') {
      balance -= tx.value;
    }
  });
  stats.currentBalance = balance;

  // 2. Committed fixed expenses for current month
  const today = new Date();
  today.setHours(0,0,0,0);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  let committedFixed = 0;
  transactions.forEach(tx => {
    if (tx.type === 'saída' && tx.recurring) {
      const txDate = new Date(tx.date + 'T00:00:00');
      const dayOfMonth = txDate.getDate();
      const nextOccurrence = new Date(today.getFullYear(), today.getMonth(), dayOfMonth);
      // If the recurring day falls after today, but still within this month
      if (nextOccurrence > today && nextOccurrence <= lastDayOfMonth) {
        committedFixed += tx.value;
      }
    }
  });

  stats.committedFixed = committedFixed;
  stats.freeBalance = stats.currentBalance - committedFixed;

  // 3. Get Filter range for burnRate & projections
  const { from, to } = getFilterDateRange();

  // Calculate variable burn rate in the selected range
  let variableSpentInPeriod = 0;
  transactions.forEach(tx => {
    if (tx.type === 'saída' && !tx.recurring) {
      const txDate = new Date(tx.date + 'T00:00:00');
      if (txDate >= from && txDate <= to) {
        variableSpentInPeriod += tx.value;
      }
    }
  });

  const diffTime = Math.abs(to.getTime() - from.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  stats.burnRate = variableSpentInPeriod / diffDays;

  // 4. BurnRate last 3 days (trend monitoring) - Variable expenses only
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(today.getDate() - 2);

  let expensesIn3Days = 0;
  transactions.forEach(tx => {
    if (tx.type === 'saída' && !tx.recurring) {
      const txDate = new Date(tx.date + 'T00:00:00');
      if (txDate >= threeDaysAgo && txDate <= today) {
        expensesIn3Days += tx.value;
      }
    }
  });
  stats.burnRate3d = expensesIn3Days / 3;

  // Set trend indicators (requires a non-zero base)
  if (stats.burnRate > 0) {
    stats.burnAccelerating = stats.burnRate3d > stats.burnRate * 1.20;
    stats.burnDecelerating = stats.burnRate3d < stats.burnRate * 0.80;
  } else {
    stats.burnAccelerating = false;
    stats.burnDecelerating = false;
  }

  // 5. Autonomy days remaining (Calculated on FREE BALANCE and VARIABLE burnRate)
  if (stats.burnRate > 0) {
    stats.daysRemaining = Math.max(0, stats.freeBalance / stats.burnRate);
  } else {
    stats.daysRemaining = stats.freeBalance > 0 ? Infinity : 0;
  }

  // Projected collapse date
  if (isFinite(stats.daysRemaining) && stats.daysRemaining > 0) {
    const collapse = new Date(today);
    collapse.setDate(today.getDate() + Math.ceil(stats.daysRemaining));
    stats.projectedCollapse = collapse;
  } else {
    stats.projectedCollapse = null;
  }

  // Zone selection
  if (stats.daysRemaining > 15) {
    stats.zone = 'safe';
  } else if (stats.daysRemaining > 7) {
    stats.zone = 'attention';
  } else {
    stats.zone = 'critical';
  }

  // 6. Dynamic Daily Ceiling
  const daysLeftInMonth = lastDayOfMonth.getDate() - today.getDate() + 1;

  stats.dailyCeilingBreakeven = daysLeftInMonth > 0 ? stats.freeBalance / daysLeftInMonth : 0;
  stats.dailyCeilingSafe = daysLeftInMonth > 0 ? (stats.freeBalance * 0.9) / daysLeftInMonth : 0;
}
