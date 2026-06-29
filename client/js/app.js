// CrowdCity - Home Dashboard Controller

let currentIssues = [];
let activeCategory = '';
let activeStatus = '';
let activeFeedTab = 'recent';
let cachedUserCoords = null;
let lastLoadedUserIdApp = null;
let isLoadingIssues = false;
let lastUserIssues = [];
let appRealtimeChannel = null;

// High-performance requestAnimationFrame count-up animation
function animateCountUp(element, targetVal, suffix = '') {
  if (!element) return;
  const currentValStr = element.textContent.replace(suffix, '');
  const startVal = parseInt(currentValStr) || 0;
  if (startVal === targetVal) {
    element.textContent = targetVal + suffix;
    return;
  }
  
  const duration = 800; // ms
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Ease out quad
    const easeProgress = progress * (2 - progress);
    const currentVal = Math.floor(startVal + easeProgress * (targetVal - startVal));
    
    element.textContent = currentVal + suffix;
    
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = targetVal + suffix;
    }
  }
  
  requestAnimationFrame(update);
}

// Initialize the dashboard components
function initDashboard() {
  try {
    updateHeroGreeting();
  } catch (e) {
    console.error("Failed to update hero greeting:", e);
  }
  try {
    setupFilterListeners();
  } catch (e) {
    console.error("Failed to setup filter listeners:", e);
  }
  try {
    setupSearchListener();
  } catch (e) {
    console.error("Failed to setup search listener:", e);
  }
  try {
    setupFeedTabs();
  } catch (e) {
    console.error("Failed to setup feed tabs:", e);
  }
  
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  lastLoadedUserIdApp = user ? user.id : null;
  
  // Show body immediately to display page shell and skeleton loaders!
  document.body.classList.add('ready');
  document.body.style.visibility = 'visible';

  // Load initial datasets in parallel in the background
  Promise.all([
    loadAndRenderIssues().catch(err => console.error("Error in loadAndRenderIssues:", err)),
    loadUserStats().catch(err => console.error("Error in loadUserStats:", err)),
    loadRecentNotifications().catch(err => console.error("Error in loadRecentNotifications:", err))
  ]);

  initRealtimeDashboard();
}

