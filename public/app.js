/* ==========================================================================
   Previo HUD — Core Logic & Interface Bindings
   ========================================================================== */

// Supabase client — initialized from UMD bundle loaded in index.html
const supabase = window.supabase.createClient(
  'https://grjovgjhnmglvtclpwvs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyam92Z2pobm1nbHZ0Y2xwd3ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NTgzMTIsImV4cCI6MjA5NTMzNDMxMn0.ngTL5_rJ0NnCyRBuwKcSylnQBp6kNDFo5-73o5dPat4'
);

// "Esqueci minha senha": when the user clicks the reset link from their email,
// Supabase redirects back here with a recovery session and fires this event —
// we intercept it to show the "set a new password" screen instead of the normal
// dashboard/onboarding flow.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    document.getElementById('screen-auth').style.display = 'none';
    document.getElementById('screen-load-error').style.display = 'none';
    const viewport = document.querySelector('.phone-viewport');
    if (viewport) viewport.style.display = 'none';
    document.getElementById('screen-reset-password').style.display = 'flex';
  }
});

// Date helper — returns YYYY-MM-DD for a LOCAL calendar date.
// Using Date#toISOString() for "today"/"ontem" is a bug for any timezone behind UTC
// (like Brazil): toISOString() converts to UTC first, so in the evening the UTC
// date can already be tomorrow even though it's still "today" locally.
function getLocalDateStr(date = new Date()) {
  const d = new Date(date);
  const offsetMs = d.getTimezoneOffset() * 60 * 1000;
  const localMidnight = new Date(d.getTime() - offsetMs);
  return localMidnight.toISOString().split('T')[0];
}

// 1. PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then((reg) => console.log('[Service Worker] Registered successfully', reg.scope))
      .catch((err) => console.warn('[Service Worker] Registration failed', err));
  });
}

// 2. Application State & Storage Keys
const STORAGE_KEY = 'previo_transactions';
const FILTER_STORAGE_KEY = 'previo_period_filter';
const DELTA_STORAGE_KEY = 'previo_last_days';

let transactions = [];
let currentView = 'dashboard';
let chartInstance = null;

// Global Filter State (retrieved from storage or defaults to month)
let activePeriodFilter = {
  type: 'month',       // 'today' | '7d' | 'month' | 'last_month' | 'custom'
  from: null,          // ISO date string
  to: null             // ISO date string
};

// Modal & Swipe State
let activeEditId = null;
let touchStartX = 0;
let activeSwipedItem = null;

// 3. UI Element Cache
const DOM = {
  screenOnboarding: document.getElementById('screen-onboarding'),
  btnStartOnboarding: document.getElementById('btn-start-onboarding'),
  onboardingStep1: document.getElementById('onboarding-step-1'),
  onboardingStep2: document.getElementById('onboarding-step-2'),
  onboardingStep3: document.getElementById('onboarding-step-3'),
  onboardingStep4: document.getElementById('onboarding-step-4'),
  btnOnboardingNext2: document.getElementById('btn-onboarding-next-2'),
  btnOnboardingNext3: document.getElementById('btn-onboarding-next-3'),
  btnOnboardingSkip3: document.getElementById('btn-onboarding-skip-3'),
  btnOnboardingSkip4: document.getElementById('btn-onboarding-skip-4'),
  btnSubmitOnboarding: document.getElementById('btn-submit-onboarding'),
  inputInitialBalance: document.getElementById('input-initial-balance'),
  inputMonthlyIncome: document.getElementById('input-monthly-income'),
  inputMainFixed: document.getElementById('input-main-fixed'),
  inputMainFixedDesc: document.getElementById('input-main-fixed-desc'),
  
  viewDashboard: document.getElementById('view-dashboard'),
  viewLaunches: document.getElementById('view-launches'),
  viewAnalysis: document.getElementById('view-analysis'),
  viewSimulator: document.getElementById('view-simulator'),
  
  navItems: document.querySelectorAll('.nav-item'),
  btnFabAdd: document.getElementById('btn-fab-add'),
  btnQuickExpense: document.getElementById('btn-quick-expense'),
  btnQuickIncome: document.getElementById('btn-quick-income'),
  
  // Date Filter Elements
  btnDateFilter: document.getElementById('btn-date-filter'),
  dateFilterLabel: document.getElementById('date-filter-label'),
  modalDateFilter: document.getElementById('modal-date-filter'),
  btnDateFilterClose: document.getElementById('btn-date-filter-close'),
  btnApplyDateFilter: document.getElementById('btn-apply-date-filter'),
  filterDateFrom: document.getElementById('filter-date-from'),
  filterDateTo: document.getElementById('filter-date-to'),
  customDateFields: document.getElementById('custom-date-fields'),
  
  // Dashboard indicators
  hudDaysNumber: document.getElementById('hud-days-number'),
  hudZoneText: document.getElementById('hud-zone-text'),
  hudSurvivalDesc: document.getElementById('hud-survival-desc'),
  hudAutonomyBarFill: document.getElementById('hud-autonomy-bar-fill'),
  survivalStatusCard: document.getElementById('survival-status-card'),
  systemStatusDot: document.getElementById('system-status-dot'),
  systemStatusText: document.getElementById('system-status-text'),
  burnAccelerationAlert: document.getElementById('burn-acceleration-alert'),
  
  metricBalance: document.getElementById('metric-balance'),
  metricFreeBalance: document.getElementById('metric-free-balance'),
  metricBurnrate: document.getElementById('metric-burnrate'),
  metricBurnTrend: document.getElementById('metric-burn-trend'),
  metricEnddate: document.getElementById('metric-enddate'),
  metricCollapseDays: document.getElementById('metric-collapse-days'),
  
  // Daily Ceiling elements
  dailyCeilingCard: document.getElementById('daily-ceiling-card'),
  dailyCeilingBadge: document.getElementById('daily-ceiling-badge'),
  ceilingSafeValue: document.getElementById('ceiling-safe-value'),
  ceilingBreakevenValue: document.getElementById('ceiling-breakeven-value'),
  ceilingSubtext: document.getElementById('ceiling-subtext'),
  
  // Launches list
  launchesContainer: document.getElementById('launches-grouped-container'),
  monthSelector: document.getElementById('month-selector'),
  filterChips: document.querySelectorAll('.filter-chip'),
  
  // Modal Sheet
  modalTransaction: document.getElementById('modal-transaction'),
  modalTitle: document.getElementById('modal-title'),
  btnModalClose: document.getElementById('btn-modal-close'),
  btnModalSubmit: document.getElementById('btn-modal-submit'),
  btnModalDelete: document.getElementById('btn-modal-delete'),
  toggleOptExpense: document.getElementById('toggle-opt-expense'),
  toggleOptIncome: document.getElementById('toggle-opt-income'),
  modalInputValue: document.getElementById('modal-input-value'),
  modalInputDesc: document.getElementById('modal-input-desc'),
  modalInputDate: document.getElementById('modal-input-date'),
  modalInputRecurring: document.getElementById('modal-input-recurring'),
  categoryChipsList: document.getElementById('category-chips-list'),
  
  // Simulator
  simDaysNumber: document.getElementById('sim-days-number'),
  simZoneText: document.getElementById('sim-zone-text'),
  simAutonomyBarFill: document.getElementById('sim-autonomy-bar-fill'),
  simStatusCard: document.getElementById('sim-status-card'),
  simSliderBurnrate: document.getElementById('sim-slider-burnrate'),
  simSliderIncome: document.getElementById('sim-slider-income'),
  simValBurnrate: document.getElementById('sim-val-burnrate'),
  simValIncome: document.getElementById('sim-val-income'),
  simFeedbackBox: document.getElementById('sim-feedback-box'),
  
  // Analysis
  analysisTotalSpent: document.getElementById('analysis-total-spent'),
  analysisMonthComparison: document.getElementById('analysis-month-comparison'),
  analysisCategoryBarsVariable: document.getElementById('analysis-category-bars-variable'),
  analysisCategoryBarsFixed: document.getElementById('analysis-category-bars-fixed'),
  analysisHabitCard: document.getElementById('analysis-habit-card'),
  analysisHabitText: document.getElementById('analysis-habit-text'),
  analysisSmartRecommendation: document.getElementById('analysis-smart-recommendation'),

  // Settings
  btnOpenSettings: document.getElementById('btn-open-settings'),
  modalSettings: document.getElementById('modal-settings'),
  btnSettingsClose: document.getElementById('btn-settings-close'),
  btnSettingsLogout: document.getElementById('btn-settings-logout'),
  settingsAccountEmail: document.getElementById('settings-account-email'),
  settingsRecurringList: document.getElementById('settings-recurring-list')
};

