/* ==========================================================================
   Previo HUD — Autonomy Days History Log
   ==========================================================================
   The dashboard already compares "days remaining" against the single last
   value it saw (DELTA_STORAGE_KEY), but that gets overwritten every time —
   there's no trend to look back on. This keeps one entry per calendar day
   (today's value is overwritten if the app is reopened later the same day)
   so the Análise view can chart how autonomy has moved over time. */

import { AUTONOMY_HISTORY_KEY } from './constants.js';
import { getLocalDateStr } from './utils.js';

const MAX_ENTRIES = 90;
// Com pouquíssimo gasto variável registrado no período (ex.: início do mês,
// ou só 1-2 lançamentos de teste), a divisão saldo livre ÷ gasto médio
// diário pode disparar pra centenas de milhares de "dias restantes" — um
// número matematicamente correto, mas inútil pro gráfico (estica o eixo e
// esconde a variação real dos outros dias). Acima desse teto, o valor é
// tratado como "autonomia confortavelmente alta" e registrado nesse teto.
const MAX_PLOTTED_DAYS = 3650; // 10 anos

export function logAutonomySnapshot(daysRemaining) {
  // "∞" (no active burn) isn't a meaningful point on a days-remaining chart —
  // skip logging it rather than plotting a break or a huge spike.
  if (!isFinite(daysRemaining)) return getAutonomyHistory();

  let history = getAutonomyHistory();
  const todayStr = getLocalDateStr();
  const value = Math.min(Math.floor(daysRemaining), MAX_PLOTTED_DAYS);

  const existingIdx = history.findIndex(h => h.date === todayStr);
  if (existingIdx !== -1) {
    history[existingIdx].days = value;
  } else {
    history.push({ date: todayStr, days: value });
  }

  history.sort((a, b) => a.date.localeCompare(b.date));
  if (history.length > MAX_ENTRIES) {
    history = history.slice(history.length - MAX_ENTRIES);
  }

  localStorage.setItem(AUTONOMY_HISTORY_KEY, JSON.stringify(history));
  return history;
}

export function getAutonomyHistory() {
  try {
    const raw = localStorage.getItem(AUTONOMY_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
