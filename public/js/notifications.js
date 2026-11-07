/* ==========================================================================
   Previo HUD — Proactive Radar Alerts
   ==========================================================================
   Honest scope: this uses the browser Notification API (via the service
   worker when available), triggered whenever the app's data is loaded or
   refreshed. It is NOT server push — without a backend holding a push
   subscription and waking the device, there is no way to alert the user
   while the app/PWA is fully closed. What this DOES give: an alert as soon
   as the user reopens the app (or if it's sitting in a background tab) when
   their autonomy dropped sharply or their burn rate accelerated since the
   last time they checked — a real "radar" nudge, just not a closed-app one. */

import { NOTIFICATIONS_ENABLED_KEY, NOTIFICATION_STATE_KEY } from './constants.js';
import { getLocalDateStr } from './utils.js';

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationsEnabled() {
  return notificationsSupported() && localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) === '1' && Notification.permission === 'granted';
}

export async function enableNotifications() {
  if (!notificationsSupported()) {
    return { ok: false, error: 'Seu navegador não suporta notificações.' };
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, error: 'Permissão de notificação negada pelo navegador.' };
  }
  localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, '1');
  return { ok: true };
}

export function disableNotifications() {
  localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, '0');
}

function showNotification(title, body) {
  const options = { body, icon: './icon.svg', badge: './icon.svg', tag: 'previo-radar-alert' };
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) {
        reg.showNotification(title, options);
      } else {
        try { new Notification(title, options); } catch (e) { /* no-op */ }
      }
    }).catch(() => {
      try { new Notification(title, options); } catch (e) { /* no-op */ }
    });
  } else {
    try { new Notification(title, options); } catch (e) { /* no-op */ }
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(NOTIFICATION_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

// Compares the current stats snapshot against the last one checked and
// fires at most one notification per day, to stay useful instead of noisy.
export function checkAndNotify(stats) {
  if (!notificationsEnabled()) return;

  const state = loadState();
  const todayStr = getLocalDateStr();
  if (state.lastCheckDate === todayStr) return;

  const currentDays = isFinite(stats.daysRemaining) ? Math.floor(stats.daysRemaining) : null;
  const lastDays = typeof state.lastDays === 'number' ? state.lastDays : null;

  if (currentDays !== null && lastDays !== null) {
    const drop = lastDays - currentDays;
    if (drop >= 5) {
      showNotification('Seu radar perdeu força', `Sua autonomia caiu de ${lastDays} para ${currentDays} dias desde a última vez que você conferiu.`);
    } else if (lastDays > 7 && currentDays <= 7) {
      showNotification('Zona crítica no radar', `Restam ${currentDays} dias de autonomia — seu radar entrou em zona crítica.`);
    } else if (stats.burnAccelerating) {
      showNotification('Ritmo de gasto acelerou', 'Seu gasto dos últimos 3 dias está bem acima da sua média recente. Vale dar uma olhada.');
    }
  }

  state.lastCheckDate = todayStr;
  state.lastDays = currentDays;
  localStorage.setItem(NOTIFICATION_STATE_KEY, JSON.stringify(state));
}