// Available Categories
const CATEGORIES = {
  saída: ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Outros'],
  entrada: ['Saldo Inicial', 'Salário', 'Freela', 'Rendimentos', 'Outros']
};

const CATEGORY_COLORS = {
  'Alimentação': '#f59e0b',
  'Transporte': '#3b82f6',
  'Moradia': '#8b5cf6',
  'Saúde': '#ef4444',
  'Lazer': '#ec4899',
  'Saldo Inicial': '#10d98c',
  'Salário': '#10d98c',
  'Freela': '#3b82f6',
  'Rendimentos': '#10d98c',
  'Outros': '#64748b'
};

// 4. Initialization
async function initApp() {
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

// Load from Supabase. Returns true on success, false on failure — callers must
// NEVER treat "false" the same as "zero transactions" (that would misfire onboarding
// and risk duplicating the user's initial balance on a flaky connection).
async function loadData() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const savedFilter = localStorage.getItem(FILTER_STORAGE_KEY);
  if (savedFilter) {
    try { activePeriodFilter = JSON.parse(savedFilter); } catch (e) { /* ignore corrupt value */ }
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

  transactions = data.map(t => ({
    id: t.id,
    date: t.date,
    type: t.type,
    category: t.category,
    description: t.description,
    value: t.value,
    recurring: t.recurring
  }));

  await generateDueRecurringOccurrences();

  return true;
}

// Save to Supabase (no-op — saves done per operation)
async function saveData() {
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

function initDateFilterState() {
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

// Setup Event Listeners
function setupEventListeners() {
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

async function handleHardReset() {
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

function handleApplyDateFilter() {
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

async function submitOnboardingData() {
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
  if (!error && data) transactions = data.map(t => ({ id: t.id, date: t.date, type: t.type, category: t.category, description: t.description, value: t.value, recurring: t.recurring }));

  populateMonthSelector();
  DOM.screenOnboarding.style.opacity = '0';
  setTimeout(() => { DOM.screenOnboarding.style.display = 'none'; processAndRenderAll(); }, 300);
}

// 5. Navigation View Swapper
function switchView(viewName) {
  DOM.navItems.forEach(item => {
    if (item.getAttribute('data-view') === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  const activeView = document.querySelector('.view.active');
  const targetView = document.getElementById(`view-${viewName}`);
  
  if (activeView && activeView !== targetView) {
    activeView.classList.remove('active');
  }
  
  targetView.classList.add('active');
  currentView = viewName;
  
  if (viewName === 'dashboard') {
    setTimeout(renderDashboardChart, 100);
  } else if (viewName === 'launches') {
    renderLaunchesList();
  } else if (viewName === 'analysis') {
    renderAnalysisData();
  } else if (viewName === 'simulator') {
    initSimulatorDefaults();
  }
}

// 6. Modal bottom sheet logic
let selectedCategory = '';

function openModal(type = 'saída', editId = null) {
  activeEditId = editId;
  DOM.modalInputValue.value = '';
  DOM.modalInputDesc.value = '';
  DOM.modalInputRecurring.checked = false;
  
  DOM.modalInputDate.value = getLocalDateStr();
  
  if (editId) {
    const tx = transactions.find(t => t.id === editId);
    if (tx) {
      DOM.modalTitle.innerText = 'Editar Lançamento';
      setModalType(tx.type);
      DOM.modalInputValue.value = tx.value;
      DOM.modalInputDesc.value = tx.description;
      DOM.modalInputDate.value = tx.date;
      DOM.modalInputRecurring.checked = tx.recurring || false;
      selectedCategory = tx.category;
      highlightSelectedCategoryChip();
      DOM.btnModalDelete.style.display = 'block';
    }
  } else {
    DOM.modalTitle.innerText = 'Registrar Lançamento';
    setModalType(type);
    DOM.btnModalDelete.style.display = 'none';
  }
  
  DOM.modalTransaction.classList.add('active');
}

function closeModal() {
  DOM.modalTransaction.classList.remove('active');
  activeEditId = null;
  
  if (activeSwipedItem) {
    activeSwipedItem.style.transform = '';
    activeSwipedItem = null;
  }
}

function setModalType(type) {
  if (type === 'saída') {
    DOM.toggleOptExpense.classList.add('active');
    DOM.toggleOptIncome.classList.remove('active');
  } else {
    DOM.toggleOptExpense.classList.remove('active');
    DOM.toggleOptIncome.classList.add('active');
  }
  
  DOM.categoryChipsList.innerHTML = '';
  const list = CATEGORIES[type];
  list.forEach((cat, index) => {
    const chip = document.createElement('div');
    chip.className = `chip ${index === 0 && !activeEditId ? 'active' : ''}`;
    chip.innerText = cat;
    chip.addEventListener('click', () => {
      document.querySelectorAll('#category-chips-list .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedCategory = cat;
    });
    DOM.categoryChipsList.appendChild(chip);
  });
  
  if (!activeEditId) {
    selectedCategory = list[0];
  }
}

function highlightSelectedCategoryChip() {
  const chips = document.querySelectorAll('#category-chips-list .chip');
  chips.forEach(chip => {
    if (chip.innerText === selectedCategory) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });
}

async function handleModalSubmit() {
  const val = parseFloat(DOM.modalInputValue.value);
  const type = DOM.toggleOptExpense.classList.contains('active') ? 'saída' : 'entrada';
  const desc = DOM.modalInputDesc.value.trim();
  const date = DOM.modalInputDate.value;
  const recurring = DOM.modalInputRecurring.checked;

  if (isNaN(val) || val <= 0) { alert('Por favor, insira um valor válido maior que zero.'); return; }
  if (!date) { alert('Por favor, insira uma data válida.'); return; }

  const { data: { user } } = await supabase.auth.getUser();

  if (activeEditId) {
    const { error } = await supabase.from('transactions').update({
      type, value: val, category: selectedCategory,
      description: desc || selectedCategory, date, recurring
    }).eq('id', activeEditId);
    if (!error) {
      const index = transactions.findIndex(t => t.id === activeEditId);
      if (index !== -1) transactions[index] = { ...transactions[index], type, value: val, category: selectedCategory, description: desc || selectedCategory, date, recurring };
    }
  } else {
    const { data, error } = await supabase.from('transactions').insert({
      user_id: user.id, type, value: val, category: selectedCategory,
      description: desc || selectedCategory, date, recurring
    }).select().single();
    if (!error && data) transactions.push({ id: data.id, date: data.date, type: data.type, category: data.category, description: data.description, value: data.value, recurring: data.recurring });
  }

  processAndRenderAll();
  closeModal();
}

async function handleModalDelete() {
  if (activeEditId) {
    if (confirm('Tem certeza que deseja excluir este lançamento?')) {
      await supabase.from('transactions').delete().eq('id', activeEditId);
      transactions = transactions.filter(t => t.id !== activeEditId);
      processAndRenderAll();
      closeModal();
    }
  }
}

// 7. Core Calculations & Calculations Engine (v2 Evolutions)
let stats = {
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
function getFilterDateRange() {
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

function runCoreCalculations() {
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

// 8. View Renderers
function processAndRenderAll() {
  if (transactions.length === 0) {
    DOM.screenOnboarding.style.display = 'flex';
    DOM.screenOnboarding.style.opacity = '1';
    DOM.onboardingStep1.style.display = 'block';
    DOM.onboardingStep2.style.display = 'none';
    DOM.onboardingStep3.style.display = 'none';
    DOM.onboardingStep4.style.display = 'none';
    DOM.inputInitialBalance.value = '';
    DOM.inputMonthlyIncome.value = '';
    DOM.inputMainFixed.value = '';
    DOM.inputMainFixedDesc.value = '';
    return;
  }
  DOM.screenOnboarding.style.display = 'none';
  
  runCoreCalculations();
  renderDashboardData();
  renderDashboardChart();
  
  // Update header indicators
  DOM.systemStatusDot.className = `pulse-dot ${stats.zone === 'safe' ? '' : stats.zone === 'attention' ? 'warning' : 'critical'}`;
  
  if (stats.zone === 'safe') {
    DOM.systemStatusText.innerText = 'Radar Estável';
  } else if (stats.zone === 'attention') {
    DOM.systemStatusText.innerText = 'Radar Alerta';
  } else {
    DOM.systemStatusText.innerText = 'CRÍTICO / PERIGO';
  }
}

// Format Currency Utility BRL
function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

function renderDashboardData() {
  // Update Autonomy Card
  const daysNum = isFinite(stats.daysRemaining) ? Math.floor(stats.daysRemaining) : '∞';
  DOM.hudDaysNumber.innerText = daysNum;

  // Delta temporal — comparação com último valor salvo
  const lastDays = parseFloat(localStorage.getItem(DELTA_STORAGE_KEY) || '0');
  const currentDays = isFinite(stats.daysRemaining) ? Math.floor(stats.daysRemaining) : 0;
  const delta = currentDays - Math.floor(lastDays);
  const deltaEl = document.getElementById('hud-days-delta');

  if (deltaEl && lastDays > 0) {
    deltaEl.style.display = 'inline-flex';
    if (delta > 0) {
      deltaEl.textContent = `+${delta}d`;
      deltaEl.className = 'survival-days-delta positive';
    } else if (delta < 0) {
      deltaEl.textContent = `${delta}d`;
      deltaEl.className = 'survival-days-delta negative';
    } else {
      deltaEl.textContent = `=${delta}d`;
      deltaEl.className = 'survival-days-delta neutral';
    }
  }

  // Salvar valor atual para próxima comparação (uma vez por sessão)
  if (!sessionStorage.getItem('delta_saved')) {
    localStorage.setItem(DELTA_STORAGE_KEY, currentDays.toString());
    sessionStorage.setItem('delta_saved', '1');
  }
  
  DOM.survivalStatusCard.className = `hud-card survival-status-card ${stats.zone}`;
  
  let zoneText = 'ZONA SEGURA';
  let zoneDesc = 'Seu padrão de vida está seguro. (Baseado no saldo livre)';
  let barWidth = 100;
  
  if (stats.zone === 'attention') {
    zoneText = 'ZONA DE ATENÇÃO';
    zoneDesc = 'Seu caixa está encolhendo. (Baseado no saldo livre)';
    barWidth = Math.min(100, Math.max(10, (stats.daysRemaining / 15) * 100));
  } else if (stats.zone === 'critical') {
    zoneText = 'ZONA CRÍTICA';
    zoneDesc = 'Risco de colapso de caixa. (Baseado no saldo livre)';
    barWidth = Math.min(100, Math.max(5, (stats.daysRemaining / 7) * 100));
  }
  
  if (daysNum === '∞') {
    zoneText = 'ZONA SEGURA';
    zoneDesc = 'Radar sem queima ativa. Adicione despesas variáveis. (Baseado no saldo livre)';
    barWidth = 100;
  }
  
  DOM.hudZoneText.innerText = zoneText;
  DOM.hudSurvivalDesc.innerText = zoneDesc;
  DOM.hudAutonomyBarFill.style.width = `${barWidth}%`;
  DOM.survivalStatusCard.style.setProperty('--shadow-color', stats.zone === 'safe' ? 'rgba(16, 217, 140, 0.25)' : stats.zone === 'attention' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(239, 68, 68, 0.25)');
  
  // Acceleration alert banner
  if (stats.burnAccelerating) {
    DOM.burnAccelerationAlert.style.display = 'flex';
  } else {
    DOM.burnAccelerationAlert.style.display = 'none';
  }

  // Key Metrics Panel
  DOM.metricBalance.innerText = formatBRL(stats.currentBalance);
  DOM.metricFreeBalance.innerText = formatBRL(stats.freeBalance);
  
  // Color code free balance if committed ratio is > 30%
  const commitRatio = stats.currentBalance > 0 ? stats.committedFixed / stats.currentBalance : 0;
  if (commitRatio > 0.3) {
    DOM.metricFreeBalance.className = 'metric-sub-value warning';
  } else {
    DOM.metricFreeBalance.className = 'metric-sub-value safe';
  }

  // Variable burn rate
  DOM.metricBurnrate.innerText = `${formatBRL(stats.burnRate)}/dia`;
  
  // Trend Indicator beside Burn Rate
  if (stats.burnAccelerating) {
    DOM.metricBurnTrend.innerText = '↑ Ritmo acelerou';
    DOM.metricBurnTrend.className = 'burn-trend-indicator accelerating';
  } else if (stats.burnDecelerating) {
    DOM.metricBurnTrend.innerText = '↓ Ritmo caiu';
    DOM.metricBurnTrend.className = 'burn-trend-indicator decelerating';
  } else {
    DOM.metricBurnTrend.innerText = '';
  }

  // Collapse date estimation
  if (stats.projectedCollapse) {
    const options = { day: 'numeric', month: 'short' };
    DOM.metricEnddate.innerText = stats.projectedCollapse.toLocaleDateString('pt-BR', options).replace('.', '');
  } else {
    DOM.metricEnddate.innerText = 'Indefinido';
  }
  
  // Distance to Collapse
  const today = new Date();
  today.setHours(0,0,0,0);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const daysLeftInMonth = lastDayOfMonth.getDate() - today.getDate() + 1;

  if (stats.projectedCollapse) {
    const diffTime = stats.projectedCollapse.getTime() - lastDayOfMonth.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) {
      DOM.metricCollapseDays.innerText = `+${diffDays}d além`;
      DOM.metricCollapseDays.className = 'metric-value metric-change positive';
    } else if (diffDays < 0) {
      DOM.metricCollapseDays.innerText = `${diffDays}d antes`;
      DOM.metricCollapseDays.className = 'metric-value metric-change negative';
    } else {
      DOM.metricCollapseDays.innerText = 'No limite';
      DOM.metricCollapseDays.className = 'metric-value metric-change neutral';
    }
  } else {
    DOM.metricCollapseDays.innerText = 'Estável';
    DOM.metricCollapseDays.className = 'metric-value metric-change positive';
  }

  // Dynamic Daily Ceiling Displays
  const ceilSafe = Math.max(0, stats.dailyCeilingSafe);
  const ceilBreakeven = Math.max(0, stats.dailyCeilingBreakeven);

  DOM.ceilingSafeValue.innerText = formatBRL(ceilSafe);
  DOM.ceilingBreakevenValue.innerText = formatBRL(ceilBreakeven);
  DOM.ceilingSubtext.innerText = `Faltam ${daysLeftInMonth} dias no mês`;
  
  if (stats.freeBalance <= 0) {
    DOM.dailyCeilingBadge.innerText = 'crítico';
    DOM.dailyCeilingBadge.className = 'daily-ceiling-badge warning';
  } else {
    DOM.dailyCeilingBadge.innerText = 'seguro';
    DOM.dailyCeilingBadge.className = 'daily-ceiling-badge';
  }

  // CTA contextual
  const ctaEl = document.getElementById('hud-contextual-cta');
  if (ctaEl && stats.burnRate > 0) {
    const topCatEntry = (() => {
      const catTotals = {};
      const thirtyAgo = new Date();
      thirtyAgo.setDate(thirtyAgo.getDate() - 30);
      transactions.forEach(t => {
        if (t.type === 'saída') {
          const d = new Date(t.date + 'T00:00:00');
          if (d >= thirtyAgo && !t.recurring) {
            catTotals[t.category] = (catTotals[t.category] || 0) + t.value;
          }
        }
      });
      const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
      return sorted[0] || null;
    })();

    if (topCatEntry) {
      const [topCat, topVal] = topCatEntry;
      const saving = topVal * 0.20;
      const addedDays = Math.round(saving / stats.burnRate);
      if (addedDays >= 1) {
        ctaEl.style.display = 'block';
        ctaEl.className = 'contextual-cta';
        ctaEl.innerHTML = `Reduzir <strong>${topCat}</strong> em 20% adicionaria <strong>+${addedDays} dias</strong> de autonomia.`;
      } else {
        ctaEl.style.display = 'none';
      }
    } else {
      ctaEl.style.display = 'none';
    }
  }

} // end renderDashboardData

// 9. Chart.js Drawing Routine
function renderDashboardChart() {
  if (currentView !== 'dashboard') return;
  
  const ctx = document.getElementById('balanceChart').getContext('2d');
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const labels = [];
  const historyData = [];
  const projectionData = [];
  
  // 1. History (7 days back)
  const historicalDates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    historicalDates.push(d);
  }
  
  const sortedTxs = [...transactions].sort((a,b) => new Date(a.date) - new Date(b.date));
  const dailyBalances = {};
  
  historicalDates.forEach(date => {
    const key = getLocalDateStr(date);
    dailyBalances[key] = 0;
  });
  
  let tempBal = stats.currentBalance;
  const reverseHistDates = [...historicalDates].reverse();
  
  reverseHistDates.forEach(date => {
    const key = getLocalDateStr(date);
    dailyBalances[key] = tempBal;
    
    const dayTxs = sortedTxs.filter(t => t.date === key);
    dayTxs.forEach(t => {
      if (t.type === 'entrada') {
        tempBal -= t.value;
      } else if (t.type === 'saída') {
        tempBal += t.value;
      }
    });
  });
  
  historicalDates.forEach(date => {
    const key = getLocalDateStr(date);
    const opts = { day: 'numeric', month: 'short' };
    labels.push(date.toLocaleDateString('pt-BR', opts).replace('.', ''));
    historyData.push(dailyBalances[key]);
    projectionData.push(null);
  });
  
  // Connect history point with projection start
  projectionData[6] = stats.currentBalance;
  
  // 2. Future Projection (30 days forward)
  let endOfMonthIndex = -1;
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  for (let i = 1; i <= 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    
    const opts = { day: 'numeric', month: 'short' };
    labels.push(d.toLocaleDateString('pt-BR', opts).replace('.', ''));
    historyData.push(null);
    
    // Decays based on period variable burnRate
    const projectedVal = stats.currentBalance - (stats.burnRate * i);
    projectionData.push(projectedVal); // Allow drawing negative values to trigger warning zone
    
    if (d.getDate() === lastDayOfMonth.getDate() && d.getMonth() === lastDayOfMonth.getMonth()) {
      endOfMonthIndex = 6 + i;
    }
  }
  
  if (chartInstance) {
    chartInstance.destroy();
  }
  
  // Plugin 1: End of month line
  const endOfMonthPlugin = {
    id: 'endOfMonthLine',
    afterDatasetsDraw(chart) {
      if (endOfMonthIndex === -1) return;
      const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;
      const xPos = x.getPixelForValue(endOfMonthIndex);
      
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.moveTo(xPos, top);
      ctx.lineTo(xPos, bottom);
      ctx.stroke();
      
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 9px "Space Grotesk"';
      ctx.fillText('FIM DO MÊS', xPos + 4, top + 15);
      ctx.restore();
    }
  };

  // Plugin 2: Zero Zone collapse shading
  const zeroLinePlugin = {
    id: 'zeroZone',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea: { left, right, top, bottom }, scales: { y } } = chart;
      const zeroY = y.getPixelForValue(0);

      // Verify that 0 y-coordinate falls within the bounds of the chart area
      if (zeroY >= top && zeroY <= bottom) {
        // Transparent red block from zeroY down to the bottom
        ctx.save();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.05)';
        ctx.fillRect(left, zeroY, right - left, bottom - zeroY);

        // Dashed horizontal warning line at y = 0
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.moveTo(left, zeroY);
        ctx.lineTo(right, zeroY);
        ctx.stroke();

        // Label 'COLAPSO' in monospaced font
        ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.font = '8px "Space Grotesk"';
        ctx.fillText('COLAPSO', left + 4, zeroY - 4);
        ctx.restore();
      }
    }
  };
  
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Saldo Histórico',
          data: historyData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: true,
          tension: 0.1
        },
        {
          label: 'Projeção de Sobrevivência',
          data: projectionData,
          borderColor: stats.zone === 'safe' ? '#10d98c' : stats.zone === 'attention' ? '#f59e0b' : '#ef4444',
          borderDash: [6, 4],
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          // Color code background fill for warning region projection
          backgroundColor: (context) => {
            const value = context.raw;
            if (value !== null && value <= 0) return 'rgba(239, 68, 68, 0.15)';
            return 'rgba(16, 217, 140, 0.05)';
          },
          fill: true,
          tension: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          titleFont: { family: 'Space Grotesk', size: 10 },
          bodyFont: { family: 'Inter', size: 12 },
          backgroundColor: '#0f1729',
          titleColor: '#64748b',
          bodyColor: '#f1f5f9',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              if (context.parsed.y !== null) {
                label += formatBRL(context.parsed.y);
              }
              return label;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#64748b',
            font: { family: 'Space Grotesk', size: 8 },
            maxTicksLimit: 6
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.04)',
            drawBorder: false
          },
          ticks: {
            color: '#64748b',
            font: { family: 'Space Grotesk', size: 8 },
            maxTicksLimit: 4,
            callback: function(value) {
              return 'R$ ' + value;
            }
          }
        }
      }
    },
    plugins: [endOfMonthPlugin, zeroLinePlugin]
  });
}

// 10. Launches View Controller
function populateMonthSelector() {
  DOM.monthSelector.innerHTML = '';
  
  const months = [];
  const today = new Date();
  
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  months.push(currentMonthKey);
  
  transactions.forEach(t => {
    const dateParts = t.date.split('-');
    const key = `${dateParts[0]}-${dateParts[1]}`;
    if (!months.includes(key)) {
      months.push(key);
    }
  });
  
  months.sort((a,b) => b.localeCompare(a));
  
  months.forEach(m => {
    const [year, month] = m.split('-');
    const date = new Date(year, month - 1, 1);
    const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    
    const opt = document.createElement('option');
    opt.value = m;
    opt.innerText = label.charAt(0).toUpperCase() + label.slice(1);
    DOM.monthSelector.appendChild(opt);
  });
  
  DOM.monthSelector.value = currentMonthKey;
}

function renderLaunchesList() {
  if (currentView !== 'launches') return;
  
  const filterType = document.querySelector('.filter-chip.active').getAttribute('data-filter');
  const filterMonth = DOM.monthSelector.value;
  
  DOM.launchesContainer.innerHTML = '';
  
  const filteredTxs = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    
    const tParts = t.date.split('-');
    const tMonth = `${tParts[0]}-${tParts[1]}`;
    if (tMonth !== filterMonth) return false;
    
    return true;
  });
  
  if (filteredTxs.length === 0) {
    DOM.launchesContainer.innerHTML = `
      <div class="empty-state-list">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        <p>Nenhum lançamento encontrado para os filtros selecionados.</p>
      </div>
    `;
    return;
  }
  
  const groups = {};
  filteredTxs.forEach(t => {
    if (!groups[t.date]) {
      groups[t.date] = [];
    }
    groups[t.date].push(t);
  });
  
  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
  
  sortedDates.forEach(dateStr => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'transaction-group';
    
    const header = document.createElement('div');
    header.className = 'group-date';
    
    const todayStr = getLocalDateStr();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateStr(yesterday);
    
    if (dateStr === todayStr) {
      header.innerText = 'Hoje';
    } else if (dateStr === yesterdayStr) {
      header.innerText = 'Ontem';
    } else {
      const parts = dateStr.split('-');
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      header.innerText = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
    }
    groupDiv.appendChild(header);
    
    const listDiv = document.createElement('div');
    listDiv.className = 'transaction-list';
    
    groups[dateStr].forEach(t => {
      const itemWrapper = document.createElement('div');
      itemWrapper.className = 'transaction-item-wrapper';
      
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'transaction-actions';
      
      const editBtn = document.createElement('button');
      editBtn.className = 'action-btn-swipe edit';
      editBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
      editBtn.addEventListener('click', () => openModal(t.type, t.id));
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'action-btn-swipe delete';
      deleteBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;
      deleteBtn.addEventListener('click', () => {
        activeEditId = t.id;
        handleModalDelete();
      });
      
      actionsDiv.appendChild(editBtn);
      actionsDiv.appendChild(deleteBtn);
      
      const item = document.createElement('div');
      item.className = 'transaction-item';
      
      const tLeft = document.createElement('div');
      tLeft.className = 't-left';
      
      const dot = document.createElement('div');
      dot.className = 't-dot';
      dot.style.backgroundColor = CATEGORY_COLORS[t.category] || '#64748b';
      
      const details = document.createElement('div');
      details.className = 't-details';
      
      const title = document.createElement('div');
      title.className = 't-title';
      title.innerText = t.description;
      
      const category = document.createElement('div');
      category.className = 't-category';
      category.innerHTML = `${t.category} ${t.recurring ? '<span class="t-recurring-badge">Recorrente</span>' : ''}`;
      
      details.appendChild(title);
      details.appendChild(category);
      tLeft.appendChild(dot);
      tLeft.appendChild(details);
      
      const value = document.createElement('div');
      value.className = `t-value ${t.type === 'saída' ? 'expense' : 'income'}`;
      value.innerText = `${t.type === 'saída' ? '-' : '+'} ${formatBRL(t.value)}`;
      
      item.appendChild(tLeft);
      item.appendChild(value);
      
      itemWrapper.appendChild(actionsDiv);
      itemWrapper.appendChild(item);
      listDiv.appendChild(itemWrapper);
      
      // Touch Swipes logic
      let currentTransformX = 0;
      
      item.addEventListener('touchstart', (e) => {
        if (activeSwipedItem && activeSwipedItem !== item) {
          activeSwipedItem.style.transform = '';
        }
        touchStartX = e.touches[0].clientX;
        item.style.transition = 'none';
      }, { passive: true });
      
      item.addEventListener('touchmove', (e) => {
        const moveX = e.touches[0].clientX;
        const diffX = moveX - touchStartX;
        
        if (diffX < 0) {
          currentTransformX = Math.max(-80, diffX);
        } else {
          currentTransformX = Math.min(80, diffX);
        }
        item.style.transform = `translateX(${currentTransformX}px)`;
      }, { passive: true });
      
      item.addEventListener('touchend', () => {
        item.style.transition = 'transform 0.2s ease';
        
        if (currentTransformX < -45) {
          item.style.transform = 'translateX(-60px)';
          activeSwipedItem = item;
        } else if (currentTransformX > 45) {
          item.style.transform = 'translateX(60px)';
          activeSwipedItem = item;
        } else {
          item.style.transform = '';
          activeSwipedItem = null;
        }
      });
      
      item.addEventListener('dblclick', () => {
        openModal(t.type, t.id);
      });
    });
    
    groupDiv.appendChild(listDiv);
    DOM.launchesContainer.appendChild(groupDiv);
  });
}

