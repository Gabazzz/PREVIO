/* ==========================================================================
   Previo HUD — Event Listener Wiring
   ========================================================================== */

import { DOM } from './dom.js';
import { activePeriodFilter } from './state.js';
import { switchView } from './navigation.js';
import {
  openModal, closeModal, setModalType,
  handleModalSubmit, handleModalDelete
} from './transaction-modal.js';
import { openAISheet } from './ai-entry.js';
import { renderLaunchesList, runSimulation } from './render.js';
import { handleApplyDateFilter } from './date-filter.js';
import { handleHardReset, submitOnboardingData } from './data.js';
import { openSettingsModal } from './settings.js';
import { logout } from './auth.js';

export function setupEventListeners() {
  // Onboarding Step Flow
  DOM.btnStartOnboarding.addEventListener('click', () => {
    DOM.onboardingStep1.style.display = 'none';
    DOM.onboardingStep2.style.display = 'block';
    DOM.inputInitialBalance.focus();
  });

  DOM.btnOnboardingNext2.addEventListener('click', () => {
    const val = parseFloat(DOM.inputInitialBalance.value);
    if (isNaN(val) || val < 0) {
      alert('Por favor, insira um saldo inicial válido.');
      return;
    }
    DOM.onboardingStep2.style.display = 'none';
    DOM.onboardingStep3.style.display = 'block';
    DOM.inputMonthlyIncome.focus();
  });

  DOM.btnOnboardingNext3.addEventListener('click', () => {
    const val = parseFloat(DOM.inputMonthlyIncome.value);
    if (DOM.inputMonthlyIncome.value && (isNaN(val) || val < 0)) {
      alert('Por favor, insira uma renda estimada válida ou pule.');
      return;
    }
    DOM.onboardingStep3.style.display = 'none';
    DOM.onboardingStep4.style.display = 'block';
    DOM.inputMainFixed.focus();
  });

  DOM.btnOnboardingSkip3.addEventListener('click', () => {
    DOM.inputMonthlyIncome.value = '';
    DOM.onboardingStep3.style.display = 'none';
    DOM.onboardingStep4.style.display = 'block';
    DOM.inputMainFixed.focus();
  });

  DOM.btnOnboardingSkip4.addEventListener('click', () => {
    DOM.inputMainFixed.value = '';
    submitOnboardingData();
  });

  DOM.btnSubmitOnboarding.addEventListener('click', () => {
    const val = parseFloat(DOM.inputMainFixed.value);
    if (DOM.inputMainFixed.value && (isNaN(val) || val < 0)) {
      alert('Por favor, insira uma despesa fixa válida ou pule.');
      return;
    }
    submitOnboardingData();
  });

  // Navigation
  DOM.navItems.forEach(item => {
    item.addEventListener('click', () => {
      const view = item.getAttribute('data-view');
      if (view) switchView(view);
    });
  });

  // Quick Shortcuts
  DOM.btnQuickExpense.addEventListener('click', () => openModal('saída'));
  DOM.btnQuickIncome.addEventListener('click', () => openModal('entrada'));
  DOM.btnFabAdd.addEventListener('click', openAISheet);

  // Modal controllers
  DOM.btnModalClose.addEventListener('click', closeModal);

  DOM.toggleOptExpense.addEventListener('click', () => setModalType('saída'));
  DOM.toggleOptIncome.addEventListener('click', () => setModalType('entrada'));

  DOM.btnModalSubmit.addEventListener('click', handleModalSubmit);
  DOM.btnModalDelete.addEventListener('click', handleModalDelete);

  // Filter chips in Launches view
  DOM.filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      DOM.filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      renderLaunchesList();
    });
  });
  DOM.monthSelector.addEventListener('change', renderLaunchesList);

  // Simulator Sliders
  DOM.simSliderBurnrate.addEventListener('input', runSimulation);
  DOM.simSliderIncome.addEventListener('input', runSimulation);

  // Date Filter Modal actions
  DOM.btnDateFilter.addEventListener('click', () => {
    DOM.modalDateFilter.classList.add('active');
  });

  DOM.btnDateFilterClose.addEventListener('click', () => {
    DOM.modalDateFilter.classList.remove('active');
  });

  const periodPills = document.querySelectorAll('.period-pill');
  periodPills.forEach(pill => {
    pill.addEventListener('click', () => {
      periodPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const period = pill.getAttribute('data-period');
      activePeriodFilter.type = period;

      if (period === 'custom') {
        DOM.customDateFields.style.display = 'block';
      } else {
        DOM.customDateFields.style.display = 'none';
      }
    });
  });

  DOM.btnApplyDateFilter.addEventListener('click', handleApplyDateFilter);

  // Analysis tabs setup
  document.querySelectorAll('.analysis-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.analysis-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const target = tab.getAttribute('data-tab');
      document.querySelectorAll('.analysis-tab-content').forEach(c => {
        c.classList.remove('active');
        c.style.display = 'none';
      });

      const content = document.getElementById(`analysis-tab-${target}`);
      if (content) {
        content.classList.add('active');
        content.style.display = 'block';
      }
    });
  });

  // Hard Reset — delete all of the user's transactions on Supabase and restart onboarding
  const btnReset = document.getElementById('btn-reset-data');
  if (btnReset) {
    btnReset.addEventListener('click', handleHardReset);
  }

  // Settings sheet
  DOM.btnOpenSettings.addEventListener('click', openSettingsModal);
  DOM.btnSettingsClose.addEventListener('click', () => {
    DOM.modalSettings.classList.remove('active');
  });
  DOM.btnSettingsLogout.addEventListener('click', () => {
    if (confirm('Deseja sair da sua conta?')) logout();
  });
}
