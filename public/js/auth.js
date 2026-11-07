/* ==========================================================================
   Previo HUD — Auth Screen Logic (login / signup / forgot password / logout)
   ========================================================================== */

import { supabase } from './supabase-client.js';
import { initApp } from './init.js';

let currentAuthMode = 'login';

function showTab(tab) {
  currentAuthMode = tab;
  document.getElementById('tab-login').style.background = tab === 'login' ? '#10d98c' : 'transparent';
  document.getElementById('tab-login').style.color = tab === 'login' ? '#020617' : '#64748b';
  document.getElementById('tab-signup').style.background = tab === 'signup' ? '#10d98c' : 'transparent';
  document.getElementById('tab-signup').style.color = tab === 'signup' ? '#020617' : '#64748b';
  document.getElementById('btn-auth-submit').innerText = tab === 'login' ? 'ENTRAR' : 'CRIAR CONTA';
  document.getElementById('link-forgot-password').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('auth-error').style.display = 'none';
  document.getElementById('auth-success').style.display = 'none';
}

// Switches the auth screen into "esqueci minha senha" mode: hides the password
// field and tabs, repurposes the same submit button to send the reset email.
function showForgotPasswordMode() {
  currentAuthMode = 'forgot';
  document.getElementById('auth-tabs').style.display = 'none';
  document.getElementById('auth-password').style.display = 'none';
  document.getElementById('link-forgot-password').style.display = 'none';
  document.getElementById('link-back-to-login').style.display = 'block';
  document.getElementById('btn-auth-submit').innerText = 'ENVIAR LINK DE REDEFINIÇÃO';
  document.getElementById('auth-error').style.display = 'none';
  document.getElementById('auth-success').style.display = 'none';
}

function backToLogin() {
  document.getElementById('auth-tabs').style.display = 'flex';
  document.getElementById('auth-password').style.display = 'block';
  document.getElementById('link-back-to-login').style.display = 'none';
  document.getElementById('auth-error').style.display = 'none';
  document.getElementById('auth-success').style.display = 'none';
  showTab('login');
}

async function handleAuth() {
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
}

async function handleSetNewPassword() {
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
}

export async function logout() {
  await supabase.auth.signOut();
  location.reload();
}

// Exposed on window because index.html wires these up via inline onclick="..."
// handlers on the auth screen and reset-password screen.
window.showTab = showTab;
window.showForgotPasswordMode = showForgotPasswordMode;
window.backToLogin = backToLogin;
window.handleAuth = handleAuth;
window.handleSetNewPassword = handleSetNewPassword;
window.logout = logout;