// 11. Simulator Controller
function initSimulatorDefaults() {
  DOM.simSliderBurnrate.value = Math.round(stats.burnRate);
  DOM.simSliderBurnrate.max = Math.max(500, Math.round(stats.burnRate * 3));
  DOM.simValBurnrate.innerText = `${formatBRL(stats.burnRate)}/dia`;
  
  DOM.simSliderIncome.value = 0;
  DOM.simValIncome.innerText = 'R$ 0';
  
  runSimulation();
}

function runSimulation() {
  const simBurnRate = parseFloat(DOM.simSliderBurnrate.value);
  const simIncome = parseFloat(DOM.simSliderIncome.value);
  
  DOM.simValBurnrate.innerText = `${formatBRL(simBurnRate)}/dia`;
  DOM.simValIncome.innerText = formatBRL(simIncome);
  
  // Simulation uses freeBalance (not current balance) as standard autonomy v2 references free balance
  const simBalance = stats.freeBalance + simIncome;
  let simDays = 0;
  
  if (simBurnRate > 0) {
    simDays = Math.max(0, simBalance / simBurnRate);
  } else {
    simDays = simBalance > 0 ? Infinity : 0;
  }
  
  const daysNum = isFinite(simDays) ? Math.floor(simDays) : '∞';
  DOM.simDaysNumber.innerText = daysNum;
  
  let simZone = 'safe';
  if (simDays > 15) {
    simZone = 'safe';
  } else if (simDays > 7) {
    simZone = 'attention';
  } else {
    simZone = 'critical';
  }
  
  DOM.simStatusCard.className = `hud-card survival-status-card ${simZone}`;
  
  let barWidth = 100;
  if (simZone === 'attention') {
    barWidth = Math.min(100, Math.max(10, (simDays / 15) * 100));
  } else if (simZone === 'critical') {
    barWidth = Math.min(100, Math.max(5, (simDays / 7) * 100));
  }
  
  if (daysNum === '∞') {
    barWidth = 100;
    DOM.simZoneText.innerText = 'ZONA SEGURA';
  } else {
    DOM.simZoneText.innerText = simZone === 'safe' ? 'ZONA SEGURA' : simZone === 'attention' ? 'ZONA DE ATENÇÃO' : 'ZONA CRÍTICA';
  }
  
  DOM.simAutonomyBarFill.style.width = `${barWidth}%`;
  
  const currentDaysNum = isFinite(stats.daysRemaining) ? Math.floor(stats.daysRemaining) : '0';
  const displayCurrent = currentDaysNum === '∞' ? 'Infinita' : `${currentDaysNum} dias`;
  const displaySim = daysNum === '∞' ? 'Infinita' : `${daysNum} dias`;
  
  DOM.simFeedbackBox.innerHTML = `Sua autonomia passaria de <strong>${displayCurrent}</strong> para <strong>${displaySim}</strong>.`;
}

