/* ==========================================================================
   Previo HUD — Navigation View Swapper
   ========================================================================== */

import { DOM } from './dom.js';
import { setCurrentView } from './state.js';
import { renderDashboardChart, renderLaunchesList, renderAnalysisData, initSimulatorDefaults, playViewEnterOnce } from './render.js';

export function switchView(viewName) {
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
  setCurrentView(viewName);

  if (viewName === 'dashboard') {
    setTimeout(renderDashboardChart, 100);
  } else if (viewName === 'launches') {
    renderLaunchesList();
    playViewEnterOnce('view-launches');
  } else if (viewName === 'analysis') {
    renderAnalysisData();
    playViewEnterOnce('view-analysis');
  } else if (viewName === 'simulator') {
    initSimulatorDefaults();
    playViewEnterOnce('view-simulator');
  }
}