// Fetch user profile and display points
async function loadUserStats(isLanguageChange = false) {
  const pointsCardNum = document.getElementById('stat-user-points');
  const rankEl = document.getElementById('stat-community-rank');
  if (!pointsCardNum) return;

  const totalEl = document.getElementById('stat-total-reports');
  const resolvedEl = document.getElementById('stat-resolved-issues');
  const activeEl = document.getElementById('stat-active-complaints');

  if (isLanguageChange && lastUserIssues && lastUserIssues.length > 0) {
    const total = lastUserIssues.length;
    const resolved = lastUserIssues.filter(i => i.status === 'resolved' || i.status === 'verified').length;
    const active = lastUserIssues.filter(i => i.status === 'pending' || i.status === 'assigned' || i.status === 'in_progress').length;

    if (totalEl) animateCountUp(totalEl, total);
    if (resolvedEl) animateCountUp(resolvedEl, resolved);
    if (activeEl) animateCountUp(activeEl, active);

    const rateEl = document.getElementById('stat-resolved-rate');
    if (rateEl) {
      const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
      const tRate = window.i18n ? window.i18n.t('rate_suffix') : 'Rate';
      rateEl.textContent = total > 0 ? `${rate}% ${tRate}` : '';
    }

    const heroDesc = document.getElementById('hero-desc');
    if (heroDesc) {
      if (total === 0) {
        heroDesc.textContent = window.i18n ? window.i18n.t('hero_desc_default') : 'Start reporting civic issues in your area. Every report builds a more responsive city for everyone.';
      } else {
        if (window.i18n) {
          heroDesc.textContent = window.i18n.t('hero_desc_stats', {
            total: total,
            s: total !== 1 ? 's' : '',
            resolved: resolved
          });
        } else {
          heroDesc.textContent = `You have submitted ${total} report${total !== 1 ? 's' : ''} with ${resolved} resolved. Every report builds a more responsive city for everyone.`;
        }
      }
    }
    renderRecentComplaints(lastUserIssues);
    return;
  }

  // Render from cached profile immediately to prevent visual flashing
  const cachedProfileStr = localStorage.getItem('cc_user_profile');
  let cachedPoints = 0;
  if (cachedProfileStr) {
    try {
      const cachedProfile = JSON.parse(cachedProfileStr);
      if (cachedProfile) {
        cachedPoints = cachedProfile.points || 0;
        animateCountUp(pointsCardNum, cachedPoints);
        updateProgressionUI(cachedPoints);
        if (rankEl) {
          const progression = calculateProgression(cachedPoints);
          rankEl.textContent = progression.levelName;
        }
      }
    } catch (e) {
      console.warn("Failed to parse cached profile for dashboard:", e);
    }
  }

  // Load cached stats to prevent visual flashing
  const cachedTotal = localStorage.getItem('cc_user_stat_total');
  const cachedResolved = localStorage.getItem('cc_user_stat_resolved');
  const cachedActive = localStorage.getItem('cc_user_stat_active');

  if (totalEl && cachedTotal !== null) animateCountUp(totalEl, parseInt(cachedTotal) || 0);
  if (resolvedEl && cachedResolved !== null) animateCountUp(resolvedEl, parseInt(cachedResolved) || 0);
  if (activeEl && cachedActive !== null) animateCountUp(activeEl, parseInt(cachedActive) || 0);

  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (!user) {
    if (!cachedProfileStr) {
      animateCountUp(pointsCardNum, 0);
      updateProgressionUI(0);
      if (rankEl) rankEl.textContent = '-';
      if (totalEl) animateCountUp(totalEl, 0);
      if (resolvedEl) animateCountUp(resolvedEl, 0);
      if (activeEl) animateCountUp(activeEl, 0);
    }
    return;
  }

  const token = typeof getAuthToken === 'function' ? getAuthToken() : null;
  if (!token) return;

  let freshPoints = cachedPoints;
  try {
    const response = await fetch('/api/auth/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
      const profile = await response.json();
      freshPoints = profile.points || 0;
      animateCountUp(pointsCardNum, freshPoints);
      updateProgressionUI(freshPoints);
      if (rankEl) {
        const progression = calculateProgression(freshPoints);
        rankEl.textContent = progression.levelName;
      }
      // Cache profile
      localStorage.setItem('cc_user_profile', JSON.stringify(profile));
    }
  } catch (err) {
    console.error('Failed to load user stats for dashboard:', err);
  }

  // Fetch user's issues to compute accurate stats from logged-in user data
  try {
    if (window.API && typeof window.API.getIssues === 'function') {
      const { data: userIssues, error: issuesError } = await window.API.getIssues({ reporter_id: user.id });
      if (!issuesError && userIssues) {
        lastUserIssues = userIssues;
        const total = userIssues.length;
        const resolved = userIssues.filter(i => i.status === 'resolved' || i.status === 'verified').length;
        const active = userIssues.filter(i => i.status === 'pending' || i.status === 'assigned' || i.status === 'in_progress').length;

        if (totalEl) animateCountUp(totalEl, total);
        if (resolvedEl) animateCountUp(resolvedEl, resolved);
        if (activeEl) animateCountUp(activeEl, active);

        // Update resolved rate badge dynamically
        const rateEl = document.getElementById('stat-resolved-rate');
        if (rateEl) {
          const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
          const tRate = window.i18n ? window.i18n.t('rate_suffix') : 'Rate';
          rateEl.textContent = total > 0 ? `${rate}% ${tRate}` : '';
        }

        // Update hero description with real stats
        const heroDesc = document.getElementById('hero-desc');
        if (heroDesc) {
          if (total === 0) {
            heroDesc.textContent = window.i18n ? window.i18n.t('hero_desc_default') : 'Start reporting civic issues in your area. Every report builds a more responsive city for everyone.';
          } else {
            if (window.i18n) {
              heroDesc.textContent = window.i18n.t('hero_desc_stats', {
                total: total,
                s: total !== 1 ? 's' : '',
                resolved: resolved
              });
            } else {
              heroDesc.textContent = `You have submitted ${total} report${total !== 1 ? 's' : ''} with ${resolved} resolved. Every report builds a more responsive city for everyone.`;
            }
          }
        }

        localStorage.setItem('cc_user_stat_total', total.toString());
        localStorage.setItem('cc_user_stat_resolved', resolved.toString());
        localStorage.setItem('cc_user_stat_active', active.toString());

        renderRecentComplaints(userIssues);
      }
    }
  } catch (err) {
    console.error('Failed to load user issues stats for dashboard:', err);
  }
}