// 12. Analysis & Insights view renderer (Fixed vs Variable Category Separations)
function renderAnalysisData() {
  if (currentView !== 'analysis') return;
  
  const today = new Date();
  today.setHours(0,0,0,0);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);
  
  // Calculate total spent in last 7 days (all expenses)
  let totalSpent7Days = 0;
  transactions.forEach(t => {
    if (t.type === 'saída') {
      const txDate = new Date(t.date + 'T00:00:00');
      if (txDate >= sevenDaysAgo && txDate <= today) {
        totalSpent7Days += t.value;
      }
    }
  });
  DOM.analysisTotalSpent.innerText = formatBRL(totalSpent7Days);
  
  // Monthly Comparison (all expenses)
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  
  let currentMonthExpenses = 0;
  let lastMonthExpenses = 0;
  
  transactions.forEach(t => {
    if (t.type === 'saída') {
      const tDate = new Date(t.date + 'T00:00:00');
      if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
        currentMonthExpenses += t.value;
      } else if (tDate.getMonth() === lastMonth && tDate.getFullYear() === lastMonthYear) {
        lastMonthExpenses += t.value;
      }
    }
  });
  
  if (lastMonthExpenses > 0) {
    const diffPct = ((currentMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100;
    const diffStr = diffPct.toFixed(0);
    
    if (diffPct > 0) {
      DOM.analysisMonthComparison.innerText = `+${diffStr}% gastos que mês passado`;
      DOM.analysisMonthComparison.className = 'metric-change negative';
    } else if (diffPct < 0) {
      DOM.analysisMonthComparison.innerText = `${diffStr}% economia que mês passado`;
      DOM.analysisMonthComparison.className = 'metric-change positive';
    } else {
      DOM.analysisMonthComparison.innerText = 'Mesmo volume de gastos';
      DOM.analysisMonthComparison.className = 'metric-change neutral';
    }
  } else {
    DOM.analysisMonthComparison.innerText = 'Dados insuficientes do mês anterior';
    DOM.analysisMonthComparison.className = 'metric-change neutral';
  }
  
  // Category Breakdown (last 30 days) - SPLIT Fixed vs Variable
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 29);
  
  let fixedExpenses = 0;
  let variableExpenses = 0;
  const catTotalsFixed = {};
  const catTotalsVariable = {};
  
  transactions.forEach(t => {
    if (t.type === 'saída') {
      const tDate = new Date(t.date + 'T00:00:00');
      if (tDate >= thirtyDaysAgo && tDate <= today) {
        if (t.recurring) {
          fixedExpenses += t.value;
          catTotalsFixed[t.category] = (catTotalsFixed[t.category] || 0) + t.value;
        } else {
          variableExpenses += t.value;
          catTotalsVariable[t.category] = (catTotalsVariable[t.category] || 0) + t.value;
        }
      }
    }
  });
  
  // Draw Variable category bars
  DOM.analysisCategoryBarsVariable.innerHTML = '';
  if (variableExpenses === 0) {
    DOM.analysisCategoryBarsVariable.innerHTML = '<div class="trend-indicator">Nenhum gasto variável nos últimos 30 dias.</div>';
  } else {
    const sortedVarCats = Object.keys(catTotalsVariable).sort((a,b) => catTotalsVariable[b] - catTotalsVariable[a]);
    sortedVarCats.forEach(cat => {
      const val = catTotalsVariable[cat];
      const pct = ((val / variableExpenses) * 100).toFixed(0);
      
      const barItem = document.createElement('div');
      barItem.className = 'insight-bar-item';
      barItem.innerHTML = `
        <div class="insight-bar-info">
          <span class="insight-bar-label">${cat}</span>
          <span class="insight-bar-value">${formatBRL(val)} (${pct}%)</span>
        </div>
        <div class="insight-bar-track">
          <div class="insight-bar-fill" style="width: ${pct}%; background-color: ${CATEGORY_COLORS[cat] || '#3b82f6'};"></div>
        </div>
      `;
      DOM.analysisCategoryBarsVariable.appendChild(barItem);
    });
  }

  // Draw Fixed category bars
  DOM.analysisCategoryBarsFixed.innerHTML = '';
  if (fixedExpenses === 0) {
    DOM.analysisCategoryBarsFixed.innerHTML = '<div class="trend-indicator">Nenhum gasto fixo nos últimos 30 dias.</div>';
  } else {
    const sortedFixedCats = Object.keys(catTotalsFixed).sort((a,b) => catTotalsFixed[b] - catTotalsFixed[a]);
    sortedFixedCats.forEach(cat => {
      const val = catTotalsFixed[cat];
      const pct = ((val / fixedExpenses) * 100).toFixed(0);
      
      const barItem = document.createElement('div');
      barItem.className = 'insight-bar-item';
      barItem.innerHTML = `
        <div class="insight-bar-info">
          <span class="insight-bar-label">${cat}</span>
          <span class="insight-bar-value">${formatBRL(val)} (${pct}%)</span>
        </div>
        <div class="insight-bar-track">
          <div class="insight-bar-fill" style="width: ${pct}%; background-color: ${CATEGORY_COLORS[cat] || '#8b5cf6'};"></div>
        </div>
      `;
      DOM.analysisCategoryBarsFixed.appendChild(barItem);
    });
  }

  // Calculate top spent category (for habit card) from all expenses in 30 days
  const totalSpent30Days = fixedExpenses + variableExpenses;
  
  if (totalSpent30Days === 0) {
    DOM.analysisHabitCard.style.display = 'none';
    DOM.analysisSmartRecommendation.innerText = 'Registre suas compras rotineiras para ativar os relatórios automáticos.';
    return;
  }
  
  DOM.analysisHabitCard.style.display = 'block';
  
  const allCatTotals = {};
  transactions.forEach(t => {
    if (t.type === 'saída') {
      const tDate = new Date(t.date + 'T00:00:00');
      if (tDate >= thirtyDaysAgo && tDate <= today) {
        allCatTotals[t.category] = (allCatTotals[t.category] || 0) + t.value;
      }
    }
  });
  
  const sortedAllCats = Object.keys(allCatTotals).sort((a,b) => allCatTotals[b] - allCatTotals[a]);
  const topCat = sortedAllCats[0];
  const topCatVal = allCatTotals[topCat];
  const topCatPct = ((topCatVal / totalSpent30Days) * 100).toFixed(0);
  
  DOM.analysisHabitText.innerHTML = `Sua maior fonte de queima de caixa é <strong>${topCat}</strong>, engolindo <strong>${topCatPct}%</strong> de tudo o que você gastou nos últimos 30 dias.`;
  
  const targetSavings = topCatVal * 0.20;
  const currentBurn = stats.burnRate || 1;
  const addedDays = Math.round(targetSavings / currentBurn);
  
  if (addedDays > 0) {
    DOM.analysisSmartRecommendation.innerHTML = `Sua categoria <strong>${topCat}</strong> representa <strong>${topCatPct}%</strong> dos seus gastos. Reduzir em 20% seus custos nessa área pouparia <strong>${formatBRL(targetSavings)}</strong>, adicionando <strong>+${addedDays} dias</strong> de autonomia no seu radar.`;
  } else {
    DOM.analysisSmartRecommendation.innerText = 'Você tem um padrão equilibrado. Evite contrair novos gastos fixos para reter autonomia.';
  }
}

