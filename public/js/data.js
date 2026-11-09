/* ==========================================================================
   Previo HUD — Data Loading, Onboarding Submission & Hard Reset
   ========================================================================== */

import { supabase, getCurrentUser } from './supabase-client.js';
import { DOM } from './dom.js';
import { FILTER_STORAGE_KEY } from './constants.js';
import { getLocalDateStr } from './utils.js';
import {
  transactions, setTransactions,
  setActivePeriodFilter
} from './state.js';
import { populateMonthSelector, processAndRenderAll } from './render.js';
import {
  isOnline, generateTempId, queueInsert,
  cacheTransactionsLocally, getLocallyCachedTransactions,
  applyQueuedInsertsToTransactions, syncPendingOperations
} from './offline.js';
import { updateOfflineBanner } from './offline-ui.js';

// Load from Supabase. Returns true on success, false on failure — callers must
// NEVER treat "false" the same as "zero transactions" (that would misfire onboarding
// and risk duplicating the user's initial balance on a flaky connection).
//
// Offline-aware: if the network fetch fails but we have a local cache from a
// previous successful load, we fall back to that cache instead of showing
// the hard error screen — the dashboard just runs on slightly-stale data
// until the connection comes back.
export async function loadData() {
  const user = await getCurrentUser();
  if (!user) return false;

  const savedFilter = localStorage.getItem(FILTER_STORAGE_KEY);
  if (savedFilter) {
    try { setActivePeriodFilter(JSON.parse(savedFilter)); } catch (e) { /* ignore corrupt value */ }
  }

  let data = null, error = null;
  try {
    const res = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });
    data = res.data;
    error = res.error;
  } catch (e) {
    error = e;
  }

  if (error || !data) {
    console.error('[loadData] Falha ao carregar transações:', error);
    const cached = getLocallyCachedTransactions();
    if (cached) {
      setTransactions(cached);
      return true; // degrade gracefully: show the last known data, offline-style
    }
    return false;
  }

  setTransactions(data.map(t => ({
    id: t.id,
    date: t.date,
    type: t.type,
    category: t.category,
    description: t.description,
    value: t.value,
    recurring: t.recurring,
    pontual: t.pontual,
    va: t.va
  })));

  // Re-surface any lançamentos created while offline that haven't synced yet —
  // the server obviously doesn't know about them.
  setTransactions(applyQueuedInsertsToTransactions(transactions));

  await generateDueRecurringOccurrences();

  // If there's anything still waiting from a previous offline session, try to
  // push it to the server now (rendering happens afterwards, in initApp).
  if (isOnline()) {
    const { idMap } = await syncPendingOperations(supabase, user.id);
    if (idMap.length > 0) {
      setTransactions(transactions.map(t => {
        const match = idMap.find(m => m.tempId === t.id);
        return match ? { ...t, id: match.realId } : t;
      }));
    }
  }

  cacheTransactionsLocally(transactions);
  updateOfflineBanner();

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
//
// Offline-aware: when there's no connection, the new occurrences are created
// locally with temporary ids and queued to sync once the connection returns.
// Dia útil = segunda a sexta (não considera feriados, só fins de semana).
function isBusinessDay(date) {
  const dow = date.getDay();
  return dow !== 0 && dow !== 6;
}

// Em qual posição (1º, 2º, 3º dia útil do mês...) a data cai. Se a própria
// data não for dia útil (raro pra um salário, mas possível), conta os dias
// úteis estritamente anteriores a ela.
function businessDayIndexOf(date) {
  let count = 0;
  for (let d = 1; d <= date.getDate(); d++) {
    const cur = new Date(date.getFullYear(), date.getMonth(), d);
    if (isBusinessDay(cur)) count++;
  }
  return Math.max(count, 1);
}

// Dia do mês correspondente ao N-ésimo dia útil. Se o mês tiver menos dias
// úteis que N (não deveria acontecer na prática, N raramente passa de ~23),
// cai no último dia útil do mês em vez de estourar pro mês seguinte.
function nthBusinessDayOfMonth(year, month, n) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  let count = 0;
  let fallback = lastDay;
  for (let d = 1; d <= lastDay; d++) {
    const cur = new Date(year, month, d);
    if (isBusinessDay(cur)) {
      count++;
      fallback = d;
      if (count === n) return d;
    }
  }
  return fallback;
}

