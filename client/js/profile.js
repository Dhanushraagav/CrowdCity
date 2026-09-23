// CrowdCity - Read-Only Profile Controller

let lastUserProfileData = null;
let lastUserIssuesProfile = null;

async function getActiveUser() {
  // Try Supabase Client first if real auth is enabled
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      const { data: { user: supabaseUser }, error } = await supabaseClient.auth.getUser();
      if (!error && supabaseUser) {
        return supabaseUser;
      }
    } catch (err) {
      console.warn("Failed to get Supabase authenticated user, checking fallback session:", err);
    }
  }

  // Fallback to local session
  if (typeof getCurrentUser === 'function') {
    return getCurrentUser();
  }
  return null;
}

// Render user profile UI elements
function renderProfileFields(displayName, email, avatarUrl, role, createdDate) {
  // Set sidebar display text
  const nameDisp = document.getElementById('profile-name-display');
  const emailDisp = document.getElementById('profile-email-display');
  const roleBadge = document.getElementById('profile-role-badge');
  const joinedDisp = document.getElementById('profile-joined-display');

  if (nameDisp) nameDisp.textContent = displayName;
  if (emailDisp) emailDisp.textContent = email;
  
  if (roleBadge) {
    roleBadge.textContent = role;
    roleBadge.style.textTransform = 'capitalize';
  }
  
  if (joinedDisp) joinedDisp.textContent = window.i18n ? window.i18n.t('member_since', { date: createdDate }) : `Member since ${createdDate}`;

  const avatarDisplay = document.getElementById('profile-avatar-display');
  if (avatarDisplay) {
    avatarDisplay.style.cursor = 'default';
    avatarDisplay.onclick = null;
    if (avatarUrl) {
      avatarDisplay.innerHTML = `<img src="${avatarUrl}" style="width:100%; height:100%; object-fit:cover; border-radius: 50%;">`;
    } else {
      avatarDisplay.innerHTML = displayName.charAt(0).toUpperCase();
    }
  }
}

// Fetch user metadata
async function loadUserProfile(user) {
  const email = user.email;
  const displayName = user.user_metadata?.full_name || email.split('@')[0];
  const avatarUrl = user.user_metadata?.avatar_url || '';

  const token = typeof getAuthToken === 'function' ? getAuthToken() : null;
  let role = 'citizen';
  let createdDate = '';

  // 1. Render from cached profile data immediately to prevent flickering (with user ID verification)
  const cachedProfileStr = localStorage.getItem(`cc_user_profile_${user.id}`) || localStorage.getItem('cc_user_profile');
  if (cachedProfileStr) {
    try {
      const cachedProfile = JSON.parse(cachedProfileStr);
      if (cachedProfile && (cachedProfile.id === user.id || cachedProfile.sub === user.id)) {
        lastUserProfileData = cachedProfile;
        role = cachedProfile.role || 'citizen';
        if (cachedProfile.created_at) {
          const joined = new Date(cachedProfile.created_at);
          const lang = window.i18n ? window.i18n.getLanguage() : 'en';
          createdDate = joined.toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-US', { month: 'long', year: 'numeric' });
        }
        renderProfileFields(displayName, email, avatarUrl, role, createdDate);
      } else {
        localStorage.removeItem('cc_user_profile');
        renderProfileFields(displayName, email, avatarUrl, role, createdDate);
      }
    } catch (e) {
      console.warn("Failed to parse cached profile:", e);
      renderProfileFields(displayName, email, avatarUrl, role, createdDate);
    }
  } else {
    // Render defaults if no cache yet
    renderProfileFields(displayName, email, avatarUrl, role, createdDate);
  }
  
  if (token) {
    try {
      const response = await fetch('/api/auth/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const profile = await response.json();
        lastUserProfileData = profile;
        role = profile.role || 'citizen';
        if (profile.created_at) {
          const joined = new Date(profile.created_at);
          const lang = window.i18n ? window.i18n.getLanguage() : 'en';
          createdDate = joined.toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-US', { month: 'long', year: 'numeric' });
        }
        // Render fresh values
        const freshAvatar = profile.avatar_url || user.user_metadata?.avatar_url || '';
        renderProfileFields(displayName, email, freshAvatar, role, createdDate);
        // Cache profile
        profile.avatar_url = freshAvatar;
        localStorage.setItem('cc_user_profile', JSON.stringify(profile));
        localStorage.setItem(`cc_user_profile_${user.id}`, JSON.stringify(profile));
        if (typeof renderAuthUI === 'function') renderAuthUI();
        if (typeof initMobileTopnav === 'function') initMobileTopnav();
      }
    } catch (err) {
      console.error("Failed to load user profile:", err);
    }
  }
}


