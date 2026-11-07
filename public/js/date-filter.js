/* ==========================================================================
   Previo HUD — Date Filter (period pills / custom range) UI logic
   ========================================================================== */

import { DOM } from './dom.js';
import { FILTER_STORAGE_KEY } from './constants.js';
import { activePeriodFilter } from './state.js';
import { processAndRenderAll } from './render.js';

export function initDateFilterState() {
  // Update UI Pills and Labels
  const pills = document.querySelectorAll('.period-pill');
  pills.forEach(p => {
    if (p.getAttribute('data-period') === activePeriodFilter.type) {
      p.classList.add('active');
    } else {
      p.classList.remove('active');
    }
  });

  if (activePeriodFilter.type === 'custom') {
    DOM.customDateFields.style.display = 'block';
    DOM.filterDateFrom.value = activePeriodFilter.from || '';
    DOM.filterDateTo.value = activePeriodFilter.to || '';
  } else {
    DOM.customDateFields.style.display = 'none';
  }

  updateDateFilterLabelText();
}

function updateDateFilterLabelText() {
  let label = 'Este mês';
  if (activePeriodFilter.type === 'today') {
    label = 'Hoje';
  } else if (activePeriodFilter.type === '7d') {
    label = '7 dias';
  } else if (activePeriodFilter.type === 'month') {
    label = 'Este mês';
  } else if (activePeriodFilter.type === 'last_month') {
    label = 'Mês anterior';
  } else if (activePeriodFilter.type === 'custom') {
    if (activePeriodFilter.from && activePeriodFilter.to) {
      const fromDate = new Date(activePeriodFilter.from + 'T00:00:00');
      const toDate = new Date(activePeriodFilter.to + 'T00:00:00');
      const options = { day: 'numeric', month: 'short' };
      const fromStr = fromDate.toLocaleDateString('pt-BR', options).replace('.', '');
      const toStr = toDate.toLocaleDateString('pt-BR', options).replace('.', '');
      label = `${fromStr} → ${toStr}`;
    } else {
      label = 'Customizado';
    }
  }
  DOM.dateFilterLabel.innerText = label;
}

export function handleApplyDateFilter() {
  if (activePeriodFilter.type === 'custom') {
    const fromVal = DOM.filterDateFrom.value;
    const toVal = DOM.filterDateTo.value;
    if (!fromVal || !toVal) {
      alert('Por favor, defina o intervalo de datas completo.');
      return;
    }
    activePeriodFilter.from = fromVal;
    activePeriodFilter.to = toVal;
  } else {
    activePeriodFilter.from = null;
    activePeriodFilter.to = null;
  }

  localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(activePeriodFilter));
  updateDateFilterLabelText();
  DOM.modalDateFilter.classList.remove('active');
  processAndRenderAll();
}