// Fetch and draw issues list
async function loadAndRenderIssues() {
  const listContainer = document.getElementById('issues-list');
  if (!listContainer) return;

  try {
    isLoadingIssues = true;
    // Remove any stale GPS alerts
    const staleAlert = document.getElementById('gps-warning-alert');
    if (staleAlert) staleAlert.remove();

    listContainer.innerHTML = `
          <div class="stitch-item-card" style="cursor: default; pointer-events: none; height: 86px; box-sizing: border-box; border: 1px solid var(--border-color);">
            <div class="skeleton skeleton-avatar" style="width: 42px; height: 42px; border-radius: var(--radius-md); flex-shrink: 0;"></div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
              <div class="skeleton skeleton-title" style="width: 50%; height: 1.0rem; margin: 0; border-radius: var(--radius-sm);"></div>
              <div class="skeleton skeleton-text" style="width: 30%; height: 0.75rem; margin: 0; border-radius: var(--radius-sm);"></div>
            </div>
          </div>
          <div class="stitch-item-card" style="cursor: default; pointer-events: none; height: 86px; box-sizing: border-box; border: 1px solid var(--border-color);">
            <div class="skeleton skeleton-avatar" style="width: 42px; height: 42px; border-radius: var(--radius-md); flex-shrink: 0;"></div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
              <div class="skeleton skeleton-title" style="width: 60%; height: 1.0rem; margin: 0; border-radius: var(--radius-sm);"></div>
              <div class="skeleton skeleton-text" style="width: 40%; height: 0.75rem; margin: 0; border-radius: var(--radius-sm);"></div>
            </div>
          </div>
          <div class="stitch-item-card" style="cursor: default; pointer-events: none; height: 86px; box-sizing: border-box; border: 1px solid var(--border-color);">
            <div class="skeleton skeleton-avatar" style="width: 42px; height: 42px; border-radius: var(--radius-md); flex-shrink: 0;"></div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
              <div class="skeleton skeleton-title" style="width: 45%; height: 1.0rem; margin: 0; border-radius: var(--radius-sm);"></div>
              <div class="skeleton skeleton-text" style="width: 25%; height: 0.75rem; margin: 0; border-radius: var(--radius-sm);"></div>
            </div>
          </div>
    `;

    const sortBy = (activeFeedTab === 'trending') ? 'popularity' : 'newest';

    if (!window.API) {
      throw new Error("window.API is undefined");
    }

    const { data: issues, error } = await window.API.getIssues({
      category: activeCategory,
      status: activeStatus,
      sort_by: sortBy
    });

    if (error || !issues) {
      isLoadingIssues = false;
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 0.5rem; color: #ef4444;"></i>
          <p>Failed to load issues: ${error || 'Unknown error'}</p>
          <button onclick="loadAndRenderIssues()" class="btn btn-secondary" style="margin-top: 1rem; font-size: 0.85rem;">Try Again</button>
        </div>
      `;
      return;
    }

    currentIssues = issues;
    
    // Calculate and render Community Insights dynamically
    updateCommunityInsights(currentIssues);
    
    // Update Civic Intelligence Feed dynamically with real data
    updateCivicIntelligenceFeed(currentIssues);

    try {
      renderCommunityActivity(currentIssues);
    } catch (e) {
      console.error("Failed to render community activity:", e);
    }

    isLoadingIssues = false;
    await processAndRenderFeed();
  } catch (err) {
    isLoadingIssues = false;
    console.error("Failed to load and render issues:", err);
    listContainer.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 0.5rem; color: #ef4444;"></i>
        <p>Failed to load issues: ${err.message || 'Unknown error'}</p>
        <button onclick="loadAndRenderIssues()" class="btn btn-secondary" style="margin-top: 1rem; font-size: 0.85rem;">Try Again</button>
      </div>
    `;
  }
}

// Helper to get category icon
function getCategoryIcon(category) {
  const mapping = {
    roads: 'fa-road',
    pothole: 'fa-road',
    road: 'fa-road',
    streetlights: 'fa-lightbulb',
    streetlight: 'fa-lightbulb',
    water_supply: 'fa-droplet',
    leakage: 'fa-droplet',
    drainage: 'fa-water',
    garbage: 'fa-trash-can',
    traffic: 'fa-car',
    public_property: 'fa-building',
    parks: 'fa-tree',
    sanitation: 'fa-soap',
    safety_hazard: 'fa-triangle-exclamation',
    environment: 'fa-leaf',
    other: 'fa-circle-info'
  };
  const key = (category || 'other').toLowerCase().trim();
  return mapping[key] || 'fa-circle-info';
}

// Render issues feed sidebar list
function renderFeedList(issues) {
  const listContainer = document.getElementById('issues-list');
  if (!listContainer) return;

  if (issues.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align: center; padding: 3.5rem 1.5rem; color: var(--text-muted); border: 1px solid var(--border-color); border-radius: var(--radius-lg); background-color: var(--bg-surface);">
        <i class="fa-solid fa-clipboard-list" style="font-size: 2.5rem; margin-bottom: 1rem; color: var(--text-muted); opacity: 0.6;"></i>
        <p style="font-weight: 700; color: var(--text-main); font-size: 1rem; margin-bottom: 0.25rem;">No active reports found</p>
        <p style="font-size: 0.85rem; max-width: 320px; margin: 0 auto; line-height: 1.4;">There are no active municipal issues or cases matching the selected filter criteria.</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = issues.map(issue => {
    const timeAgo = formatTimeAgo(new Date(issue.created_at));
    const upvotedClass = (issue.user_has_upvoted || localStorage.getItem(`voted-${issue.id}`)) ? 'upvoted' : '';
    const categoryIcon = getCategoryIcon(issue.category);
    const categoryName = window.formatCategoryName(issue.category);
    const voteColor = upvotedClass ? 'var(--primary)' : 'var(--text-muted)';

    const isEmergency = issue.is_emergency;
    const emergencyBadge = isEmergency ? `<span class="stitch-badge" style="background-color: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); font-weight: 800; font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.25rem; margin-bottom: 0.25rem; animation: pulse-red 1.5s infinite;"><i class="fa-solid fa-triangle-exclamation" style="font-size: 0.7rem;"></i> EMERGENCY</span>` : '';

    return `
      <div class="stitch-item-card ${isEmergency ? 'emergency-card-glow' : ''}" onclick="window.location.href='issue-details.html?id=${issue.id}'">
        <div class="stitch-item-icon">
          <i class="fa-solid ${categoryIcon}"></i>
        </div>
        <div class="stitch-item-details">
          <div class="stitch-item-title">${escapeHTML(issue.title)}</div>
          <div class="stitch-item-meta">
            ${timeAgo} &bull; ${categoryName}
          </div>
          <div style="display: flex; gap: 0.75rem; margin-top: 0.25rem; font-size: 0.75rem; align-items: center; flex-wrap: wrap;">
            <span style="color: ${voteColor}; cursor: pointer; font-weight: 700;" onclick="event.stopPropagation(); toggleUpvote('${issue.id}')" id="vote-btn-${issue.id}">
              <i class="fa-solid fa-thumbs-up"></i> <span id="vote-count-${issue.id}">${issue.upvotes_count || 0}</span> Upvotes
            </span>
            <span style="color: var(--text-muted);"><i class="fa-solid fa-location-dot"></i> ${escapeHTML(issue.address || 'Location detected')}</span>
            ${issue.distance !== undefined ? `<span style="font-weight: 700; color: var(--primary);"><i class="fa-solid fa-location-arrow"></i> ${issue.distance.toFixed(1)} km away</span>` : ''}
          </div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem;">
          ${emergencyBadge}
          <span class="stitch-badge ${issue.status}">${issue.status.replace('_', ' ')}</span>
        </div>
      </div>
    `;
  }).join('');
}

// Compute live metrics client-side from the complete data feed
function calculateSidebarStats(issues) {
  // Deprecated: Sidebar stats are now loaded for the logged-in citizen only via loadUserStats()
}

// Handle Upvote action
async function toggleUpvote(id) {
  if (typeof getCurrentUser === 'function' && !getCurrentUser()) {
    window.showToast("You must be logged in to upvote civic issues.", "warning");
    window.authRouter.redirectToLogin('citizen');
    return;
  }

  const voteBtn = document.getElementById(`vote-btn-${id}`);
  const countSpan = document.getElementById(`vote-count-${id}`);
  if (!voteBtn || !countSpan) return;
  
  voteBtn.disabled = true;
  
  const { data, error } = await window.API.upvoteIssue(id);
  
  voteBtn.disabled = false;

  if (error) {
    console.error("Upvote failed:", error);
    return;
  }

  if (data.upvoted !== undefined) {
    if (data.upvoted) {
      voteBtn.classList.add('upvoted');
      localStorage.setItem(`voted-${id}`, 'true');
    } else {
      voteBtn.classList.remove('upvoted');
      localStorage.removeItem(`voted-${id}`);
    }
  }

  if (data.upvotes_count !== undefined) {
    countSpan.textContent = data.upvotes_count;
  } else if (data.upvoted !== undefined) {
    let val = parseInt(countSpan.textContent);
    countSpan.textContent = data.upvoted ? val + 1 : Math.max(0, val - 1);
  }
}

// Helper to keep Feed Tabs and Status Pills UI in sync
function syncFilterUI() {
  const feedContainer = document.getElementById('feed-tabs-container');
  if (feedContainer) {
    feedContainer.querySelectorAll('.feed-tab').forEach(btn => {
      if (btn.dataset.feed === activeFeedTab) {
        btn.classList.add('active');
        btn.style.background = 'var(--primary-light-alpha)';
        btn.style.color = 'var(--primary)';
      } else {
        btn.classList.remove('active');
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text-muted)';
      }
    });
  }

  const statusContainer = document.getElementById('status-filters');
  if (statusContainer) {
    statusContainer.querySelectorAll('.filter-pill').forEach(pill => {
      if (pill.dataset.status === activeStatus) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });
  }
}

// Set up category and status listeners
function setupFilterListeners() {
  const categoryFilters = document.getElementById('category-filters');
  const statusFilters = document.getElementById('status-filters');

  if (categoryFilters) {
    categoryFilters.addEventListener('click', async (e) => {
      const pill = e.target.closest('.filter-pill');
      if (!pill) return;

      categoryFilters.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      activeCategory = pill.dataset.category;
      await loadAndRenderIssues();
    });
  }

  if (statusFilters) {
    statusFilters.addEventListener('click', async (e) => {
      const pill = e.target.closest('.filter-pill');
      if (!pill) return;

      const newStatus = pill.dataset.status;
      if (newStatus === 'resolved') {
        activeFeedTab = 'resolved';
      } else if (activeFeedTab === 'resolved') {
        activeFeedTab = 'recent';
      }

      activeStatus = newStatus;
      syncFilterUI();
      await loadAndRenderIssues();
    });
  }
}

// Setup search bar listener
function setupSearchListener() {
  const searchInput = document.getElementById('search-input');

  const onSearchInput = () => {
    processAndRenderFeed();
  };

  if (searchInput) {
    searchInput.addEventListener('input', onSearchInput);
  }
}

// Simple time formatter helper
function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) {
    if (interval === 1) return window.i18n ? window.i18n.t('time_yesterday') : "Yesterday";
    return window.i18n ? window.i18n.t('time_days_ago', { days: interval }) : `${interval}d ago`;
  }
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) {
    return window.i18n ? window.i18n.t('time_hours_ago', { hours: interval }) : `${interval}h ago`;
  }
  interval = Math.floor(seconds / 60);
  if (interval >= 1) {
    return window.i18n ? window.i18n.t('time_mins_ago', { mins: interval }) : `${interval}m ago`;
  }
  return window.i18n ? window.i18n.t('time_just_now') : "Just now";
}


