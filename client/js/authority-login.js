// CrowdCity - Authority Login Controller (Email + Password)

function initAuthorityLogin() {
  const alertBanner = document.getElementById('auth-alert');
  const loginForm = document.getElementById('authority-login-form');

  // Set body to ready
  document.body.classList.add('ready');

  // ─── Alert helper ──────────────────────────────────────────────────────────
  function showAlert(msg, isSuccess = false) {
    if (!alertBanner) return;
    alertBanner.textContent = msg;
    alertBanner.className = isSuccess ? 'alert-banner success' : 'alert-banner error';
    alertBanner.classList.remove('hidden');
  }

  // ─── Login Form Submit ─────────────────────────────────────────────────────
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;

      const submitBtn = document.getElementById('btn-login-submit');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Signing In...';
      alertBanner.classList.add('hidden');

      console.log('[Authority Login] Attempting sign in for:', email);

      const { data, error } = await loginUser(email, password);

      if (error) {
        console.error('[Authority Login] Error:', error);
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Access Dashboard';
        showAlert(error.message || 'Login failed.');
        return;
      }

      const user = data.user || (data.session && data.session.user);
      if (!user) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Access Dashboard';
        showAlert('Login succeeded but no user session returned. Please try again.');
        return;
      }

      console.log('[Authority Login] Success. User:', user.id, '| Email:', user.email);
      showAlert('Login successful! Checking access...', true);
      window.cc_manual_signin = true;
      await verifyProfileAndRoute(user, showAlert);
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuthorityLogin);
} else {
  initAuthorityLogin();
}