// Fetch user reported issues for stats and timeline
async function loadUserActivityAndStats(user) {
  if (!user) return;

  const role = typeof getUserRole === 'function' ? getUserRole() : null;
  const isAuthority = role === 'authority' || role === 'admin';
  const queryParams = isAuthority ? { assigned_to: user.id } : { reporter_id: user.id };

  const { data: issues, error } = await window.API.getIssues(queryParams);
  if (error || !issues) {
    console.error("Failed to load user issues for profile:", error);
    return;
  }

  lastUserIssuesProfile = issues;
  renderUserActivityAndStatsHTML(user, issues);
}

function renderUserActivityAndStatsHTML(user, issues) {
  const totalReports = issues.length;
  const resolvedReports = issues.filter(i => i.status === 'resolved' || i.status === 'verified').length;
  const activeCases = issues.filter(i => i.status === 'pending' || i.status === 'assigned' || i.status === 'in_progress').length;
  const resolutionRate = totalReports > 0 ? Math.round((resolvedReports / totalReports) * 100) : 0;

  // Set Overview stats
  const totalReportsEl = document.getElementById('stats-total-reports');
  const resolvedReportsEl = document.getElementById('stats-resolved-reports');
  const activeCasesEl = document.getElementById('stats-active-cases');
  const resolutionRateBadgeEl = document.getElementById('stats-resolution-rate-badge');
  const resolutionRateEl = document.getElementById('stats-resolution-rate');
  const impactSummaryEl = document.getElementById('community-impact-summary');

  if (totalReportsEl) totalReportsEl.textContent = totalReports;
  if (resolvedReportsEl) resolvedReportsEl.textContent = resolvedReports;
  if (activeCasesEl) activeCasesEl.textContent = activeCases;
  if (resolutionRateBadgeEl) resolutionRateBadgeEl.textContent = `${resolutionRate}%`;
  if (resolutionRateEl) {
    resolutionRateEl.textContent = window.i18n 
      ? window.i18n.t('resolution_rate_stats', { rate: resolutionRate }) 
      : `${resolutionRate}% of your reported issues have been fully resolved.`;
  }

  if (impactSummaryEl) {
    if (totalReports === 0) {
      impactSummaryEl.textContent = window.i18n 
        ? window.i18n.t('profile_impact_empty') 
        : "You haven't filed any complaints yet. Start reporting local issues to help improve the neighborhood!";
    } else {
      impactSummaryEl.textContent = window.i18n 
        ? window.i18n.t('profile_impact_stats', { resolved: resolvedReports, rate: resolutionRate }) 
        : `Your reporting efforts have directly helped resolve ${resolvedReports} issues, improving municipal responsiveness by ${resolutionRate}% for reported cases!`;
    }
  }

  // Render Timeline
  const feedEl = document.getElementById('profile-timeline-feed');
  if (feedEl) {
    if (issues.length === 0) {
      const tNoActivity = window.i18n ? window.i18n.t('profile_no_activity') : 'No reporting activity logged. Go report a hazard to start your timeline!';
      feedEl.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.85rem;">
          <i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 0.5rem; color: var(--border-color);"></i>
          <p>${tNoActivity}</p>
        </div>
      `;
    } else {
      feedEl.innerHTML = issues.map(issue => {
        const lang = window.i18n ? window.i18n.getLanguage() : 'en';
        const dateStr = new Date(issue.created_at).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        const statusLabels = {
          pending: window.i18n ? window.i18n.t('status_pending') : 'Pending',
          assigned: window.i18n ? window.i18n.t('status_assigned') : 'Assigned',
          in_progress: window.i18n ? window.i18n.t('status_in_progress') : 'In Progress',
          resolved: window.i18n ? window.i18n.t('status_resolved') : 'Resolved',
          rejected: window.i18n ? window.i18n.t('status_rejected') : 'Rejected'
        };
        const statusBadge = `<span class="badge badge-status ${issue.status}">${statusLabels[issue.status] || issue.status}</span>`;
        
        const role = typeof getUserRole === 'function' ? getUserRole() : null;
        const targetPage = (role === 'authority' || role === 'admin') ? 'authority-issue-details.html' : 'issue-details.html';

        return `
          <div class="timeline-item">
            <div class="timeline-marker"></div>
            <div class="timeline-content" onclick="window.location.href='${targetPage}?id=${issue.id}'" style="cursor: pointer;">
              <div class="timeline-header-row">
                <div class="timeline-title">
                  <i class="fa-solid fa-circle-info" style="color: var(--primary);"></i>
                  <span>${escapeHTML(issue.title)}</span>
                  ${statusBadge}
                </div>
                <span class="timeline-time">${dateStr}</span>
              </div>
              <p class="timeline-desc">${escapeHTML(issue.description)}</p>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

// Switch Tab Panels
function switchTab(tabName) {
  // Update Tab buttons
  const buttons = document.querySelectorAll('.profile-tab-btn');
  buttons.forEach(btn => {
    btn.classList.remove('active');
  });
  
  const targetBtn = document.getElementById(`tab-${tabName}-btn`);
  if (targetBtn) targetBtn.classList.add('active');

  // Update Panels
  const panels = document.querySelectorAll('.profile-tab-panel');
  panels.forEach(panel => {
    panel.classList.remove('active');
  });

  const targetPanel = document.getElementById(`panel-${tabName}`);
  if (targetPanel) targetPanel.classList.add('active');

  // Update hash securely
  if (history.pushState) {
    history.pushState(null, null, `#${tabName}`);
  } else {
    window.location.hash = tabName;
  }
}
window.switchTab = switchTab;

// Hash Change and Load navigation
function setupHashNavigation() {
  const handleHash = () => {
    const hash = window.location.hash.substring(1);
    const validTabs = ['overview', 'activity'];
    if (validTabs.includes(hash)) {
      switchTab(hash);
    } else {
      switchTab('overview');
    }
  };

  window.addEventListener('hashchange', handleHash);
  handleHash();
}

// HTML Escaping Utility
function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let lastLoadedUserIdProfile = null;

async function initProfilePage() {
  const user = await getActiveUser();
  if (!user) {
    window.authRouter.redirectToLogin('citizen');
    return;
  }

  lastLoadedUserIdProfile = user.id;

  await Promise.all([
    loadUserProfile(user),
    loadUserActivityAndStats(user)
  ]);
  
  setupHashNavigation();
}

window.addEventListener('auth-change', async () => {
  const user = await getActiveUser();
  if (user) {
    if (user.id === lastLoadedUserIdProfile) {
      // Prevent duplicate fetches & layout flickering if same user is already rendered
      return;
    }
    lastLoadedUserIdProfile = user.id;
    await Promise.all([
      loadUserProfile(user),
      loadUserActivityAndStats(user)
    ]);
  } else {
    window.authRouter.redirectToLogin('citizen');
  }
});

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    initProfilePage();
  });
} else {
  initProfilePage();
}

window.addEventListener('language-change', async () => {
  if (window.i18n) {
    window.i18n.translatePage();
  }
  
  const user = await getActiveUser();
  if (user && lastUserProfileData) {
    const email = user.email;
    const displayName = user.user_metadata?.full_name || email.split('@')[0];
    const avatarUrl = user.user_metadata?.avatar_url || '';
    const role = lastUserProfileData.role || 'citizen';
    let createdDate = '';
    if (lastUserProfileData.created_at) {
      const joined = new Date(lastUserProfileData.created_at);
      const lang = window.i18n ? window.i18n.getLanguage() : 'en';
      createdDate = joined.toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-US', { month: 'long', year: 'numeric' });
    }
    renderProfileFields(displayName, email, avatarUrl, role, createdDate);
  }

  if (user && lastUserIssuesProfile) {
    renderUserActivityAndStatsHTML(user, lastUserIssuesProfile);
  }
});