// Escapes raw HTML to prevent injection
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

// Re-evaluate filters and reload when auth changes
window.addEventListener('auth-change', async () => {
  try {
    updateHeroGreeting();
  } catch (e) {
    console.error("Failed to update greeting on auth change:", e);
  }
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const currentUserId = user ? user.id : null;
  
  if (currentUserId === lastLoadedUserIdApp) {
    // Avoid duplicate loads that cause UI flickering
    return;
  }
  
  lastLoadedUserIdApp = currentUserId;

  await Promise.all([
    loadAndRenderIssues().catch(err => console.error("Error updating issues on auth change:", err)),
    loadUserStats().catch(err => console.error("Error updating user stats on auth change:", err))
  ]);

  initRealtimeDashboard();
});

function initRealtimeDashboard() {
  if (appRealtimeChannel) {
    const client = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (client) {
      client.removeChannel(appRealtimeChannel);
    }
    appRealtimeChannel = null;
  }

  if (!window.API || typeof window.API.subscribeRealtime !== 'function') return;

  appRealtimeChannel = window.API.subscribeRealtime({
    channelName: 'public:issues_dashboard',
    events: [
      { event: 'INSERT', table: 'issues' },
      { event: 'UPDATE', table: 'issues' }
    ],
    onEvent: (event, payload) => {
      console.log(`[Dashboard Realtime] Event ${event} received.`, payload);
      if (window.showToast) {
        if (event === 'INSERT') {
          window.showToast(window.i18n ? window.i18n.t('toast_new_complaint') || 'New civic complaint reported in your city!' : 'New civic complaint reported in your city!', 'info');
        } else if (event === 'UPDATE') {
          window.showToast(window.i18n ? window.i18n.t('toast_complaint_updated') || 'A complaint status was updated.' : 'A complaint status was updated.', 'info');
        } else if (event === 'RECONNECT') {
          // Automatic reconnect already notifies, just sync
        }
      }
      // Re-fetch issues and telemetry without reloading page
      loadAndRenderIssues().catch(err => console.error("Error refreshing issues on realtime update:", err));
      loadUserStats().catch(err => console.error("Error refreshing user stats on realtime update:", err));
    }
  });
}