/* ==========================================================================
   Evolução 8 — Entrada por IA / Linguagem Natural
   ========================================================================== */

const aiSheet = {
  overlay:      document.getElementById('modal-ai-entry'),
  input:        document.getElementById('ai-natural-input'),
  btnSubmit:    document.getElementById('btn-ai-submit'),
  btnClose:     document.getElementById('btn-ai-sheet-close'),
  btnManualExp: document.getElementById('btn-ai-manual-expense'),
  btnManualInc: document.getElementById('btn-ai-manual-income'),
  loading:      document.getElementById('ai-loading-state'),
  error:        document.getElementById('ai-error-state'),
};

function openAISheet() {
  aiSheet.input.value = '';
  aiSheet.error.style.display = 'none';
  aiSheet.loading.style.display = 'none';
  aiSheet.btnSubmit.disabled = false;
  aiSheet.overlay.classList.add('active');
  setTimeout(() => aiSheet.input.focus(), 300);
}

function closeAISheet() {
  aiSheet.overlay.classList.remove('active');
}

aiSheet.btnClose.addEventListener('click', closeAISheet);
aiSheet.overlay.addEventListener('click', (e) => {
  if (e.target === aiSheet.overlay) closeAISheet();
});

aiSheet.btnManualExp.addEventListener('click', () => {
  closeAISheet();
  openModal('saída');
});

