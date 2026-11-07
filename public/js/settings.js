/* ==========================================================================
   Configurações — Gerenciamento de Lançamentos Recorrentes
   ========================================================================== */

import { DOM } from './dom.js';
import { supabase } from './supabase-client.js';
import { transactions, setTransactions } from './state.js';
import { formatBRL } from './utils.js';
import { openModal } from './transaction-modal.js';
import { processAndRenderAll } from './render.js';

// Returns one entry per active recurring series (grouped the same way the
// recurring engine groups them), using the most recent occurrence as the
// representative values for display/editing.
function getActiveRecurringSeries() {
  const seriesMap = {};
  transactions.filter(t => t.recurring).forEach(t => {
    const key = `${t.type}|${t.category}|${t.description}`;
    if (!seriesMap[key]) seriesMap[key] = [];
    seriesMap[key].push(t);
  });

  return Object.entries(seriesMap).map(([key, series]) => {
    series.sort((a, b) => new Date(b.date) - new Date(a.date));
    const latest = series[0];
    const dueDay = new Date(latest.date + 'T00:00:00').getDate();
    return { key, latest, dueDay, occurrenceIds: series.map(t => t.id) };
  }).sort((a, b) => a.latest.description.localeCompare(b.latest.description));
}

export async function openSettingsModal() {
  const { data: { user } } = await supabase.auth.getUser();
  DOM.settingsAccountEmail.innerText = user ? user.email : '';
  renderRecurringSettingsList();
  DOM.modalSettings.classList.add('active');
}

function renderRecurringSettingsList() {
  DOM.settingsRecurringList.innerHTML = '';
  const series = getActiveRecurringSeries();

  if (series.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'settings-recurring-empty';
    empty.innerText = 'Nenhum lançamento recorrente ativo.';
    DOM.settingsRecurringList.appendChild(empty);
    return;
  }

  series.forEach(({ key, latest, dueDay }) => {
    const item = document.createElement('div');
    item.className = 'settings-recurring-item';

    const info = document.createElement('div');
    info.className = 'settings-recurring-info';

    const desc = document.createElement('div');
    desc.className = 'settings-recurring-desc';
    desc.textContent = latest.description;

    const meta = document.createElement('div');
    meta.className = 'settings-recurring-meta';
    meta.textContent = `${latest.category} · todo dia ${dueDay}`;

    info.appendChild(desc);
    info.appendChild(meta);

    const value = document.createElement('div');
    value.className = `settings-recurring-value ${latest.type}`;
    value.textContent = `${latest.type === 'saída' ? '-' : '+'} ${formatBRL(latest.value)}`;

    const actions = document.createElement('div');
    actions.className = 'settings-recurring-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit-recurring';
    editBtn.setAttribute('aria-label', 'Editar valor');
    editBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    editBtn.addEventListener('click', () => {
      DOM.modalSettings.classList.remove('active');
      // Editing the most recent occurrence updates the template the recurring
      // engine uses for every future month of this series.
      openModal(latest.type, latest.id);
    });

    const stopBtn = document.createElement('button');
    stopBtn.className = 'btn-stop-recurring';
    stopBtn.setAttribute('aria-label', 'Parar recorrência');
    stopBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`;
    stopBtn.addEventListener('click', () => stopRecurringSeries(key, latest.description));

    actions.appendChild(editBtn);
    actions.appendChild(stopBtn);

    item.appendChild(info);
    item.appendChild(value);
    item.appendChild(actions);
    DOM.settingsRecurringList.appendChild(item);
  });
}

async function stopRecurringSeries(key, description) {
  if (!confirm(`Parar a recorrência de "${description}"? Os lançamentos já feitos continuam no histórico, mas o radar não vai mais gerar novas ocorrências automaticamente.`)) return;

  const [type, category, desc] = key.split('|');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('transactions')
    .update({ recurring: false })
    .eq('user_id', user.id)
    .eq('type', type)
    .eq('category', category)
    .eq('description', desc);

  if (error) {
    alert('Não foi possível parar essa recorrência agora. Tente novamente.');
    return;
  }

  setTransactions(transactions.map(t => {
    if (t.type === type && t.category === category && t.description === desc) {
      return { ...t, recurring: false };
    }
    return t;
  }));

  renderRecurringSettingsList();
  processAndRenderAll();
}