// Initialize when both window is ready (using readystate check to prevent DOMContentLoaded race condition)
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    initDashboard();
  });
} else {
  initDashboard();
}

// Citizen Progression & Smart Feed Helpers
function calculateProgression(points) {
  let level = 1;
  let levelName = "Civic Novice";
  let pointsRemaining = points;
  let xpNeeded = 150;

  const levelNames = ["", "Civic Novice", "Local Watchdog", "Civic Leader", "City Legend"];
  const levelKeys = ["", "level_civic_novice", "level_local_watchdog", "level_civic_leader", "level_city_legend"];

  while (true) {
    let neededForNext = level * 150;
    if (pointsRemaining >= neededForNext) {
      pointsRemaining -= neededForNext;
      level += 1;
      xpNeeded = (level * 150);
      const levelKey = levelKeys[level];
      if (window.i18n && typeof window.i18n.t === 'function' && levelKey) {
        levelName = window.i18n.t(levelKey);
      } else {
        const fallbackPattern = window.i18n ? window.i18n.t('level_hero_abbr', { level: level }) : `City Hero (Lvl ${level})`;
        levelName = levelNames[level] || fallbackPattern;
      }
    } else {
      xpNeeded = neededForNext;
      break;
    }
  }

  const percent = Math.min(100, Math.floor((pointsRemaining / xpNeeded) * 100));

  return {
    level,
    levelName,
    xpCurrent: pointsRemaining,
    xpNeeded,
    percent
  };
}

