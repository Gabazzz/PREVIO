/* ==========================================================================
   Previo HUD — Entry Point
   Loads every module and boots the app. All of the actual logic now lives
   under ./js/ — this file just wires up the module graph and the two
   pieces of bootstrap that don't belong anywhere else (PWA registration,
   the DOMContentLoaded kickoff).
   ========================================================================== */

// Side-effect import: creates the Supabase client and registers the
// PASSWORD_RECOVERY auth listener.
import './js/supabase-client.js';
import { initApp } from './js/init.js';

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then((reg) => console.log('[Service Worker] Registered successfully', reg.scope))
      .catch((err) => console.warn('[Service Worker] Registration failed', err));
  });
}

// Start App when loaded
window.addEventListener('DOMContentLoaded', initApp);
