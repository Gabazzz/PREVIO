/* ==========================================================================
   Configurações — Gerenciamento de Lançamentos Recorrentes
   ========================================================================== */

import { DOM } from './dom.js';
import { supabase, getCurrentUser } from './supabase-client.js';
import { transactions, setTransactions } from './state.js';
import { formatBRL } from './utils.js';
import { openModal } from './transaction-modal.js';
import { processAndRenderAll } from './render.js';
import { isOnline, queueUpdate, cacheTransactionsLocally } from './offline.js';
import { updateOfflineBanner } from './offline-ui.js';
import { getCategories, getCustomCategories, addCustomCategory, removeCustomCategory } from './categories.js';
import { getGoals, setGoal } from './goals.js';
import { notificationsEnabled, enableNotifications, disableNotifications } from './notifications.js';

let activeCategoryManagementType = 'saída';

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
  const user = await getCurrentUser();
  DOM.settingsAccountEmail.innerText = user ? user.email : '';
  renderRecurringSettingsList();
  setCategoryManagementType('saída');
  renderGoalsList();
  renderNotificationsToggle();
  DOM.modalSettings.classList.add('active');
}

// Custom Categories Management
// -----------------------------------------------------------------------------
export function setCategoryManagementType(type) {
  activeCategoryManagementType = type;
  DOM.settingsCatTypeSaida.classList.toggle('active', type === 'saída');
  DOM.settingsCatTypeEntrada.classList.toggle('active', type === 'entrada');
  renderCustomCategoriesList();
}

export function renderCustomCategoriesList() {
  DOM.settingsCustomCategoriesList.innerHTML = '';
  const custom = getCustomCategories()[activeCategoryManagementType];

  if (custom.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'settings-recurring-empty';
    empty.innerText = 'Nenhuma categoria personalizada ainda.';
    DOM.settingsCustomCategoriesList.appendChild(empty);
    return;
  }

  custom.forEach(({ name, color }) => {
    const item = document.createElement('div');
    item.className = 'settings-recurring-item';

    const info = document.createElement('div');
    info.className = 'settings-recurring-info settings-category-info';

    const dot = document.createElement('span');
    dot.className = 'settings-category-dot';
    dot.style.backgroundColor = color;

    const desc = document.createElement('div');
    desc.className = 'settings-recurring-desc';
    desc.textContent = name;

    info.appendChild(dot);
    info.appendChild(desc);

    const actions = document.createElement('div');
    actions.className = 'settings-recurring-actions';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-stop-recurring';
    removeBtn.setAttribute('aria-label', 'Remover categoria');
    removeBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;
    removeBtn.addEventListener('click', () => {
      if (confirm(`Remover a categoria "${name}"? Lançamentos antigos nela continuam no histórico.`)) {
        removeCustomCategory(activeCategoryManagementType, name);
        renderCustomCategoriesList();
        renderGoalsList();
      }
    });

    actions.appendChild(removeBtn);
    item.appendChild(info);
    item.appendChild(actions);
    DOM.settingsCustomCategoriesList.appendChild(item);
  });
}

export function handleAddCategory() {
  const result = addCustomCategory(activeCategoryManagementType, DOM.settingsNewCategoryInput.value);
  if (!result.ok) {
    alert(result.error);
    return;
  }
  DOM.settingsNewCategoryInput.value = '';
  renderCustomCategoriesList();
  if (activeCategoryManagementType === 'saída') renderGoalsList();
}

// Category Budget Goals
// -----------------------------------------------------------------------------
export function renderGoalsList() {
  DOM.settingsGoalsList.innerHTML = '';
  const expenseCategories = getCategories('saída');
  const goals = getGoals();

  expenseCategories.forEach(cat => {
    const item = document.createElement('div');
    item.className = 'settings-recurring-item settings-goal-item';

    const info = document.createElement('div');
    info.className = 'settings-recurring-info';

    const desc = document.createElement('div');
    desc.className = 'settings-recurring-desc';
    desc.textContent = cat;
    info.appendChild(desc);

    const inputWrap = document.createElement('div');
    inputWrap.className = 'settings-goal-input-wrap';

    const prefix = document.createElement('span');
    prefix.className = 'settings-goal-prefix';
    prefix.textContent = 'R$';

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'hud-input settings-goal-input';
    input.placeholder = '0,00';
    input.min = '0';
    input.step = '0.01';
    if (typeof goals[cat] === 'number') input.value = goals[cat];

    input.addEventListener('change', () => setGoal(cat, input.value));

    inputWrap.appendChild(prefix);
    inputWrap.appendChild(input);

    item.appendChild(info);
    item.appendChild(inputWrap);
    DOM.settingsGoalsList.appendChild(item);
  });
}

// Proactive Notifications
// -----------------------------------------------------------------------------
export function renderNotificationsToggle() {
  const enabled = notificationsEnabled();
  DOM.settingsNotificationsToggle.checked = enabled;
  DOM.settingsNotificationsStatus.textContent = enabled ? 'Ativado' : 'Desativado';
}

export async function handleNotificationsToggle() {
  if (DOM.settingsNotificationsToggle.checked) {
    const result = await enableNotifications();
    if (!result.ok) {
      alert(result.error);
      DOM.settingsNotificationsToggle.checked = false;
      return;
    }
  } else {
    disableNotifications();
  }
  renderNotificationsToggle();
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
  const matchingIds = transactions
    .filter(t => t.type === type && t.category === category && t.description === desc)
    .map(t => t.id);

  if (isOnline()) {
    const user = await getCurrentUser();
    if (!user) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .update({ recurring: false })
        .eq('user_id', user.id)
        .eq('type', type)
        .eq('category', category)
        .eq('description', desc);
      if (error) throw error;
    } catch (e) {
      console.error('[stopRecurringSeries] Falha ao atualizar online, salvando para sincronizar depois:', e);
      matchingIds.forEach(id => queueUpdate(id, { recurring: false }));
    }
  } else {
    // queueUpdate() already merges into a still-pending insert when the id
    // is a tempId, so this works whether each row has synced yet or not.
    matchingIds.forEach(id => queueUpdate(id, { recurring: false }));
  }

  setTransactions(transactions.map(t => {
    if (t.type === type && t.category === category && t.description === desc) {
      return { ...t, recurring: false };
    }
    return t;
  }));

  cacheTransactionsLocally(transactions);
  updateOfflineBanner();
  renderRecurringSettingsList();
  processAndRenderAll();
}