function updateProgressionUI(points) {
  const levelNameEl = document.getElementById('progression-level-name');
  const xpTextEl = document.getElementById('progression-xp-text');
  const xpBarEl = document.getElementById('progression-xp-bar');
  
  if (!levelNameEl || !xpTextEl || !xpBarEl) return;
  
  const progression = calculateProgression(points);
  levelNameEl.textContent = `Rank ${progression.level}: ${progression.levelName}`;
  xpTextEl.textContent = `${progression.xpCurrent} / ${progression.xpNeeded} Points`;
  xpBarEl.style.width = `${progression.percent}%`;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

function getUserCoordinates() {
  return new Promise((resolve, reject) => {
    if (cachedUserCoords) {
      resolve(cachedUserCoords);
      return;
    }

    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        cachedUserCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        resolve(cachedUserCoords);
      },
      (err) => {
        reject(err);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

function showGeolocationWarning() {
  const listContainer = document.getElementById('issues-list');
  if (!listContainer || document.getElementById('gps-warning-alert')) return;

  const warnContainer = document.createElement('div');
  warnContainer.id = 'gps-warning-alert';
  warnContainer.style = "background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); color: #d97706; padding: 0.75rem 1rem; border-radius: var(--radius-md); font-size: 0.8rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; width: 100%; box-sizing: border-box;";
  warnContainer.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Location permission denied. Sorting from city center (default).`;
  
  listContainer.parentNode.insertBefore(warnContainer, listContainer);

  const coords = { latitude: 11.0168, longitude: 76.9558 }; // default central coordinates
  let filtered = [...currentIssues];
  filtered.forEach(i => {
    i.distance = calculateDistance(coords.latitude, coords.longitude, i.latitude, i.longitude);
  });
  filtered.sort((a, b) => a.distance - b.distance);
  renderFeedList(filtered);
}

function setupFeedTabs() {
  const container = document.getElementById('feed-tabs-container');
  if (!container) return;

  container.addEventListener('click', async (e) => {
    const tab = e.target.closest('.feed-tab');
    if (!tab) return;

    const newFeed = tab.dataset.feed;
    const oldStatus = activeStatus;

    if (newFeed === 'resolved') {
      activeStatus = 'resolved';
    } else if (activeStatus === 'resolved') {
      activeStatus = '';
    }

    activeFeedTab = newFeed;
    syncFilterUI();
    
    if (activeStatus !== oldStatus) {
      await loadAndRenderIssues();
    } else {
      await processAndRenderFeed();
    }
  });
}

async function processAndRenderFeed() {
  const listContainer = document.getElementById('issues-list');
  if (!listContainer) return;

  // Remove any stale GPS alerts
  const staleAlert = document.getElementById('gps-warning-alert');
  if (staleAlert) staleAlert.remove();

  if (isLoadingIssues) {
    listContainer.innerHTML = `
          <div class="stitch-item-card" style="cursor: default; pointer-events: none; height: 86px; box-sizing: border-box; border: 1px solid var(--border-color);">
            <div class="skeleton skeleton-avatar" style="width: 42px; height: 42px; border-radius: var(--radius-md); flex-shrink: 0;"></div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
              <div class="skeleton skeleton-title" style="width: 50%; height: 1.0rem; margin: 0; border-radius: var(--radius-sm);"></div>
              <div class="skeleton skeleton-text" style="width: 30%; height: 0.75rem; margin: 0; border-radius: var(--radius-sm);"></div>
            </div>
          </div>
          <div class="stitch-item-card" style="cursor: default; pointer-events: none; height: 86px; box-sizing: border-box; border: 1px solid var(--border-color);">
            <div class="skeleton skeleton-avatar" style="width: 42px; height: 42px; border-radius: var(--radius-md); flex-shrink: 0;"></div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
              <div class="skeleton skeleton-title" style="width: 60%; height: 1.0rem; margin: 0; border-radius: var(--radius-sm);"></div>
              <div class="skeleton skeleton-text" style="width: 40%; height: 0.75rem; margin: 0; border-radius: var(--radius-sm);"></div>
            </div>
          </div>
          <div class="stitch-item-card" style="cursor: default; pointer-events: none; height: 86px; box-sizing: border-box; border: 1px solid var(--border-color);">
            <div class="skeleton skeleton-avatar" style="width: 42px; height: 42px; border-radius: var(--radius-md); flex-shrink: 0;"></div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
              <div class="skeleton skeleton-title" style="width: 45%; height: 1.0rem; margin: 0; border-radius: var(--radius-sm);"></div>
              <div class="skeleton skeleton-text" style="width: 25%; height: 0.75rem; margin: 0; border-radius: var(--radius-sm);"></div>
            </div>
          </div>
    `;
    return;
  }

  let filtered = [...currentIssues];

  // 1. Search term filter
  const searchInput = document.getElementById('search-input');
  const term = searchInput ? searchInput.value.toLowerCase().trim() : '';
  if (term) {
    filtered = filtered.filter(i => 
      i.title.toLowerCase().includes(term) ||
      i.description.toLowerCase().includes(term) ||
      i.category.toLowerCase().includes(term) ||
      (i.address && i.address.toLowerCase().includes(term))
    );
  }

  // 2. Tab filter
  if (activeFeedTab === 'resolved') {
    filtered = filtered.filter(i => i.status === 'resolved' || i.status === 'verified');
  }

  // 3. Tab sorting
  if (activeFeedTab === 'trending') {
    filtered.sort((a, b) => (b.upvotes_count || 0) - (a.upvotes_count || 0));
  } else if (activeFeedTab === 'nearby') {
    try {
      const coords = await getUserCoordinates();
      if (coords) {
        filtered.forEach(i => {
          i.distance = calculateDistance(coords.latitude, coords.longitude, i.latitude, i.longitude);
        });
        filtered.sort((a, b) => a.distance - b.distance);
      } else {
        showGeolocationWarning();
        return;
      }
    } catch (err) {
      console.warn("Geolocation failed, falling back:", err);
      showGeolocationWarning();
      return;
    }
  } else {
    // default recent
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  renderFeedList(filtered);
}
async function loadRecentNotifications() {
  const container = document.getElementById('compact-notifications-list') || document.getElementById('sidebar-notifications-list');
  if (!container) return;

  // Render from cache first if available
  const cachedNotifications = localStorage.getItem('cc_recent_notifications');
  if (cachedNotifications) {
    try {
      const notifications = JSON.parse(cachedNotifications);
      renderRecentNotificationsHTML(container, notifications);
    } catch (e) {
      console.warn("Failed to parse cached notifications:", e);
    }
  }

  try {
    if (!window.API || typeof window.API.getNotifications !== 'function') {
      return;
    }
    const { data: notifications, error } = await window.API.getNotifications();
    if (error || !notifications) {
      if (!cachedNotifications) {
        container.innerHTML = `
          <div style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 1.5rem 0; display: flex; flex-direction: column; gap: 0.25rem;">
            <span style="font-weight: 600; color: var(--text-main);">No recent notifications</span>
            <span>System monitoring active</span>
          </div>
        `;
      }
      return;
    }

    // Cache the result
    localStorage.setItem('cc_recent_notifications', JSON.stringify(notifications));

    renderRecentNotificationsHTML(container, notifications);
  } catch (err) {
    console.error("Failed to load notifications:", err);
    if (!cachedNotifications) {
      container.innerHTML = `
        <div style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 1.5rem 0; display: flex; flex-direction: column; gap: 0.25rem;">
          <span style="font-weight: 600; color: var(--text-main);">No recent notifications</span>
          <span>System monitoring active</span>
        </div>
      `;
    }
  }
}

function renderRecentNotificationsHTML(container, notifications) {
  const unread = notifications.filter(n => !n.is_read).slice(0, 3);
  if (unread.length === 0) {
    container.innerHTML = `
      <div style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 1.5rem 0; display: flex; flex-direction: column; gap: 0.25rem;">
        <span style="font-weight: 600; color: var(--text-main);">No recent notifications</span>
        <span>System monitoring active</span>
      </div>
    `;
    return;
  }

  container.innerHTML = unread.map(n => {
    const dateStr = formatTimeAgo(new Date(n.created_at));
    return `
      <div style="padding: 0.75rem; background: var(--bg-surface-hover); border: 1px solid var(--border-color); border-radius: var(--radius-md); font-size: 0.78rem; display: flex; flex-direction: column; gap: 0.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
          <strong style="color: var(--text-main); font-weight: 700; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(n.title)}</strong>
          <span style="font-size: 0.7rem; color: var(--text-muted); white-space: nowrap;">${dateStr}</span>
        </div>
        <p style="color: var(--text-muted); margin: 0; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${escapeHTML(n.message)}</p>
      </div>
    `;
  }).join('');
}

function updateCommunityInsights(issues) {
  const container = document.getElementById('community-insights-grid');
  if (!container) return;

  const totalCount = issues.length;
  const resolvedCount = issues.filter(i => i.status === 'resolved' || i.status === 'verified').length;
  const activeCount = issues.filter(i => i.status === 'pending' || i.status === 'assigned' || i.status === 'in_progress').length;
  const roadCount = issues.filter(i => i.category === 'roads' && i.status !== 'resolved' && i.status !== 'verified').length;
  const streetlightCount = issues.filter(i => i.category === 'streetlights' && i.status !== 'resolved' && i.status !== 'verified').length;
  
  const resolutionRate = totalCount > 0 ? ((resolvedCount / totalCount) * 100).toFixed(0) : '0';

  container.innerHTML = `
    <div class="glass-card" style="padding: 1rem; border-radius: var(--radius-md); border-left: 3px solid #6366f1; display: flex; flex-direction: column; gap: 0.25rem; justify-content: flex-start; min-height: 85px;">
      <span style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Active Pipeline</span>
      <p style="font-size: 0.82rem; font-weight: 600; color: var(--text-main); line-height: 1.35; margin: 0;">${activeCount} reports currently under municipal processing.</p>
    </div>
    <div class="glass-card" style="padding: 1rem; border-radius: var(--radius-md); border-left: 3px solid #10b981; display: flex; flex-direction: column; gap: 0.25rem; justify-content: flex-start; min-height: 85px;">
      <span style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Resolution Rate</span>
      <p style="font-size: 0.82rem; font-weight: 600; color: var(--text-main); line-height: 1.35; margin: 0;">${resolutionRate}% of all logged issues successfully resolved.</p>
    </div>
    <div class="glass-card" style="padding: 1rem; border-radius: var(--radius-md); border-left: 3px solid #f59e0b; display: flex; flex-direction: column; gap: 0.25rem; justify-content: flex-start; min-height: 85px;">
      <span style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Road Reports</span>
      <p style="font-size: 0.82rem; font-weight: 600; color: var(--text-main); line-height: 1.35; margin: 0;">${roadCount} active road hazard reports require attention.</p>
    </div>
    <div class="glass-card" style="padding: 1rem; border-radius: var(--radius-md); border-left: 3px solid #ef4444; display: flex; flex-direction: column; gap: 0.25rem; justify-content: flex-start; min-height: 85px;">
      <span style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Streetlights Out</span>
      <p style="font-size: 0.82rem; font-weight: 600; color: var(--text-main); line-height: 1.35; margin: 0;">${streetlightCount} active streetlight outage reports logged.</p>
    </div>
  `;
}

function updateCivicIntelligenceFeed(issues) {
  const feedTextEl = document.getElementById('civic-intelligence-feed-text');
  if (!feedTextEl) return;

  const resolvedIssues = issues.filter(i => i.status === 'resolved' || i.status === 'verified');
  if (resolvedIssues.length > 0) {
    resolvedIssues.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const latestResolved = resolvedIssues[0];
    const categoryName = window.formatCategoryName ? window.formatCategoryName(latestResolved.category) : latestResolved.category;
    if (window.i18n) {
      feedTextEl.innerHTML = window.i18n.t('recently_resolved_ticker', {
        title: escapeHTML(latestResolved.title),
        category: categoryName,
        address: escapeHTML(latestResolved.address || 'location')
      });
    } else {
      feedTextEl.innerHTML = `Recently resolved: "<strong>${escapeHTML(latestResolved.title)}</strong>" (${categoryName}) at ${escapeHTML(latestResolved.address || 'location')}.`;
    }
  } else {
    feedTextEl.textContent = window.i18n ? window.i18n.t('operational_ticker') : 'All municipal services are operational. Check the feed below for community reports.';
  }
}

// Update greeting dynamically based on local hours and user name
function updateHeroGreeting() {
  const heroGreeting = document.getElementById('hero-greeting');
  if (!heroGreeting) return;

  const hour = new Date().getHours();
  let greetingKey = 'hero_greeting_evening';
  let greeting = 'Good Evening';
  if (hour >= 5 && hour < 12) {
    greetingKey = 'hero_greeting_morning';
    greeting = 'Good Morning';
  } else if (hour >= 12 && hour < 17) {
    greetingKey = 'hero_greeting_afternoon';
    greeting = 'Good Afternoon';
  }

  const defaultCitizen = window.i18n ? window.i18n.t('role_citizen') : 'Citizen';
  let fullName = defaultCitizen;
  const profileStr = localStorage.getItem('cc_user_profile');
  if (profileStr) {
    try {
      const profile = JSON.parse(profileStr);
      if (profile && profile.full_name) {
        fullName = profile.full_name;
      }
    } catch (e) {
      console.warn("Failed to parse cached profile for greeting:", e);
    }
  } else {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (user && user.user_metadata && user.user_metadata.full_name) {
      fullName = user.user_metadata.full_name;
    }
  }

  const safeName = `<span class="user-greeting-name">${escapeHTML(fullName)}</span>`;
  if (window.i18n) {
    heroGreeting.innerHTML = window.i18n.t(greetingKey, { name: safeName });
  } else {
    heroGreeting.innerHTML = `${escapeHTML(greeting)}, ${safeName}`;
  }

  // Also set the hero description if it hasn't been populated yet by loadUserStats
  const heroDesc = document.getElementById('hero-desc');
  if (heroDesc && !heroDesc.textContent) {
    heroDesc.textContent = window.i18n ? window.i18n.t('hero_desc_default') : 'Your civic reports help build a more responsive city for everyone.';
  }
}

// Render user's recent complaints table
function renderRecentComplaints(userIssues) {
  const tbody = document.getElementById('recent-complaints-tbody');
  if (!tbody) return;

  if (!userIssues || userIssues.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="padding: 24px; text-align: center; color: var(--text-muted);">
          No complaints submitted yet.
        </td>
      </tr>
    `;
    return;
  }

  // Sort by created_at descending and take top 5
  const sorted = [...userIssues].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

  tbody.innerHTML = sorted.map(issue => {
    const statusText = issue.status.replace('_', ' ');
    const createdDate = new Date(issue.created_at).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
    const categoryName = window.formatCategoryName ? window.formatCategoryName(issue.category) : issue.category;
    
    return `
      <tr style="border-bottom: 1px solid var(--border-color); cursor: pointer;" onclick="window.location.href='issue-details.html?id=${issue.id}'">
        <td style="padding: 12px 16px; font-weight: 600; color: var(--text-main);">${escapeHTML(issue.title)}</td>
        <td style="padding: 12px 16px; color: var(--text-muted);">${escapeHTML(categoryName)}</td>
        <td style="padding: 12px 16px;">
          <span class="badge badge-status ${issue.status}">${statusText}</span>
        </td>
        <td style="padding: 12px 16px; color: var(--text-muted);">${createdDate}</td>
      </tr>
    `;
  }).join('');
}

// Render community activity timeline
function renderCommunityActivity(issues) {
  const container = document.getElementById('community-activity-timeline');
  if (!container) return;

  if (!issues || issues.length === 0) {
    container.innerHTML = `
      <div style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem 0; text-align: center;">
        No recent community activity.
      </div>
    `;
    return;
  }

  // Sort all issues by created_at descending and get top 4
  const sorted = [...issues].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 4);

  container.innerHTML = sorted.map(issue => {
    const timeAgoStr = formatTimeAgo(new Date(issue.created_at));
    const categoryName = window.formatCategoryName ? window.formatCategoryName(issue.category) : issue.category;
    let dotColor = 'var(--border-color)';
    let actionText = '';
    
    if (issue.status === 'resolved' || issue.status === 'verified') {
      dotColor = '#10b981'; // emerald
      actionText = `Resolved: ${escapeHTML(issue.title)}`;
    } else if (issue.status === 'in_progress' || issue.status === 'assigned') {
      dotColor = '#d97706'; // amber
      actionText = `In Progress: ${escapeHTML(issue.title)}`;
    } else {
      dotColor = 'var(--text-muted)'; // neutral
      actionText = `Reported: ${escapeHTML(issue.title)}`;
    }

    return `
      <div style="position: relative;">
        <span style="position: absolute; left: -25px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: ${dotColor}; border: 2px solid var(--bg-surface); box-shadow: 0 0 0 1px var(--border-color);"></span>
        <div style="display: flex; flex-direction: column; gap: 0.15rem; cursor: pointer;" onclick="window.location.href='issue-details.html?id=${issue.id}'">
          <span style="font-size: 0.82rem; font-weight: 600; color: var(--text-main);">${actionText}</span>
          <span style="font-size: 0.72rem; color: var(--text-muted);">${categoryName} • ${timeAgoStr}</span>
        </div>
      </div>
    `;
  }).join('');
}

window.addEventListener('language-change', () => {
  updateHeroGreeting();
  loadUserStats(true);
  
  if (currentIssues && currentIssues.length > 0) {
    updateCommunityInsights(currentIssues);
    updateCivicIntelligenceFeed(currentIssues);
    try {
      renderCommunityActivity(currentIssues);
    } catch (e) {
      console.error(e);
    }
    processAndRenderFeed();
  }

  if (window.i18n) {
    window.i18n.translatePage();
  }
});