aiSheet.btnManualInc.addEventListener('click', () => {
  closeAISheet();
  openModal('entrada');
});

aiSheet.input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleAISubmit();
  }
});

aiSheet.btnSubmit.addEventListener('click', handleAISubmit);

async function callClaudeAPI(userText) {
  const today = getLocalDateStr();
  const yesterday = getLocalDateStr(new Date(Date.now() - 86400000));

  const systemPrompt = `Você é um parser financeiro. O usuário vai descrever uma transação financeira em linguagem natural, em português brasileiro informal.

Retorne SOMENTE um objeto JSON válido, sem texto adicional, sem markdown, sem comentários.

Campos obrigatórios:
- type: "saída" ou "entrada"
- value: número decimal (ex: 42.50)
- category: exatamente uma das opções abaixo:
  - Para saída: "Alimentação", "Transporte", "Moradia", "Saúde", "Lazer", "Outros"
  - Para entrada: "Salário", "Freela", "Rendimentos", "Outros"
- description: texto curto descritivo (máx 40 chars)
- date: data no formato YYYY-MM-DD
- recurring: true ou false

Regras de inferência:
- Sem menção de data ou "hoje" → ${today}
- "ontem" → ${yesterday}
- aluguel, internet, streaming, academia → recurring: true
- ifood, uber, mercado, restaurante, farmácia, compras → recurring: false
- "freela", "trabalho extra", "bico" → entrada, Freela
- "salário", "pagamento", "recebi", "caiu" → entrada
- "gastei", "paguei", "comprei", "fui" → saída
- Se valor não identificado → value: 0
- Se não for transação financeira → {"error": "não interpretável"}`;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sessão expirada. Faça login novamente.');

  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: userText }]
    })
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  const raw = data.content.map(b => b.text || '').join('').trim();
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

