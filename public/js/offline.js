/* ==========================================================================
   Previo HUD — Offline Support
   ========================================================================== */
// Two jobs:
//  1. Cache the last successfully loaded transaction list in localStorage, so
//     the app can still show the dashboard (read-only data) when there's no
//     network at all.
//  2. Queue mutations (insert/update/delete) made while offline, and replay
//     them against Supabase once the connection comes back — so adding or
//     editing a lançamento while offline isn't lost, it just syncs later.
//
// A transaction created while offline doesn't have a real Supabase id yet,
// so it gets a temporary id (prefixed "local_"). If that same transaction is
// edited or deleted again before it ever syncs, we don't queue a second
// operation against a row that doesn't exist on the server — we just mutate
// the still-pending "insert" operation in place (or drop it, for a delete).

import { STORAGE_KEY } from './constants.js';

const SYNC_QUEUE_KEY = 'previo_sync_queue';
const TEMP_ID_PREFIX = 'local_';

export function isTempId(id) {
  return typeof id === 'string' && id.startsWith(TEMP_ID_PREFIX);
}

export function generateTempId() {
  return `${TEMP_ID_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

// --- Local transaction cache (for offline viewing) --------------------------

export function cacheTransactionsLocally(transactions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (e) {
    // localStorage full or unavailable — offline cache is best-effort only
    console.warn('[offline] Falha ao salvar cache local de transações:', e);
  }
}

export function getLocallyCachedTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}

// --- Sync queue ---------------------------------------------------------

function getSyncQueue() {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function setSyncQueue(queue) {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('[offline] Falha ao salvar fila de sincronização:', e);
  }
}

export function getPendingSyncCount() {
  return getSyncQueue().length;
}

// Queues an insert for a transaction that was created while offline.
// `tempId` is the local id already assigned to the in-memory transaction.
export function queueInsert(tempId, payload) {
  const queue = getSyncQueue();
  queue.push({ type: 'insert', tempId, payload });
  setSyncQueue(queue);
}

// Queues an update for an existing (already-synced) transaction. If the id
// being updated is still a tempId (its insert hasn't synced yet), the change
// is merged into the pending insert instead of creating a new queue entry.
export function queueUpdate(id, payload) {
  const queue = getSyncQueue();
  if (isTempId(id)) {
    const pendingInsert = queue.find(op => op.type === 'insert' && op.tempId === id);
    if (pendingInsert) {
      pendingInsert.payload = { ...pendingInsert.payload, ...payload };
      setSyncQueue(queue);
      return;
    }
  }
  queue.push({ type: 'update', id, payload });
  setSyncQueue(queue);
}

// Queues a delete for an existing transaction. If the id is still a tempId
// (never synced), its pending insert is simply removed from the queue —
// nothing was ever created on the server, so there's nothing to delete there.
export function queueDelete(id) {
  const queue = getSyncQueue();
  if (isTempId(id)) {
    setSyncQueue(queue.filter(op => !(op.type === 'insert' && op.tempId === id)));
    return;
  }
  queue.push({ type: 'delete', id });
  setSyncQueue(queue);
}

// Re-surfaces any still-unsynced "insert" operations as transaction objects.
// Used right after a fresh load from the server: the server obviously won't
// know about transactions created while offline yet, so without this they'd
// vanish from the list until they finish syncing.
export function applyQueuedInsertsToTransactions(baseTransactions) {
  const queue = getSyncQueue();
  const existingIds = new Set(baseTransactions.map(t => t.id));
  const pendingInserts = queue
    .filter(op => op.type === 'insert' && !existingIds.has(op.tempId))
    .map(op => ({ id: op.tempId, ...op.payload }));
  return pendingInserts.length > 0 ? [...baseTransactions, ...pendingInserts] : baseTransactions;
}

// Replays every queued operation against Supabase, in order. Returns the
// list of { tempId, realId } pairs for inserts that synced, so the caller
// can patch the in-memory transactions array with the real server ids.
export async function syncPendingOperations(supabase, userId) {
  const queue = getSyncQueue();
  if (queue.length === 0) return { idMap: [], failed: false };

  const remaining = [];
  const idMap = [];
  let failed = false;

  for (const op of queue) {
    try {
      if (op.type === 'insert') {
        const { data, error } = await supabase
          .from('transactions')
          .insert({ ...op.payload, user_id: userId })
          .select()
          .single();
        if (error || !data) { remaining.push(op); failed = true; continue; }
        idMap.push({ tempId: op.tempId, realId: data.id });
      } else if (op.type === 'update') {
        const { error } = await supabase.from('transactions').update(op.payload).eq('id', op.id);
        if (error) { remaining.push(op); failed = true; }
      } else if (op.type === 'delete') {
        const { error } = await supabase.from('transactions').delete().eq('id', op.id);
        if (error) { remaining.push(op); failed = true; }
      }
    } catch (e) {
      remaining.push(op);
      failed = true;
    }
  }

  setSyncQueue(remaining);
  return { idMap, failed };
}
