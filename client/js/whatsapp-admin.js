// CrowdCity AI v2.3 - WhatsApp Gateway Administrative Client Script
// Manages device authentication QR scans, connection controls, test message sending, and logger updates.

(function() {
  'use strict';

  let currentTab = 'logs';
  let pollIntervalId = null;

  async function getAuthToken() {
    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const session = await client.auth.getSession();
          return session?.data?.session?.access_token || null;
        }
      }
    } catch (e) {
      console.warn("Failed to retrieve token from Supabase:", e);
    }
    // Fallback to local storage auth token if available
    return localStorage.getItem('cc_auth_token') || null;
  }

  async function makeAuthorizedRequest(url, method = 'GET', body = null) {
    const token = await getAuthToken();
    if (!token) {
      console.warn("No authentication token found, redirecting to login...");
      window.location.href = 'auth.html';
      return null;
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const config = {
      method,
      headers
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, config);
      if (response.status === 401) {
        // Token expired
        localStorage.removeItem('cc_auth_token');
        window.location.href = 'auth.html';
        return null;
      }
      return await response.json();
    } catch (err) {
      console.error(`Request to ${url} failed:`, err);
      return null;
    }
  }

  async function fetchGatewayStatus() {
    const data = await makeAuthorizedRequest('/api/whatsapp/status');
    if (!data) return;

    updateStatusUI(data);
  }

  function updateStatusUI(data) {
    const stateEl = document.getElementById('stat-connection-state');
    const queueEl = document.getElementById('stat-queue-count');
    const badgeContainer = document.getElementById('status-badge-container');
    const qrPlaceholder = document.getElementById('qr-placeholder');
    const qrImg = document.getElementById('qr-img');

    if (queueEl) queueEl.textContent = data.queueCount || 0;

    if (stateEl) {
      stateEl.textContent = data.status.toUpperCase();
      if (data.status === 'ready') {
        stateEl.style.color = '#10b981';
      } else if (data.status === 'connecting' || data.status === 'qr_ready') {
        stateEl.style.color = '#f59e0b';
      } else {
        stateEl.style.color = '#ef4444';
      }
    }

    // Set status badge
    if (badgeContainer) {
      let badgeClass = 'status-disconnected';
      let icon = 'fa-circle';
      let text = 'Offline';

      if (data.status === 'ready') {
        badgeClass = 'status-ready';
        icon = 'fa-circle-check';
        text = 'Online / Ready';
      } else if (data.status === 'connecting') {
        badgeClass = 'status-connecting';
        icon = 'fa-circle-notch fa-spin';
        text = 'Connecting';
      } else if (data.status === 'qr_ready') {
        badgeClass = 'status-qr';
        icon = 'fa-qrcode';
        text = 'Scan QR Code';
      }

      badgeContainer.innerHTML = `<span class="status-badge ${badgeClass}"><i class="fa-solid ${icon}"></i> ${text}</span>`;
    }

    // Handle QR image
    if (data.status === 'qr_ready' && data.qrCode) {
      if (qrPlaceholder) qrPlaceholder.classList.add('hidden');
      if (qrImg) {
        qrImg.src = data.qrCode;
        qrImg.classList.remove('hidden');
      }
    } else {
      if (qrPlaceholder) qrPlaceholder.classList.remove('hidden');
      if (qrImg) {
        qrImg.src = '';
        qrImg.classList.add('hidden');
      }
    }
  }

  async function triggerReconnect() {
    if (window.showToast) window.showToast("Starting WhatsApp client initialization...", "info");
    const data = await makeAuthorizedRequest('/api/whatsapp/reconnect', 'POST');
    if (data && data.success) {
      await fetchGatewayStatus();
      await refreshLogsAndQueue();
    }
  }

  async function triggerDisconnect() {
    if (window.showToast) window.showToast("Disconnecting WhatsApp client session...", "info");
    const data = await makeAuthorizedRequest('/api/whatsapp/disconnect', 'POST');
    if (data && data.success) {
      if (window.showToast) window.showToast("WhatsApp client disconnected.", "success");
      await fetchGatewayStatus();
      await refreshLogsAndQueue();
    }
  }

  async function handleSendTestMessage(e) {
    e.preventDefault();
    const phone = document.getElementById('test-phone').value;
    const message = document.getElementById('test-message').value;

    const btn = document.getElementById('btn-send-test');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending...';
    }

    const data = await makeAuthorizedRequest('/api/whatsapp/test', 'POST', { phone, message });
    
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Send Message';
    }

    if (data && data.success) {
      if (window.showToast) window.showToast("Test message sent successfully!", "success");
      document.getElementById('form-test-message').reset();
      await refreshLogsAndQueue();
    } else {
      const errMsg = data?.error || "Check if your device is associated and try again.";
      if (window.showToast) window.showToast(`Error: ${errMsg}`, "error");
    }
  }

  async function refreshLogsAndQueue() {
    if (currentTab === 'logs') {
      const data = await makeAuthorizedRequest('/api/whatsapp/logs');
      const container = document.getElementById('logs-container');
      const emptyEl = document.getElementById('logs-empty');

      if (!data || !data.logs || data.logs.length === 0) {
        if (emptyEl) emptyEl.classList.remove('hidden');
        if (container) container.innerHTML = '';
        return;
      }

      if (emptyEl) emptyEl.classList.add('hidden');
      if (container) {
        container.innerHTML = data.logs.map(log => {
          const time = new Date(log.timestamp).toLocaleTimeString();
          const badgeColor = log.success ? '#10b981' : '#ef4444';
          return `
            <div class="log-row">
              <span style="font-weight: 700; color: var(--text-muted);">${time}</span>
              <span style="flex: 1; margin: 0 0.5rem; text-align: left; color: var(--text-main);">${log.message}</span>
              <span style="font-weight: 800; color: ${badgeColor}; text-transform: uppercase;">[${log.type}]</span>
            </div>
          `;
        }).join('');
      }
    } else {
      const data = await makeAuthorizedRequest('/api/whatsapp/queue');
      const container = document.getElementById('queue-container');
      const emptyEl = document.getElementById('queue-empty');

      if (!data || !data.queue || data.queue.length === 0) {
        if (emptyEl) emptyEl.classList.remove('hidden');
        if (container) container.innerHTML = '';
        return;
      }

      if (emptyEl) emptyEl.classList.add('hidden');
      if (container) {
        container.innerHTML = data.queue.map(q => {
          const time = new Date(q.timestamp).toLocaleTimeString();
          return `
            <div class="log-row">
              <span style="font-weight: 700; color: var(--text-muted);">${time}</span>
              <span style="flex: 1; margin: 0 0.5rem; text-align: left; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${q.text}">${q.text}</span>
              <span style="font-weight: 800; color: #6366f1;">${q.phone}</span>
            </div>
          `;
        }).join('');
      }
    }
  }

  function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const tab = btn.dataset.tab;
        currentTab = tab;

        if (tab === 'logs') {
          document.getElementById('tab-logs').classList.remove('hidden');
          document.getElementById('tab-queue').classList.add('hidden');
        } else {
          document.getElementById('tab-queue').classList.remove('hidden');
          document.getElementById('tab-logs').classList.add('hidden');
        }

        refreshLogsAndQueue();
      });
    });
  }

  function startPolling() {
    fetchGatewayStatus();
    refreshLogsAndQueue();
    
    pollIntervalId = setInterval(() => {
      fetchGatewayStatus();
      refreshLogsAndQueue();
    }, 3000);
  }

  // Guard page for authorized administrators
  async function guardAdminPage() {
    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const session = await client.auth.getSession();
          const user = session?.data?.session?.user;
          if (!user) {
            window.location.href = 'auth.html';
            return;
          }

          // Fetch user profile role
          const { data: profile } = await client
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          if (!profile || (profile.role !== 'admin' && profile.role !== 'authority')) {
            window.location.href = 'citizen-dashboard.html';
            return;
          }
        }
      }
    } catch(e) {}
  }

  document.addEventListener('DOMContentLoaded', () => {
    guardAdminPage();
    setupTabs();

    document.getElementById('btn-reconnect')?.addEventListener('click', triggerReconnect);
    document.getElementById('btn-disconnect')?.addEventListener('click', triggerDisconnect);
    document.getElementById('form-test-message')?.addEventListener('submit', handleSendTestMessage);

    startPolling();
  });

  window.addEventListener('beforeunload', () => {
    if (pollIntervalId) clearInterval(pollIntervalId);
  });

})();