async function handleAISubmit() {
  const text = aiSheet.input.value.trim();
  if (!text) return;

  aiSheet.loading.style.display = 'flex';
  aiSheet.error.style.display = 'none';
  aiSheet.btnSubmit.disabled = true;

  try {
    const result = await callClaudeAPI(text);
    aiSheet.loading.style.display = 'none';

    if (result.error || !result.type || result.value === undefined) {
      aiSheet.error.style.display = 'block';
      aiSheet.btnSubmit.disabled = false;
      return;
    }

    closeAISheet();

    setTimeout(() => {
      openModal(result.type);

      DOM.modalInputValue.value = result.value;
      DOM.modalInputDesc.value  = result.description || '';
      DOM.modalInputDate.value  = result.date || getLocalDateStr();
      DOM.modalInputRecurring.checked = !!result.recurring;

      if (result.category) {
        const chips = DOM.categoryChipsList.querySelectorAll('.chip');
        chips.forEach(chip => {
          if (chip.textContent.trim() === result.category) chip.click();
        });
      }
    }, 280);

  } catch (err) {
    console.error('[AI Entry] Erro:', err);
    aiSheet.loading.style.display = 'none';
    aiSheet.error.style.display = 'block';
    aiSheet.btnSubmit.disabled = false;
  }
}

