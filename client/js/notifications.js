// CrowdCity - Realtime Notifications client
let sseSource = null;
let supabaseRealtimeChannel = null;
let notificationsList = [];
let lastLoadedUserIdNotifications = null;

// Escapes special HTML characters to prevent XSS
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Format date relative to current time
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMs < 0) return window.i18n ? window.i18n.t('time_just_now') : 'Just now';
  if (diffMins < 1) return window.i18n ? window.i18n.t('time_just_now') : 'Just now';
  if (diffMins < 60) return window.i18n ? window.i18n.t('time_mins_ago', { mins: diffMins }) : `${diffMins}m ago`;
  if (diffHours < 24) return window.i18n ? window.i18n.t('time_hours_ago', { hours: diffHours }) : `${diffHours}h ago`;
  if (diffDays === 1) return window.i18n ? window.i18n.t('time_yesterday') : 'Yesterday';
  if (diffDays < 7) return window.i18n ? window.i18n.t('time_days_ago', { days: diffDays }) : `${diffDays}d ago`;
  
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Play premium synthesizer chord using Web Audio API (zero external assets needed)
function playNotificationSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Resume context if suspended (common browser security constraint)
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.type = 'sine';
    const now = audioCtx.currentTime;
    
    // Play dual tone (C5 to E5 transition)
    oscillator.frequency.setValueAtTime(523.25, now); // C5
    oscillator.frequency.setValueAtTime(659.25, now + 0.08); // E5
    
    gainNode.gain.setValueAtTime(0.08, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    
    oscillator.start(now);
    oscillator.stop(now + 0.3);
    
    // Trigger visual shake on bell badge
    const badge = document.getElementById('bell-badge');
    if (badge) {
      badge.style.animation = 'none';
      badge.offsetHeight; // trigger reflow
      badge.style.animation = 'badge-pop var(--transition-normal) forwards';
    }
  } catch (err) {
    console.warn("Audio chime playback failed:", err);
  }
}

// Resolve icon and style class based on notification type and title
function getNotificationIconAndClass(n) {
  let icon = 'fa-arrows-rotate';
  let customClass = n.type || 'status_change';
  if (n.type === 'assignment') {
    icon = 'fa-user-plus';
  } else if (n.type === 'achievement' || n.type === 'other' || (n.title && (n.title.includes('Achievement') || n.title.includes('🏆')))) {
    icon = 'fa-trophy';
    customClass = 'achievement';
  }
  return { icon, customClass };
}

