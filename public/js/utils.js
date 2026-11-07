/* ==========================================================================
   Previo HUD — Shared Utilities
   ========================================================================== */

// Date helper — returns YYYY-MM-DD for a LOCAL calendar date.
// Using Date#toISOString() for "today"/"ontem" is a bug for any timezone behind UTC
// (like Brazil): toISOString() converts to UTC first, so in the evening the UTC
// date can already be tomorrow even though it's still "today" locally.
export function getLocalDateStr(date = new Date()) {
  const d = new Date(date);
  const offsetMs = d.getTimezoneOffset() * 60 * 1000;
  const localMidnight = new Date(d.getTime() - offsetMs);
  return localMidnight.toISOString().split('T')[0];
}

// Format Currency Utility BRL
export function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

// Animates a number from its previously rendered value up (or down) to
// `targetValue`, writing the interpolated value into `el` on every frame via
// `formatFn`. This is what gives the dashboard's key figures their "counting
// up" feel on load and on every update, instead of a flat text swap.
//
// The element remembers its own last value in a data attribute, so repeated
// calls animate from wherever it last landed — and skip the animation
// entirely when the value hasn't actually changed, so re-renders triggered
// by unrelated UI events don't make numbers flicker/pop for no reason.
const DEFAULT_DURATION = 700;

export function animateNumber(el, targetValue, formatFn, duration = DEFAULT_DURATION) {
  if (!el) return;

  const previous = el.dataset.animValue !== undefined ? parseFloat(el.dataset.animValue) : 0;
  const isFirstRender = el.dataset.animValue === undefined;

  if (!isFirstRender && Math.abs(previous - targetValue) < 0.005) {
    el.textContent = formatFn(targetValue);
    return;
  }

  el.dataset.animValue = String(targetValue);

  // Respect "reduced motion" — jump straight to the final value.
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = formatFn(targetValue);
    return;
  }

  const startValue = isFirstRender ? 0 : previous;
  const startTime = performance.now();

  // Cancel any animation already running on this element before starting a new one.
  if (el._animFrame) cancelAnimationFrame(el._animFrame);

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    const eased = easeOutCubic(progress);
    const current = startValue + (targetValue - startValue) * eased;
    el.textContent = formatFn(current);

    if (progress < 1) {
      el._animFrame = requestAnimationFrame(tick);
    } else {
      el._animFrame = null;
      el.classList.remove('value-pop');
      // eslint-disable-next-line no-unused-expressions
      void el.offsetWidth; // restart the animation even if the class was still present
      el.classList.add('value-pop');
    }
  }

  el._animFrame = requestAnimationFrame(tick);
}