async function generateDueRecurringOccurrences() {
  const recurringTxs = transactions.filter(t => t.recurring);
  if (recurringTxs.length === 0) return;

  const user = await getCurrentUser();
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

    // Entradas recorrentes (salário) seguem o Nº dia útil do mês, não o dia
    // fixo — "todo dia 5 útil" pode cair no dia 5, 6 ou 7 dependendo do mês,
    // enquanto despesas fixas (aluguel, assinaturas) seguem mesmo o dia fixo.
    const useBusinessDay = template.type === 'entrada';
    const businessDayN = useBusinessDay ? businessDayIndexOf(templateDate) : null;

    const existingMonths = new Set(series.map(t => t.date.slice(0, 7)));

    let cursorYear = templateDate.getFullYear();
    let cursorMonth = templateDate.getMonth();

    // Safety cap so a long-dormant series can't generate an unbounded backlog
    for (let guard = 0; guard < 24; guard++) {
      cursorMonth++;
      if (cursorMonth > 11) { cursorMonth = 0; cursorYear++; }

      if (cursorYear > todayYear || (cursorYear === todayYear && cursorMonth > todayMonth)) break;

      const lastDayOfCursorMonth = new Date(cursorYear, cursorMonth + 1, 0).getDate();
      const occurrenceDay = useBusinessDay
        ? nthBusinessDayOfMonth(cursorYear, cursorMonth, businessDayN)
        : Math.min(dueDay, lastDayOfCursorMonth);

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
        recurring: true,
        pontual: template.pontual || false,
        va: template.va || false
      });
      existingMonths.add(monthKey);
    }
  });

  if (toInsert.length === 0) return;

  if (isOnline()) {
    try {
      const { data, error } = await supabase.from('transactions').insert(toInsert).select();
      if (error) throw error;
      if (data) {
        data.forEach(t => transactions.push({
          id: t.id, date: t.date, type: t.type, category: t.category,
          description: t.description, value: t.value, recurring: t.recurring,
          pontual: t.pontual, va: t.va
        }));
      }
      return;
    } catch (e) {
      console.error('[generateDueRecurringOccurrences] Falha ao gerar ocorrências recorrentes, mantendo localmente:', e);
      // fall through to the offline path below
    }
  }

  toInsert.forEach(payload => {
    const tempId = generateTempId();
    transactions.push({
      id: tempId, date: payload.date, type: payload.type, category: payload.category,
      description: payload.description, value: payload.value, recurring: payload.recurring
    });
    queueInsert(tempId, payload);
  });
}

export async function submitOnboardingData() {
  const user = await getCurrentUser();
  const initialBalance = parseFloat(DOM.inputInitialBalance.value);
  const monthlyIncome = parseFloat(DOM.inputMonthlyIncome.value);
  const mainFixed = parseFloat(DOM.inputMainFixed.value);
  const mainFixedDesc = DOM.inputMainFixedDesc.value.trim() || 'Despesa Fixa';
  const todayStr = getLocalDateStr();

  const toInsert = [];
  toInsert.push({ user_id: user.id, date: todayStr, type: 'entrada', category: 'Saldo Inicial', description: 'Saldo Inicial', value: initialBalance, recurring: false });
  if (!isNaN(monthlyIncome) && monthlyIncome > 0) toInsert.push({ user_id: user.id, date: todayStr, type: 'entrada', category: 'Salário', description: 'Renda Mensal Estimada', value: monthlyIncome, recurring: true });
  if (!isNaN(mainFixed) && mainFixed > 0) toInsert.push({ user_id: user.id, date: todayStr, type: 'saída', category: 'Moradia', description: mainFixedDesc, value: mainFixed, recurring: true });

  let inserted = false;
  if (isOnline()) {
    try {
      const { data, error } = await supabase.from('transactions').insert(toInsert).select();
      if (error) throw error;
      if (data) {
        setTransactions(data.map(t => ({ id: t.id, date: t.date, type: t.type, category: t.category, description: t.description, value: t.value, recurring: t.recurring, pontual: t.pontual, va: t.va })));
        inserted = true;
      }
    } catch (e) {
      console.error('[submitOnboardingData] Falha ao salvar onboarding online, salvando localmente:', e);
    }
  }

  if (!inserted) {
    const newTxs = toInsert.map(payload => {
      const tempId = generateTempId();
      queueInsert(tempId, payload);
      return { id: tempId, date: payload.date, type: payload.type, category: payload.category, description: payload.description, value: payload.value, recurring: payload.recurring };
    });
    setTransactions(newTxs);
  }

  cacheTransactionsLocally(transactions);
  updateOfflineBanner();
  populateMonthSelector();
  DOM.screenOnboarding.style.opacity = '0';
  setTimeout(() => { DOM.screenOnboarding.style.display = 'none'; processAndRenderAll(); }, 300);
}

// Hard Reset — delete all of the user's transactions on Supabase and restart onboarding.
// Requires a live connection: deleting everything is destructive and irreversible,
// so it's not something to queue up and risk applying later against data the
// user may have changed in the meantime.
export async function handleHardReset() {
  if (!isOnline()) {
    alert('Conecte-se à internet para apagar os dados.');
    return;
  }

  if (!confirm('⚠️ Isso vai apagar TODOS os seus lançamentos do Previo, permanentemente. Confirma o reset?')) return;
  if (!confirm('Tem certeza mesmo? Essa ação não pode ser desfeita.')) return;

  const btnReset = document.getElementById('btn-reset-data');
  if (btnReset) {
    btnReset.disabled = true;
    btnReset.innerText = 'Apagando...';
  }

  const user = await getCurrentUser();
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