// Render notifications dropdown list and badge count
function renderNotifications() {
  const unreadCount = notificationsList.filter(n => !n.is_read).length;
  
  // Cache the count to prevent visual flickering on nav re-renders
  localStorage.setItem('cc_unread_notifications_count', unreadCount);
  
  // Update Navbar Badge
  const badge = document.getElementById('bell-badge');
  if (badge) {
    if (unreadCount > 0) {
      badge.textContent = unreadCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  // Update Navbar Dropdown List
  const dropdownList = document.getElementById('notification-dropdown-list');
  if (dropdownList) {
    if (notificationsList.length === 0) {
      const tNoNotif = window.i18n ? window.i18n.t('no_notifications_yet') : 'No notifications yet';
      dropdownList.innerHTML = `<div class="no-notifications">${tNoNotif}</div>`;
    } else {
      // Sort newest first
      const sorted = [...notificationsList].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const recent = sorted.slice(0, 5);
      
      dropdownList.innerHTML = recent.map(n => {
        const isUnread = !n.is_read;
        const timeStr = formatRelativeTime(n.created_at);
        const { icon, customClass } = getNotificationIconAndClass(n);
        
        return `
          <div class="notification-item ${customClass} ${isUnread ? 'unread' : ''}" 
               onclick="handleNotificationClick(event, '${n.id}', '${n.issue_id}')">
            <div class="notification-icon-wrapper">
              <i class="fa-solid ${icon}"></i>
            </div>
            <div class="notification-content">
              <span class="notification-title">${escapeHTML(n.title)}</span>
              <span class="notification-msg">${escapeHTML(n.message)}</span>
              <span class="notification-time">${timeStr}</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Update History Page listing if we are on notifications.html
  const historyList = document.getElementById('notifications-history-list');
  const historyTotalText = document.getElementById('history-total-count');
  
  if (historyList) {
    if (historyTotalText) {
      if (window.i18n) {
        historyTotalText.textContent = window.i18n.t('notifications_history_summary', {
          unread: unreadCount,
          total: notificationsList.length
        });
      } else {
        historyTotalText.textContent = `${unreadCount} unread / ${notificationsList.length} total`;
      }
    }

    if (notificationsList.length === 0) {
      const tEmptyTitle = window.i18n ? window.i18n.t('notification_history_empty_title') : 'Your notification history is empty.';
      historyList.innerHTML = `
        <div class="no-notifications" style="padding: 4rem 2rem; text-align: center; color: var(--text-muted);">
          <i class="fa-regular fa-bell-slash" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
          <p style="font-size: 1rem; font-weight: 500;">${tEmptyTitle}</p>
        </div>
      `;
    } else {
      const sorted = [...notificationsList].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      historyList.innerHTML = sorted.map(n => {
        const isUnread = !n.is_read;
        const timeStr = formatRelativeTime(n.created_at);
        const { icon, customClass } = getNotificationIconAndClass(n);
        const tMarkRead = window.i18n ? window.i18n.t('mark_as_read') : 'Mark as read';
        
        return `
          <div class="notification-item ${customClass} ${isUnread ? 'unread' : ''}" 
               onclick="handleNotificationClick(event, '${n.id}', '${n.issue_id}')"
               style="border-bottom: 1px solid var(--border-color); padding: 1.25rem 1.5rem;">
            <div class="notification-icon-wrapper" style="width: 44px; height: 44px; font-size: 1.1rem;">
              <i class="fa-solid ${icon}"></i>
            </div>
            <div class="notification-content" style="gap: 0.25rem;">
              <span class="notification-title" style="font-size: 0.95rem;">${escapeHTML(n.title)}</span>
              <span class="notification-msg" style="font-size: 0.85rem; line-height: 1.4;">${escapeHTML(n.message)}</span>
              <span class="notification-time">${timeStr}</span>
            </div>
            <div class="notification-item-actions" onclick="event.stopPropagation()">
              ${isUnread ? `
                <button class="btn-icon-sm read-btn" title="${tMarkRead}" onclick="markSingleRead(event, '${n.id}')" style="color: var(--primary);">
                  <i class="fa-solid fa-check" style="font-size: 1.1rem;"></i>
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    }
  }
}
window.renderNotifications = renderNotifications;

// Toggle notifications dropdown open/close
window.toggleNotificationDropdown = function(event) {
  if (event) event.stopPropagation();
  
  // Close profile dropdown
  const userDropdown = document.getElementById('user-dropdown');
  if (userDropdown) userDropdown.classList.add('hidden');

  const dropdown = document.getElementById('notification-dropdown');
  if (dropdown) {
    dropdown.classList.toggle('hidden');
  }
};

// Mark all notifications as read
window.handleMarkAllRead = async function(event) {
  if (event) event.stopPropagation();
  
  const { error } = await window.API.markAllNotificationsAsRead();
  if (error) {
    console.error("Failed to mark all as read:", error);
    return;
  }
  
  notificationsList.forEach(n => n.is_read = true);
  renderNotifications();
};

// Mark a single notification as read
window.markSingleRead = async function(event, id) {
  if (event) event.stopPropagation();
  
  const { error } = await window.API.markNotificationAsRead(id);
  if (error) {
    console.error("Failed to mark notification as read:", error);
    return;
  }
  
  const notif = notificationsList.find(n => n.id === id);
  if (notif) {
    notif.is_read = true;
  }
  renderNotifications();
};

// Click a notification to mark as read and redirect to issue
window.handleNotificationClick = async function(event, notifId, issueId) {
  if (event) event.preventDefault();
  
  const notif = notificationsList.find(n => n.id === notifId);
  if (notif && !notif.is_read) {
    await window.API.markNotificationAsRead(notifId);
    notif.is_read = true;
    renderNotifications();
  }
  
  if (issueId && issueId !== 'undefined' && issueId !== 'null') {
    const role = typeof getUserRole === 'function' ? getUserRole() : null;
    const targetPage = (role === 'authority' || role === 'admin') ? 'authority-issue-details.html' : 'issue-details.html';
    window.location.href = `${targetPage}?id=${issueId}`;
  }
};

// Initialize Notifications listener
async function initNotifications() {
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (!user) {
    // Clear state
    notificationsList = [];
    lastLoadedUserIdNotifications = null;
    if (sseSource) {
      sseSource.close();
      sseSource = null;
    }
    if (supabaseRealtimeChannel && typeof supabaseClient !== 'undefined' && supabaseClient) {
      supabaseClient.removeChannel(supabaseRealtimeChannel);
      supabaseRealtimeChannel = null;
    }
    return;
  }

  if (user.id === lastLoadedUserIdNotifications) {
    // Already active for this user, but the navbar may have been re-rendered (e.g. on auth-change).
    // Re-render the badge and dropdown items in the DOM without re-fetching.
    renderNotifications();
    return;
  }
  lastLoadedUserIdNotifications = user.id;

  // Cache-first: read cached notifications
  const cachedNotifications = localStorage.getItem('cc_notifications_cache');
  if (cachedNotifications) {
    try {
      notificationsList = JSON.parse(cachedNotifications);
      renderNotifications();
    } catch (e) {
      console.warn("Failed to parse cached notifications:", e);
    }
  }

  // Load existing notifications
  const { data, error } = await window.API.getNotifications();
  if (!error && data) {
    notificationsList = data;
    localStorage.setItem('cc_notifications_cache', JSON.stringify(data));
    renderNotifications();
  } else {
    console.error("Failed to fetch initial notifications:", error);
  }

  // Setup Realtime connection
  const mockSession = localStorage.getItem('cc_mock_session');
  const isMock = !!mockSession || (typeof isMockAuth !== 'undefined' && isMockAuth);

  if (isMock) {
    // 1. SSE for Mock Mode
    if (sseSource) {
      sseSource.close();
    }
    const token = getAuthToken();
    sseSource = new EventSource(`/api/notifications/realtime?token=${encodeURIComponent(token)}`);
    
    sseSource.onmessage = (event) => {
      try {
        const notif = JSON.parse(event.data);
        if (!notificationsList.some(n => n.id === notif.id)) {
          notificationsList.unshift(notif);
          renderNotifications();
          playNotificationSound();
        }
      } catch (err) {
        console.error("Error parsing realtime SSE payload:", err);
      }
    };
    
    sseSource.onerror = (err) => {
      console.warn("SSE connection encountered error, EventSource will auto-reconnect.");
    };
  } else {
    // 2. Supabase Realtime for Production Mode
    if (supabaseRealtimeChannel && typeof supabaseClient !== 'undefined' && supabaseClient) {
      supabaseClient.removeChannel(supabaseRealtimeChannel);
      supabaseRealtimeChannel = null;
    }

    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      supabaseRealtimeChannel = supabaseClient
        .channel(`public:notifications:${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        }, (payload) => {
          console.log('Supabase Realtime notification received:', payload.new);
          if (!notificationsList.some(n => n.id === payload.new.id)) {
            notificationsList.unshift(payload.new);
            renderNotifications();
            playNotificationSound();
          }
        })
        .subscribe((status) => {
          console.log(`Supabase Realtime subscription status: ${status}`);
        });
    }
  }
}

// Listen for auth-change custom events
window.addEventListener('auth-change', () => {
  initNotifications();
});

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  initNotifications();
});

window.addEventListener('language-change', () => {
  renderNotifications();
});
