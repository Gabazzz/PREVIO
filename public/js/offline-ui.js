/* ==========================================================================
   Previo HUD — Offline Banner & Reconnect Sync Orchestration
   ========================================================================== */

import { DOM } from './dom.js';
import { supabase, getCurrentUser } from './supabase-client.js';
import { transactions, setTransactions } from './state.js';
import {
  isOnline, getPendingSyncCount,
  syncPendingOperations, cacheTransactionsLocally
} from './offline.js';
import { processAndRenderAll } from './render.js';

let syncing = false;
let listenersRegistered = false;

export function updateOfflineBanner() {
  const pending = getPendingSyncCount();

  if (!isOnline()) {
    DOM.offlineBanner.style.display = 'flex';
    DOM.offlineBanner.classList.remove('has-pending');
    DOM.offlineBannerText.textContent = pending > 0
      ? `Modo offline — ${pending} alteração${pending > 1 ? 'ões' : ''} será${pending > 1 ? 'o' : ''} sincronizada${pending > 1 ? 's' : ''} quando a conexão voltar.`
      : 'Modo offline — mostrando os últimos dados salvos.';
    return;
  }

  if (pending > 0 || syncing) {
    DOM.offlineBanner.style.display = 'flex';
    DOM.offlineBanner.classList.add('has-pending');
    DOM.offlineBannerText.textContent = syncing
      ? 'Sincronizando alterações...'
      : `${pending} alteração${pending > 1 ? 'ões' : ''} pendente${pending > 1 ? 's' : ''} de sincronização.`;
    return;
  }

  DOM.offlineBanner.style.display = 'none';
}

// Replays the offline queue against Supabase, patches any temp ids in the
// in-memory transaction list with their real server ids, and re-renders.
export async function trySyncNow() {
  if (syncing || !isOnline()) return;
  if (getPendingSyncCount() === 0) { updateOfflineBanner(); return; }

  syncing = true;
  updateOfflineBanner();

  const user = await getCurrentUser();
  if (!user) { syncing = false; updateOfflineBanner(); return; }

  const { idMap } = await syncPendingOperations(supabase, user.id);

  if (idMap.length > 0) {
    const patched = transactions.map(t => {
      const match = idMap.find(m => m.tempId === t.id);
      return match ? { ...t, id: match.realId } : t;
    });
    setTransactions(patched);
  }

  cacheTransactionsLocally(transactions);
  syncing = false;
  updateOfflineBanner();
  processAndRenderAll();
}

export function setupOfflineListeners() {
  if (listenersRegistered) return; // initApp can run more than once (retry, re-login)
  listenersRegistered = true;
  window.addEventListener('online', () => {
    trySyncNow();
  });
  window.addEventListener('offline', () => {
    updateOfflineBanner();
  });
}
