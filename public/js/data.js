/* ==========================================================================
   Previo HUD — Data Loading, Onboarding Submission & Hard Reset
   ========================================================================== */

import { supabase } from './supabase-client.js';
import { DOM } from './dom.js';
import { FILTER_STORAGE_KEY } from './constants.js';
import { getLocalDateStr } from './utils.js';
import {
  transactions, setTransactions,
  setActivePeriodFilter
} from './state.js';
import { populateMonthSelector, processAndRenderAll } from './render.js';

// Load from Supabase. Returns true on success, false on failure — callers must
// NEVER treat "false" the same as "zero transactions" (that would misfire onboarding
// and risk duplicating the user's initial balance on a flaky connection).
export async function loadData() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const savedFilter = localStorage.getItem(FILTER_STORAGE_KEY);
  if (savedFilter) {
    try { setActivePeriodFilter(JSON.parse(savedFilter)); } catch (e) { /* ignore corrupt value */ }
  }

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false });

  if (error || !data) {
    console.error('[loadData] Falha ao carregar transações:', error);
    return false;
  }

  setTransactions(data.map(t => ({
    id: t.id,
    date: t.date,
    type: t.type,
    category: t.category,
    description: t.description,
    value: t.value,
    recurring: t.recurring
  })));

  await generateDueRecurringOccurrences();

  return true;
}

// Save to Supabase (no-op — saves done per operation)
export async function saveData() {
  // Não faz nada — salvar é feito individualmente por operação
}

// Recurring Transactions Engine
// -----------------------------------------------------------------------------
// A "recorrente" transaction was previously just a boolean flag on a single row —
// nothing ever created next month's occurrence automatically, so the balance and
// the 30-day projection silently stopped accounting for rent/subscriptions the
// moment the user didn't manually re-enter them. This generates the missing
// occurrences (catching up on any skipped months) whenever data is loaded, so the
// dashboard numbers stay trustworthy without the user having to think about it.
async function generateDueRecurringOccurrences() {
  const recurringTxs = transactions.filter(t => t.recurring);
  if (recurringTxs.length === 0) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Group into series by identity (same type + category + description = same bill)
  const seriesMap = {};
  recurringTxs.forEach(t => {
    const key = `${t.type}|${t.category}|${t.description}`;
    (seriesMap[key] = seriesMap[key] || []).push(t);
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();

  const toInsert = [];

  Object.values(seriesMap).forEach(series => {
    series.sort((a, b) => new Date(b.date) - new Date(a.date));
    const template = series[0];
    const templateDate = new Date(template.date + 'T00:00:00');
    const dueDay = templateDate.getDate();

    const existingMonths = new Set(series.map(t => t.date.slice(0, 7)));

    let cursorYear = templateDate.getFullYear();
    let cursorMonth = templateDate.getMonth();

    // Safety cap so a long-dormant series can't generate an unbounded backlog
    for (let guard = 0; guard < 24; guard++) {
      cursorMonth++;
      if (cursorMonth > 11) { cursorMonth = 0; cursorYear++; }

      if (cursorYear > todayYear || (cursorYear === todayYear && cursorMonth > todayMonth)) break;

      const lastDayOfCursorMonth = new Date(cursorYear, cursorMonth + 1, 0).getDate();
      const occurrenceDay = Math.min(dueDay, lastDayOfCursorMonth);

      const isCurrentMonth = cursorYear === todayYear && cursorMonth === todayMonth;
      if (isCurrentMonth && todayDay < occurrenceDay) break; // due date hasn't arrived yet

      const monthKey = `${cursorYear}-${String(cursorMonth + 1).padStart(2, '0')}`;
      if (existingMonths.has(monthKey)) continue;

      toInsert.push({
        user_id: user.id,
        date: `${monthKey}-${String(occurrenceDay).padStart(2, '0')}`,
        type: template.type,
        category: template.category,
        description: template.description,
        value: template.value,
        recurring: true
      });
      existingMonths.add(monthKey);
    }
  });

  if (toInsert.length === 0) return;

  const { data, error } = await supabase.from('transactions').insert(toInsert).select();
  if (error) {
    console.error('[generateDueRecurringOccurrences] Falha ao gerar ocorrências recorrentes:', error);
    return;
  }
  if (data) {
    data.forEach(t => transactions.push({
      id: t.id, date: t.date, type: t.type, category: t.category,
      description: t.description, value: t.value, recurring: t.recurring
    }));
  }
}

export async function submitOnboardingData() {
  const { data: { user } } = await supabase.auth.getUser();
  const initialBalance = parseFloat(DOM.inputInitialBalance.value);
  const monthlyIncome = parseFloat(DOM.inputMonthlyIncome.value);
  const mainFixed = parseFloat(DOM.inputMainFixed.value);
  const mainFixedDesc = DOM.inputMainFixedDesc.value.trim() || 'Despesa Fixa';
  const todayStr = getLocalDateStr();

  const toInsert = [];
  toInsert.push({ user_id: user.id, date: todayStr, type: 'entrada', category: 'Saldo Inicial', description: 'Saldo Inicial', value: initialBalance, recurring: false });
  if (!isNaN(monthlyIncome) && monthlyIncome > 0) toInsert.push({ user_id: user.id, date: todayStr, type: 'entrada', category: 'Salário', description: 'Renda Mensal Estimada', value: monthlyIncome, recurring: true });
  if (!isNaN(mainFixed) && mainFixed > 0) toInsert.push({ user_id: user.id, date: todayStr, type: 'saída', category: 'Moradia', description: mainFixedDesc, value: mainFixed, recurring: true });

  const { data, error } = await supabase.from('transactions').insert(toInsert).select();
  if (!error && data) setTransactions(data.map(t => ({ id: t.id, date: t.date, type: t.type, category: t.category, description: t.description, value: t.value, recurring: t.recurring })));

  populateMonthSelector();
  DOM.screenOnboarding.style.opacity = '0';
  setTimeout(() => { DOM.screenOnboarding.style.display = 'none'; processAndRenderAll(); }, 300);
}

// Hard Reset — delete all of the user's transactions on Supabase and restart onboarding
export async function handleHardReset() {
  if (!confirm('⚠️ Isso vai apagar TODOS os seus lançamentos do Previo, permanentemente. Confirma o reset?')) return;
  if (!confirm('Tem certeza mesmo? Essa ação não pode ser desfeita.')) return;

  const btnReset = document.getElementById('btn-reset-data');
  if (btnReset) {
    btnReset.disabled = true;
    btnReset.innerText = 'Apagando...';
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { location.reload(); return; }

  const { error } = await supabase.from('transactions').delete().eq('user_id', user.id);

  if (error) {
    alert('Não foi possível apagar os dados agora. Verifique sua conexão e tente novamente.');
    if (btnReset) {
      btnReset.disabled = false;
      btnReset.innerText = 'Apagar todos os dados e reiniciar';
    }
    return;
  }

  localStorage.clear();
  location.reload();
}