// Auth functions
let currentAuthMode = 'login';

window.showTab = function(tab) {
  currentAuthMode = tab;
  document.getElementById('tab-login').style.background = tab === 'login' ? '#10d98c' : 'transparent';
  document.getElementById('tab-login').style.color = tab === 'login' ? '#020617' : '#64748b';
  document.getElementById('tab-signup').style.background = tab === 'signup' ? '#10d98c' : 'transparent';
  document.getElementById('tab-signup').style.color = tab === 'signup' ? '#020617' : '#64748b';
  document.getElementById('btn-auth-submit').innerText = tab === 'login' ? 'ENTRAR' : 'CRIAR CONTA';
  document.getElementById('link-forgot-password').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('auth-error').style.display = 'none';
  document.getElementById('auth-success').style.display = 'none';
};

// Switches the auth screen into "esqueci minha senha" mode: hides the password
// field and tabs, repurposes the same submit button to send the reset email.
window.showForgotPasswordMode = function() {
  currentAuthMode = 'forgot';
  document.getElementById('auth-tabs').style.display = 'none';
  document.getElementById('auth-password').style.display = 'none';
  document.getElementById('link-forgot-password').style.display = 'none';
  document.getElementById('link-back-to-login').style.display = 'block';
  document.getElementById('btn-auth-submit').innerText = 'ENVIAR LINK DE REDEFINIÇÃO';
  document.getElementById('auth-error').style.display = 'none';
  document.getElementById('auth-success').style.display = 'none';
};

window.backToLogin = function() {
  document.getElementById('auth-tabs').style.display = 'flex';
  document.getElementById('auth-password').style.display = 'block';
  document.getElementById('link-back-to-login').style.display = 'none';
  document.getElementById('auth-error').style.display = 'none';
  document.getElementById('auth-success').style.display = 'none';
  showTab('login');
};

window.handleAuth = async function() {
  const email = document.getElementById('auth-email').value.trim();
  const errorEl = document.getElementById('auth-error');
  const successEl = document.getElementById('auth-success');
  const btn = document.getElementById('btn-auth-submit');

  errorEl.style.display = 'none';
  successEl.style.display = 'none';

  if (currentAuthMode === 'forgot') {
    if (!email) { errorEl.innerText = 'Informe seu e-mail.'; errorEl.style.display = 'block'; return; }

    btn.disabled = true;
    btn.innerText = 'Enviando...';

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });

    btn.disabled = false;
    btn.innerText = 'ENVIAR LINK DE REDEFINIÇÃO';

    if (error) {
      errorEl.innerText = error.message;
      errorEl.style.display = 'block';
    } else {
      successEl.innerText = 'Link enviado! Confira seu e-mail (e a caixa de spam) para redefinir a senha.';
      successEl.style.display = 'block';
    }
    return;
  }

  const password = document.getElementById('auth-password').value;
  if (!email || !password) { errorEl.innerText = 'Preencha email e senha.'; errorEl.style.display = 'block'; return; }

  btn.disabled = true;
  btn.innerText = 'Aguarde...';

  let result;
  if (currentAuthMode === 'login') {
    result = await supabase.auth.signInWithPassword({ email, password });
  } else {
    result = await supabase.auth.signUp({ email, password });
  }

  if (result.error) {
    errorEl.innerText = result.error.message;
    errorEl.style.display = 'block';
    btn.disabled = false;
    btn.innerText = currentAuthMode === 'login' ? 'ENTRAR' : 'CRIAR CONTA';
  } else {
    initApp();
  }
};

window.handleSetNewPassword = async function() {
  const newPass = document.getElementById('reset-password-new').value;
  const confirmPass = document.getElementById('reset-password-confirm').value;
  const errorEl = document.getElementById('reset-password-error');
  const btn = document.getElementById('btn-reset-password-submit');

  errorEl.style.display = 'none';

  if (!newPass || newPass.length < 6) {
    errorEl.innerText = 'A senha deve ter pelo menos 6 caracteres.';
    errorEl.style.display = 'block';
    return;
  }
  if (newPass !== confirmPass) {
    errorEl.innerText = 'As senhas não coincidem.';
    errorEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.innerText = 'Salvando...';

  const { error } = await supabase.auth.updateUser({ password: newPass });

  if (error) {
    errorEl.innerText = error.message;
    errorEl.style.display = 'block';
    btn.disabled = false;
    btn.innerText = 'SALVAR NOVA SENHA';
    return;
  }

  document.getElementById('screen-reset-password').style.display = 'none';
  initApp();
};

window.logout = async function() {
  await supabase.auth.signOut();
  location.reload();
};

/* ==========================================================================
   Configurações — Gerenciamento de Lançamentos Recorrentes
   ========================================================================== */

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

async function openSettingsModal() {
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

  transactions = transactions.map(t => {
    if (t.type === type && t.category === category && t.description === desc) {
      return { ...t, recurring: false };
    }
    return t;
  });

  renderRecurringSettingsList();
  processAndRenderAll();
}

// Start App when loaded
window.addEventListener('DOMContentLoaded', initApp);
