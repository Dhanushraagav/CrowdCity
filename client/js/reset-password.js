// CrowdCity - Password Recovery & Reset Controller

document.addEventListener('DOMContentLoaded', () => {
  const resetForm = document.getElementById('reset-password-form');
  const noSessionBanner = document.getElementById('no-session-banner');
  const alertBanner = document.getElementById('reset-alert');
  const submitBtn = document.getElementById('btn-reset-submit');
  const debugPanel = document.getElementById('debug-log-panel');

  let resolvedUserRole = 'citizen';
  let isPasswordUpdated = false;

  function logDebug(msg, obj = null) {
    const time = new Date().toLocaleTimeString();
    let text = `[${time}] ${msg}`;
    if (obj) {
      text += `\n${JSON.stringify(obj, null, 2)}`;
    }
    console.log(`[Reset Password Debug] ${msg}`, obj || '');
    if (debugPanel) {
      debugPanel.textContent += text + '\n\n';
      debugPanel.scrollTop = debugPanel.scrollHeight;
    }
  }

  function showAlert(msg, isSuccess = false) {
    if (!alertBanner) return;
    alertBanner.textContent = msg;
    alertBanner.className = isSuccess ? 'alert-banner success' : 'alert-banner error';
    alertBanner.classList.remove('hidden');
  }

  logDebug("Page loaded. Initializing password recovery audit...");
  
  // Log current URL hash and query search params to verify tokens
  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const customToken = urlParams.get('token');
  const customEmail = urlParams.get('email');
  const isCustomReset = !!(customToken && customEmail);
  
  logDebug("URL query parameters:", Object.fromEntries(urlParams.entries()));

  // Caching password recovery active flag immediately on page load before Supabase client clears the URL hash
  const isRecoveryInUrlOnLoad = window.location.hash.includes('type=recovery') || 
                               window.location.search.includes('type=recovery') ||
                               hashParams.get('type') === 'recovery' ||
                               urlParams.get('type') === 'recovery';

  if (isRecoveryInUrlOnLoad) {
    localStorage.setItem('cc_password_recovery_active', 'true');
    logDebug("Password recovery active flag saved to localStorage on page load.");
  }
  
  // Print access_token / refresh_token lengths safely
  const queryAccessToken = urlParams.get('access_token');
  const hashAccessToken = hashParams.get('access_token');
  const hashRefreshToken = hashParams.get('refresh_token');

  if (queryAccessToken || hashAccessToken) {
    logDebug("Access token detected in URL!");
    logDebug(`- Query access_token length: ${queryAccessToken ? queryAccessToken.length : 0}`);
    logDebug(`- Hash access_token length: ${hashAccessToken ? hashAccessToken.length : 0}`);
    logDebug(`- Hash refresh_token length: ${hashRefreshToken ? hashRefreshToken.length : 0}`);
  } else {
    logDebug("No access token detected directly in raw URL parameters.");
  }

  // Define initialization checker
  let authListenerInitialized = false;

  function initResetPage() {
    if (authListenerInitialized) return;
    authListenerInitialized = true;

    if (!supabaseClient) {
      logDebug("CRITICAL ERROR: supabaseClient is not initialized! Check connection to backend /api/config.");
      showAlert("Supabase client failed to initialize. Recovery flow is disabled.");
      document.body.classList.add('ready');
      return;
    }

    logDebug("Supabase client initialized. Attaching auth state change listener...");

    // Detect Supabase recovery sessions using onAuthStateChange() and PASSWORD_RECOVERY events
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      if (isPasswordUpdated) return;

      if (event === 'SIGNED_IN') {
        logDebug('[Auth Log] SIGNED_IN event triggered');
      } else if (event === 'PASSWORD_RECOVERY') {
        logDebug('[Auth Log] PASSWORD_RECOVERY event triggered');
        localStorage.setItem('cc_password_recovery_active', 'true');
      } else if (event === 'SIGNED_OUT') {
        logDebug('[Auth Log] SIGNED_OUT event triggered');
        if (!isPasswordUpdated) {
          localStorage.removeItem('cc_password_recovery_active');
        }
      } else {
        logDebug(`Auth event triggered: "${event}"`);
      }

      logDebug(`Session state: ${session ? 'Active (User: ' + session.user.email + ')' : 'None'}`);

      if (session) {
        logDebug("Session Access Token:", {
          token_length: session.access_token ? session.access_token.length : 0,
          token_prefix: session.access_token ? session.access_token.substring(0, 15) + '...' : 'none',
          user_id: session.user.id,
          role: session.user.role
        });

        // Retrieve and cache the user's role from profile
        try {
          const response = await fetch('/api/auth/profile', {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          });
          if (response.ok) {
            const profile = await response.json();
            if (profile && profile.role) {
              resolvedUserRole = profile.role;
              logDebug(`User profile role resolved: ${resolvedUserRole}`);
              localStorage.setItem('cc_user_role', resolvedUserRole);
              localStorage.setItem('cc_user_profile', JSON.stringify(profile));

              // Update back button link dynamically if authority user
              const backLink = document.getElementById('back-to-login-link');
              if (backLink) {
                if (resolvedUserRole === 'authority' || resolvedUserRole === 'admin') {
                  backLink.href = 'authority-login.html';
                  backLink.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Back to Authority Login';
                } else {
                  backLink.href = 'auth.html';
                  backLink.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Back to Sign In';
                }
              }
            }
          }
        } catch (err) {
          logDebug("Error resolving profile role:", err);
        }
      }

      // Show reset password form on PASSWORD_RECOVERY event or if recovery is active in localStorage
      const isRecoveryActive = localStorage.getItem('cc_password_recovery_active') === 'true';
      const isRecoveryEvent = (event === 'PASSWORD_RECOVERY');
      const hasSession = !!session;

      logDebug(`Recovery check: isRecoveryEvent=${isRecoveryEvent}, isRecoveryActive=${isRecoveryActive}, hasSession=${hasSession}`);

      if (isRecoveryEvent || isRecoveryActive) {
        if (hasSession) {
          logDebug("Recovery session verified successfully! Showing reset form.");
          if (noSessionBanner) noSessionBanner.classList.add('hidden');
          if (resetForm) {
            resetForm.classList.remove('hidden');
            resetForm.style.display = 'flex';
          }
        } else {
          logDebug("Recovery flow active but no session present.");
          if (!isPasswordUpdated) {
            if (resetForm) resetForm.classList.add('hidden');
            if (noSessionBanner) noSessionBanner.classList.remove('hidden');
          }
        }
      } else {
        logDebug("Non-recovery event or no session present. Hiding form.");
        if (!isPasswordUpdated) {
          if (resetForm) resetForm.classList.add('hidden');
          if (noSessionBanner) noSessionBanner.classList.remove('hidden');
        }
      }

      document.body.classList.add('ready');
    });
  }

  if (isCustomReset) {
    logDebug("Custom recovery parameters detected. Displaying password update form.");
    if (noSessionBanner) noSessionBanner.classList.add('hidden');
    if (resetForm) {
      resetForm.classList.remove('hidden');
      resetForm.style.display = 'flex';
    }
    document.body.classList.add('ready');
  } else {
    // Wait for central auth initialization
    if (window.authInitPromise) {
      window.authInitPromise.then(() => {
        initResetPage();
      });
    } else {
      const checkInterval = setInterval(() => {
        if (typeof supabaseClient !== 'undefined' && supabaseClient !== null) {
          clearInterval(checkInterval);
          initResetPage();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!authListenerInitialized) {
          initResetPage();
        }
      }, 5000);
    }
  }

  // Form submission handler
  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const newPassword = document.getElementById('new-password').value;
      const confirmPassword = document.getElementById('confirm-new-password').value;

      if (newPassword.length < 6) {
        showAlert("Password must be at least 6 characters long.");
        return;
      }

      if (newPassword !== confirmPassword) {
        showAlert("Passwords do not match.");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Updating...';
      if (alertBanner) alertBanner.classList.add('hidden');

      if (isCustomReset) {
        try {
          logDebug("Submitting password update request to custom backend reset endpoint...");
          const res = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: customToken,
              email: customEmail,
              newPassword: newPassword
            })
          });
          const data = await res.json();

          if (res.ok) {
            isPasswordUpdated = true;
            logDebug("Custom password update succeeded!");
            if (noSessionBanner) noSessionBanner.classList.add('hidden');
            showAlert("Password updated successfully! Redirecting to Sign In...", true);
            
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-new-password').value = '';

            setTimeout(() => {
              window.authRouter.redirectToLogin('citizen');
            }, 1800);
          } else {
            logDebug(`Custom reset failed: ${data.error}`);
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Update Password';
            showAlert(`Failed to update password: ${data.error || 'Unknown error'}`);
          }
        } catch (err) {
          logDebug("Catch block error during custom update:", err);
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Update Password';
          showAlert(err.message || "An unexpected error occurred during password update.");
        }
      } else {
        try {
          logDebug("Submitting password update request to Supabase...");
          
          const { data, error } = await supabaseClient.auth.updateUser({
            password: newPassword
          });

          logDebug("updateUser response data:", data);
          logDebug("updateUser response error:", error);

          if (error) {
            logDebug(`Update failed. error.code: "${error.code}", error.message: "${error.message}"`);
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Update Password';
            showAlert(`Failed to update password: ${error.message} (Code: ${error.code || 'None'})`);
          } else {
            isPasswordUpdated = true;
            logDebug("Password update succeeded! Signing out recovery session...");
            
            // Clean up session data
            try {
              await supabaseClient.auth.signOut().catch(() => {});
            } catch (e) {}

            localStorage.removeItem('cc_session');
            localStorage.removeItem('cc_user_role');
            localStorage.removeItem('cc_user_profile');
            localStorage.removeItem('cc_password_recovery_active');

            if (noSessionBanner) noSessionBanner.classList.add('hidden');
            showAlert("Password updated successfully! Redirecting to Sign In...", true);
            
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-new-password').value = '';

            setTimeout(() => {
              logDebug(`Redirecting to login for role: ${resolvedUserRole}`);
              window.authRouter.redirectToLogin(resolvedUserRole || 'citizen');
            }, 1800);
          }
        } catch (err) {
          logDebug("Catch block error during updateUser:", err);
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Update Password';
          showAlert(err.message || "An unexpected error occurred during password update.");
        }
      }
    });
  }
});
