/* ==========================================================================
   Previo HUD — Initialization
   ========================================================================== */

import { DOM } from './dom.js';
import { supabase } from './supabase-client.js';
import { transactions } from './state.js';
import { loadData } from './data.js';
import { setupEventListeners } from './events.js';
import { populateMonthSelector, processAndRenderAll } from './render.js';
import { initDateFilterState } from './date-filter.js';

export async function initApp() {
  document.getElementById('screen-reset-password').style.display = 'none';

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    document.getElementById('screen-auth').style.display = 'flex';
    document.getElementById('screen-load-error').style.display = 'none';
    document.querySelector('.phone-viewport').style.display = 'none';
    return;
  }
  document.getElementById('screen-auth').style.display = 'none';

  const loaded = await loadData();
  if (!loaded) {
    // Falha de rede/Supabase: NUNCA tratar como "usuário novo" (mostraria onboarding
    // e arriscaria duplicar o saldo inicial). Mostra tela de erro com retry.
    document.querySelector('.phone-viewport').style.display = 'none';
    document.getElementById('screen-load-error').style.display = 'flex';
    const btnRetry = document.getElementById('btn-retry-load');
    if (btnRetry) btnRetry.onclick = () => {
      document.getElementById('screen-load-error').style.display = 'none';
      initApp();
    };
    return;
  }

  document.getElementById('screen-load-error').style.display = 'none';
  document.querySelector('.phone-viewport').style.display = 'flex';

  setupEventListeners();
  populateMonthSelector();
  initDateFilterState();

  if (transactions.length === 0) {
    DOM.screenOnboarding.style.display = 'flex';
    DOM.onboardingStep1.style.display = 'block';
    DOM.onboardingStep2.style.display = 'none';
    DOM.onboardingStep3.style.display = 'none';
    DOM.onboardingStep4.style.display = 'none';
  } else {
    DOM.screenOnboarding.style.display = 'none';
    processAndRenderAll();
  }
}
