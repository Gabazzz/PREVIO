/* ==========================================================================
   Previo HUD — View Renderers (Dashboard, Chart, Launches, Simulator, Analysis)
   ========================================================================== */

import { DOM } from './dom.js';
import { DELTA_STORAGE_KEY } from './constants.js';
import { getLocalDateStr, formatBRL, animateNumber } from './utils.js';
import { stats, runCoreCalculations } from './calculations.js';
import {
  transactions, currentView,
  activeEditId, setActiveEditId,
  activeSwipedItem, setActiveSwipedItem
} from './state.js';
import { openModal, handleModalDelete } from './transaction-modal.js';
import { getCategoryColor } from './categories.js';
import { getGoal } from './goals.js';
import { logAutonomySnapshot, getAutonomyHistory } from './autonomy-history.js';
import { checkAndNotify } from './notifications.js';

let chartInstance = null;
let autonomyChartInstance = null;
let touchStartX = 0;

// One-time staggered entrance for a view's cards, played only the first time
// that view is shown in this session (not on every data refresh/switch-back).
const playedEnterViews = new Set();
export function playViewEnterOnce(viewId) {
  if (playedEnterViews.has(viewId)) return;
  playedEnterViews.add(viewId);
  const view = document.getElementById(viewId);
  if (view) view.classList.add('view-enter');
}

// Builds one category row for the Análise bars, with an optional goal badge
// when the user has set a monthly cap for that category (see goals.js). The
// badge's color tracks how close/over the spending is, so it reads as a
// warning before the month's bill does.
function buildCategoryBarItem(cat, val, pctOfTotal, defaultColor) {
  const barItem = document.createElement('div');
  barItem.className = 'insight-bar-item';

  const goal = getGoal(cat);
  let goalBadge = '';
  if (goal) {
    const goalPct = Math.round((val / goal) * 100);
    const status = goalPct >= 100 ? 'critical' : goalPct >= 80 ? 'warning' : 'safe';
    goalBadge = `<span class="insight-bar-goal-badge ${status}">${goalPct}% da meta de ${formatBRL(goal)}</span>`;
  }

  barItem.innerHTML = `
    <div class="insight-bar-info">
      <span class="insight-bar-label">${cat}</span>
      <span class="insight-bar-value">${formatBRL(val)} (${pctOfTotal}%)</span>
    </div>
    <div class="insight-bar-track">
      <div class="insight-bar-fill" data-target-width="${pctOfTotal}" style="background-color: ${getCategoryColor(cat) || defaultColor};"></div>
    </div>
    ${goalBadge}
  `;
  return barItem;
}

// Category bars are built with width:0 (see .insight-bar-fill in app.css) so
// this can set the real width a frame later, letting the CSS transition
// animate the bar growing in instead of just appearing pre-filled.
function growInsightBars(container) {
  const bars = container.querySelectorAll('.insight-bar-fill[data-target-width]');
  requestAnimationFrame(() => {
    bars.forEach(bar => {
      bar.style.width = `${bar.dataset.targetWidth}%`;
    });
  });
}

