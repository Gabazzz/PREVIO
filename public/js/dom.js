/* ==========================================================================
   Previo HUD — UI Element Cache
   ========================================================================== */

export const DOM = {
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
  modalPartusWrapper: document.getElementById('modal-partus-wrapper'),
  modalInputPartus: document.getElementById('modal-input-partus'),

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
  analysisMonthCarryoverRow: document.getElementById('analysis-month-carryover-row'),
  analysisMonthCarryoverLabel: document.getElementById('analysis-month-carryover-label'),
  analysisMonthCarryover: document.getElementById('analysis-month-carryover'),
  analysisCategoryBarsVariable: document.getElementById('analysis-category-bars-variable'),
  analysisCategoryBarsFixed: document.getElementById('analysis-category-bars-fixed'),
  analysisHabitCard: document.getElementById('analysis-habit-card'),
  analysisHabitText: document.getElementById('analysis-habit-text'),
  analysisSmartRecommendation: document.getElementById('analysis-smart-recommendation'),

  // Offline banner
  offlineBanner: document.getElementById('offline-banner'),
  offlineBannerText: document.getElementById('offline-banner-text'),

  // Settings
  btnOpenSettings: document.getElementById('btn-open-settings'),
  modalSettings: document.getElementById('modal-settings'),
  btnSettingsClose: document.getElementById('btn-settings-close'),
  btnSettingsLogout: document.getElementById('btn-settings-logout'),
  settingsAccountEmail: document.getElementById('settings-account-email'),
  settingsRecurringList: document.getElementById('settings-recurring-list'),

  // Settings — custom categories
  settingsCatTypeSaida: document.getElementById('settings-cat-type-saida'),
  settingsCatTypeEntrada: document.getElementById('settings-cat-type-entrada'),
  settingsNewCategoryInput: document.getElementById('settings-new-category-input'),
  btnAddCategory: document.getElementById('btn-add-category'),
  settingsCustomCategoriesList: document.getElementById('settings-custom-categories-list'),

  // Settings — category goals
  settingsGoalsList: document.getElementById('settings-goals-list'),

  // Settings — notifications
  settingsNotificationsToggle: document.getElementById('settings-notifications-toggle'),
  settingsNotificationsStatus: document.getElementById('settings-notifications-status'),

  // Analysis — autonomy history chart
  analysisAutonomyChart: document.getElementById('analysis-autonomy-chart'),
  analysisAutonomyHistoryEmpty: document.getElementById('analysis-autonomy-history-empty')
};
