/* ==========================================================================
   Previo HUD — Supabase Client & Password-Recovery Listener
   ========================================================================== */

// Supabase client — initialized from UMD bundle loaded in index.html
export const supabase = window.supabase.createClient(
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

// supabase.auth.getUser() validates the session against the server, so it
// fails outright with no network. getSession() just reads the session
// supabase-js already persisted in localStorage — no network needed — so a
// returning user who's offline still gets recognized as logged in and sees
// their cached data instead of being bounced to the login screen.
export async function getCurrentUser() {
  try {
    const { data } = await supabase.auth.getUser();
    if (data && data.user) return data.user;
  } catch (e) {
    // network error — fall through to the local session
  }
  try {
    const { data } = await supabase.auth.getSession();
    return (data && data.session && data.session.user) || null;
  } catch (e) {
    return null;
  }
}