// 8. View Renderers
export function processAndRenderAll() {
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

  logAutonomySnapshot(stats.daysRemaining);
  checkAndNotify(stats);

  playViewEnterOnce('view-dashboard');

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

export function renderDashboardData() {
  // Update Autonomy Card
  const daysNum = isFinite(stats.daysRemaining) ? Math.floor(stats.daysRemaining) : '∞';
  if (daysNum === '∞') {
    delete DOM.hudDaysNumber.dataset.animValue;
    DOM.hudDaysNumber.innerText = '∞';
  } else {
    animateNumber(DOM.hudDaysNumber, daysNum, (v) => Math.round(v).toString());
  }

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
  DOM.survivalStatusCard.style.setProperty('--shadow-color', stats.zone === 'safe' ? 'rgba(0, 255, 168, 0.25)' : stats.zone === 'attention' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(239, 68, 68, 0.25)');

  // Acceleration alert banner
  if (stats.burnAccelerating) {
    DOM.burnAccelerationAlert.style.display = 'flex';
  } else {
    DOM.burnAccelerationAlert.style.display = 'none';
  }

  // Key Metrics Panel
  animateNumber(DOM.metricBalance, stats.currentBalance, formatBRL);
  animateNumber(DOM.metricFreeBalance, stats.freeBalance, formatBRL);

  // Color code free balance if committed ratio is > 30%
  const commitRatio = stats.currentBalance > 0 ? stats.committedFixed / stats.currentBalance : 0;
  if (commitRatio > 0.3) {
    DOM.metricFreeBalance.className = 'metric-sub-value warning';
  } else {
    DOM.metricFreeBalance.className = 'metric-sub-value safe';
  }

  // Variable burn rate
  animateNumber(DOM.metricBurnrate, stats.burnRate, (v) => `${formatBRL(v)}/dia`);

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

  animateNumber(DOM.ceilingSafeValue, ceilSafe, formatBRL);
  animateNumber(DOM.ceilingBreakevenValue, ceilBreakeven, formatBRL);
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
export function renderDashboardChart() {
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
          borderColor: stats.zone === 'safe' ? '#00ffa8' : stats.zone === 'attention' ? '#f59e0b' : '#ef4444',
          borderDash: [6, 4],
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          // Color code background fill for warning region projection
          backgroundColor: (context) => {
            const value = context.raw;
            if (value !== null && value <= 0) return 'rgba(239, 68, 68, 0.15)';
            return 'rgba(0, 255, 168, 0.05)';
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
export function populateMonthSelector() {
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

export function renderLaunchesList() {
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
        setActiveEditId(t.id);
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
      dot.style.backgroundColor = getCategoryColor(t.category);

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
          setActiveSwipedItem(item);
        } else if (currentTransformX > 45) {
          item.style.transform = 'translateX(60px)';
          setActiveSwipedItem(item);
        } else {
          item.style.transform = '';
          setActiveSwipedItem(null);
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
export function initSimulatorDefaults() {
  DOM.simSliderBurnrate.value = Math.round(stats.burnRate);
  DOM.simSliderBurnrate.max = Math.max(500, Math.round(stats.burnRate * 3));
  DOM.simValBurnrate.innerText = `${formatBRL(stats.burnRate)}/dia`;

  DOM.simSliderIncome.value = 0;
  DOM.simValIncome.innerText = 'R$ 0';

  runSimulation();
}

export function runSimulation() {
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
  if (daysNum === '∞') {
    delete DOM.simDaysNumber.dataset.animValue;
    DOM.simDaysNumber.innerText = '∞';
  } else {
    // Short duration here — this number updates live while the person drags a
    // slider, so it should track their finger closely rather than lag behind.
    animateNumber(DOM.simDaysNumber, daysNum, (v) => Math.round(v).toString(), 180);
  }

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

// Mini line chart of stats.daysRemaining logged once per day (see
// autonomy-history.js) — lets the user see whether their autonomy is
// actually trending up or down instead of just its instantaneous value.
function renderAutonomyHistoryChart() {
  const history = getAutonomyHistory();

  if (history.length < 2) {
    if (DOM.analysisAutonomyChart) DOM.analysisAutonomyChart.style.display = 'none';
    if (DOM.analysisAutonomyHistoryEmpty) DOM.analysisAutonomyHistoryEmpty.style.display = 'block';
    return;
  }

  if (DOM.analysisAutonomyChart) DOM.analysisAutonomyChart.style.display = 'block';
  if (DOM.analysisAutonomyHistoryEmpty) DOM.analysisAutonomyHistoryEmpty.style.display = 'none';

  const labels = history.map(h => {
    const d = new Date(h.date + 'T00:00:00');
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
  });
  const data = history.map(h => h.days);

  if (autonomyChartInstance) autonomyChartInstance.destroy();

  const ctx = DOM.analysisAutonomyChart.getContext('2d');
  autonomyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Dias de autonomia',
        data,
        borderColor: '#00ffa8',
        backgroundColor: 'rgba(0, 255, 168, 0.08)',
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: true,
        tension: 0.25
      }]
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
          backgroundColor: '#080c16',
          titleColor: '#64748b',
          bodyColor: '#f1f5f9',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          callbacks: {
            label: (context) => `${Math.round(context.parsed.y)} dias`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#64748b', font: { family: 'Space Grotesk', size: 8 }, maxTicksLimit: 6 }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.04)', drawBorder: false },
          ticks: { color: '#64748b', font: { family: 'Space Grotesk', size: 8 }, maxTicksLimit: 4 }
        }
      }
    }
  });
}

// 12. Analysis & Insights view renderer (Fixed vs Variable Category Separations)
export function renderAnalysisData() {
  if (currentView !== 'analysis') return;

  renderAutonomyHistoryChart();

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
  animateNumber(DOM.analysisTotalSpent, totalSpent7Days, formatBRL);

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
      DOM.analysisCategoryBarsVariable.appendChild(buildCategoryBarItem(cat, val, pct, '#3b82f6'));
    });
    growInsightBars(DOM.analysisCategoryBarsVariable);
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
      DOM.analysisCategoryBarsFixed.appendChild(buildCategoryBarItem(cat, val, pct, '#8b5cf6'));
    });
    growInsightBars(DOM.analysisCategoryBarsFixed);
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
