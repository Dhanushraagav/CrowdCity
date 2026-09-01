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

// ─── Load guards: prevent duplicate/rapid concurrent data fetches ────────────
// These track the last time each data set was successfully fetched.
// A realtime RECONNECT or auth-change will not re-fetch if a fetch already
// happened within the last 8 seconds, eliminating the infinite retry loop.
let _lastIssuesFetchAt = 0;
let _lastStatsFetchAt = 0;
let _lastNotifFetchAt = 0;
const _FETCH_COOLDOWN_MS = 8000;


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

let _dashboardInitialized = false;

// Initialize the dashboard components
function initDashboard() {
  if (_dashboardInitialized) return;
  _dashboardInitialized = true;

  try { updateHeroGreeting(); } catch (e) {}
  try { setupFilterListeners(); } catch (e) {}
  try { setupSearchListener(); } catch (e) {}
  try { setupFeedTabs(); } catch (e) {}

  // 0ms instant news ticker startup!
  try { updateCivicIntelligenceFeed([]); } catch (e) {}
  
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  lastLoadedUserIdApp = user ? (user.id || user.sub) : null;
  
  // Show body immediately to display page shell
  document.body.classList.add('ready');
  document.body.style.visibility = 'visible';

  // Render initial cached stats instantly with 0ms delay
  try { loadUserStats(); } catch (e) {}

  // Load initial datasets from real database and refresh stats
  loadAndRenderIssues().then(() => {
    try { loadUserStats(); } catch (e) {}
  }).catch(err => console.error("Error in loadAndRenderIssues:", err));

  if (user || localStorage.getItem('cc_session')) {
    loadRecentNotifications().catch(err => console.error("Error in loadRecentNotifications:", err));
  }

  initRealtimeDashboard();
}

// Fetch user profile and compute real database statistics
function loadUserStats(isLanguageChange = false) {
  const totalEl = document.getElementById('stat-total-reports');
  const weeklyEl = document.getElementById('stat-total-reports-change');
  const resolvedEl = document.getElementById('stat-resolved-issues');
  const rateEl = document.getElementById('stat-resolved-rate');
  const inprogressEl = document.getElementById('stat-inprogress-reports');
  const inprogressSubEl = document.getElementById('stat-inprogress-sub');
  const cityTotalEl = document.getElementById('stat-city-total-reports');
  const cityTotalSubEl = document.getElementById('stat-city-total-sub');
  const heroDesc = document.getElementById('hero-desc');

  // Retrieve authenticated user ID
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  let userId = user ? (user.id || user.sub) : null;
  if (!userId) {
    try {
      const sessionStr = localStorage.getItem('cc_session');
      if (sessionStr) {
        const parsed = JSON.parse(sessionStr);
        if (parsed && parsed.user) userId = parsed.user.id || parsed.user.sub;
      }
    } catch (e) {}
  }
  if (!userId) {
    try {
      const profileStr = localStorage.getItem('cc_user_profile');
      if (profileStr) {
        const parsed = JSON.parse(profileStr);
        if (parsed && (parsed.id || parsed.sub)) userId = parsed.id || parsed.sub;
      }
    } catch (e) {}
  }

  // 1. If language changed and we have cached user issues, recalculate text strings
  if (isLanguageChange && lastUserIssues && lastUserIssues.length > 0) {
    const total = lastUserIssues.length;
    const now = Date.now();
    const weeklyCount = lastUserIssues.filter(i => (now - new Date(i.created_at).getTime()) <= 7 * 86400000).length;
    const resolved = lastUserIssues.filter(i => {
      const s = (i.status || '').toLowerCase();
      return s === 'resolved' || s === 'verified' || s === 'closed';
    }).length;
    const active = lastUserIssues.filter(i => {
      const s = (i.status || '').toLowerCase();
      return s === 'pending' || s === 'assigned' || s === 'in_progress';
    }).length;

    const tThisWeek = window.i18n ? window.i18n.t('stat_this_week') : 'this week';
    const tResolutionRate = window.i18n ? window.i18n.t('stat_resolution_rate') : 'Resolution Rate';
    const tActiveReports = window.i18n ? window.i18n.t('stat_active_reports') : 'Active reports';
    const tAllTime = window.i18n ? (window.i18n.t('all_time') || window.i18n.t('stat_all_time')) : 'All time';

    if (totalEl) totalEl.textContent = total.toString();
    if (weeklyEl) weeklyEl.textContent = `+${weeklyCount} ${tThisWeek}`;
    if (resolvedEl) resolvedEl.textContent = resolved.toString();
    if (inprogressEl) inprogressEl.textContent = active.toString();
    if (inprogressSubEl) inprogressSubEl.textContent = tActiveReports;
    if (cityTotalEl) cityTotalEl.textContent = total.toString();
    if (cityTotalSubEl) cityTotalSubEl.textContent = tAllTime;

    if (rateEl) {
      const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
      rateEl.textContent = `${rate}% ${tResolutionRate}`;
    }

    if (heroDesc) {
      if (total === 0) {
        heroDesc.textContent = window.i18n ? window.i18n.t('hero_desc_default') : 'Transforming citizen voices into rapid community action. Report local issues and track live department resolutions.';
      } else {
        if (window.i18n) {
          heroDesc.textContent = window.i18n.t('hero_desc_stats', { total, s: total !== 1 ? 's' : '', resolved });
        } else {
          heroDesc.textContent = `You have submitted ${total} report${total !== 1 ? 's' : ''} with ${resolved} resolved. Every report builds a more responsive city for everyone.`;
        }
      }
    }
    renderRecentComplaints(lastUserIssues);
    return;
  }

  // 2. If issues are loaded in memory, calculate user statistics directly from real database records
  if (Array.isArray(currentIssues) && currentIssues.length > 0 && userId) {
    const userIssues = currentIssues.filter(i => i && (i.reporter_id === userId || i.user_id === userId));
    lastUserIssues = userIssues;
    const total = userIssues.length;
    const now = Date.now();
    const weeklyCount = userIssues.filter(i => (now - new Date(i.created_at).getTime()) <= 7 * 86400000).length;
    const resolved = userIssues.filter(i => {
      const s = (i.status || '').toLowerCase();
      return s === 'resolved' || s === 'verified' || s === 'closed';
    }).length;
    const active = userIssues.filter(i => {
      const s = (i.status || '').toLowerCase();
      return s === 'pending' || s === 'assigned' || s === 'in_progress';
    }).length;

    const tThisWeek = window.i18n ? window.i18n.t('stat_this_week') : 'this week';
    const tResolutionRate = window.i18n ? window.i18n.t('stat_resolution_rate') : 'Resolution Rate';
    const tActiveReports = window.i18n ? window.i18n.t('stat_active_reports') : 'Active reports';
    const tAllTime = window.i18n ? (window.i18n.t('all_time') || window.i18n.t('stat_all_time')) : 'All time';

    if (totalEl) totalEl.textContent = total.toString();
    if (weeklyEl) weeklyEl.textContent = `+${weeklyCount} ${tThisWeek}`;
    if (resolvedEl) resolvedEl.textContent = resolved.toString();
    if (inprogressEl) inprogressEl.textContent = active.toString();
    if (inprogressSubEl) inprogressSubEl.textContent = tActiveReports;
    if (cityTotalEl) cityTotalEl.textContent = total.toString();
    if (cityTotalSubEl) cityTotalSubEl.textContent = tAllTime;

    if (rateEl) {
      const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
      rateEl.textContent = `${rate}% ${tResolutionRate}`;
    }

    if (heroDesc) {
      if (total === 0) {
        heroDesc.textContent = window.i18n ? window.i18n.t('hero_desc_default') : 'Transforming citizen voices into rapid community action. Report local issues and track live department resolutions.';
      } else {
        if (window.i18n) {
          heroDesc.textContent = window.i18n.t('hero_desc_stats', { total, s: total !== 1 ? 's' : '', resolved });
        } else {
          heroDesc.textContent = `You have submitted ${total} report${total !== 1 ? 's' : ''} with ${resolved} resolved. Every report builds a more responsive city for everyone.`;
        }
      }
    }

    localStorage.setItem('cc_user_stat_total', total.toString());
    localStorage.setItem('cc_user_stat_weekly', weeklyCount.toString());
    localStorage.setItem('cc_user_stat_resolved', resolved.toString());
    localStorage.setItem('cc_user_stat_active', active.toString());
    localStorage.setItem('cc_city_stat_total', total.toString());

    renderRecentComplaints(userIssues);
    return;
  }

  // 3. Instant 0ms Cache-First Pre-fill from localStorage (cc_my_complaints_civic / cc_user_stat_*)
  if (userId) {
    try {
      const cachedCivicStr = localStorage.getItem('cc_my_complaints_civic');
      if (cachedCivicStr) {
        const cachedIssues = JSON.parse(cachedCivicStr);
        if (Array.isArray(cachedIssues) && cachedIssues.length > 0) {
          const total = cachedIssues.length;
          const now = Date.now();
          const weeklyCount = cachedIssues.filter(i => (now - new Date(i.created_at).getTime()) <= 7 * 86400000).length;
          const resolved = cachedIssues.filter(i => {
            const s = (i.status || '').toLowerCase();
            return s === 'resolved' || s === 'verified' || s === 'closed';
          }).length;
          const active = cachedIssues.filter(i => {
            const s = (i.status || '').toLowerCase();
            return s === 'pending' || s === 'assigned' || s === 'in_progress';
          }).length;

          const tThisWeek = window.i18n ? window.i18n.t('stat_this_week') : 'this week';
          const tResolutionRate = window.i18n ? window.i18n.t('stat_resolution_rate') : 'Resolution Rate';
          const tActiveReports = window.i18n ? window.i18n.t('stat_active_reports') : 'Active reports';
          const tAllTime = window.i18n ? (window.i18n.t('all_time') || window.i18n.t('stat_all_time')) : 'All time';

          if (totalEl) totalEl.textContent = total.toString();
          if (weeklyEl) weeklyEl.textContent = `+${weeklyCount} ${tThisWeek}`;
          if (resolvedEl) resolvedEl.textContent = resolved.toString();
          if (inprogressEl) inprogressEl.textContent = active.toString();
          if (inprogressSubEl) inprogressSubEl.textContent = tActiveReports;
          if (cityTotalEl) cityTotalEl.textContent = total.toString();
          if (cityTotalSubEl) cityTotalSubEl.textContent = tAllTime;

          if (rateEl) {
            const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
            rateEl.textContent = `${rate}% ${tResolutionRate}`;
          }

          if (heroDesc) {
            heroDesc.textContent = `You have submitted ${total} report${total !== 1 ? 's' : ''} with ${resolved} resolved. Every report builds a more responsive city for everyone.`;
          }
          return;
        }
      }
    } catch (e) {}
  }

  // 4. Otherwise, load last known cached stats
  const cachedTotal = localStorage.getItem('cc_user_stat_total');
  const cachedWeekly = localStorage.getItem('cc_user_stat_weekly');
  const cachedResolved = localStorage.getItem('cc_user_stat_resolved');
  const cachedActive = localStorage.getItem('cc_user_stat_active');
  const cachedCityTotal = localStorage.getItem('cc_city_stat_total');

  if (totalEl && cachedTotal !== null) totalEl.textContent = cachedTotal;
  if (weeklyEl && cachedWeekly !== null) weeklyEl.textContent = `+${parseInt(cachedWeekly, 10) || 0} this week`;
  if (resolvedEl && cachedResolved !== null) resolvedEl.textContent = cachedResolved;
  if (inprogressEl && cachedActive !== null) inprogressEl.textContent = cachedActive;
  if (cityTotalEl && cachedCityTotal !== null) cityTotalEl.textContent = cachedCityTotal;

  if (cachedTotal !== null && cachedResolved !== null) {
    const total = parseInt(cachedTotal, 10) || 0;
    const resolved = parseInt(cachedResolved, 10) || 0;
    if (rateEl) {
      const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
      rateEl.textContent = `${rate}% Resolution Rate`;
    }
    if (heroDesc && total > 0) {
      heroDesc.textContent = `You have submitted ${total} report${total !== 1 ? 's' : ''} with ${resolved} resolved. Every report builds a more responsive city for everyone.`;
    }
  }
}


// Fetch and draw issues list
async function loadAndRenderIssues(forceReload = false) {
  const listContainer = document.getElementById('issues-list');
  if (!listContainer) return;

  // Prevent concurrent duplicate loads (e.g. from realtime reconnect + auth change firing together)
  if (isLoadingIssues) return;

  // Cooldown guard: don't re-fetch if data was loaded within the past 8 seconds
  // (unless forceReload is explicitly set by filter/tab interactions)
  const now = Date.now();
  if (!forceReload && (now - _lastIssuesFetchAt) < _FETCH_COOLDOWN_MS) return;

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
          <button onclick="loadAndRenderIssues(true)" class="btn btn-secondary" style="margin-top: 1rem; font-size: 0.85rem;">Try Again</button>
        </div>
      `;
      return;
    }

    currentIssues = issues;
    _lastIssuesFetchAt = Date.now(); // Mark successful fetch time for cooldown guard
    
    try { loadUserStats(); } catch (e) {}

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
        <button onclick="loadAndRenderIssues(true)" class="btn btn-secondary" style="margin-top: 1rem; font-size: 0.85rem;">Try Again</button>
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
      await loadAndRenderIssues(true);
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
      await loadAndRenderIssues(true);
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

// Re-evaluate greeting and stats when auth changes
window.addEventListener('auth-change', async () => {
  try {
    updateHeroGreeting();
  } catch (e) {}

  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const currentUserId = user ? user.id : null;
  
  if (!_dashboardInitialized) {
    initDashboard();
    return;
  }

  if (currentUserId === lastLoadedUserIdApp) {
    return;
  }
  lastLoadedUserIdApp = currentUserId;

  if (currentUserId) {
    loadUserStats().catch(err => console.error("Error updating user stats on auth change:", err));
    loadRecentNotifications().catch(err => console.error("Error updating notifications on auth change:", err));
  }
});

let _realtimeDebounceTimer = null;

function initRealtimeDashboard() {
  if (appRealtimeChannel) {
    const client = window.supabaseClient || null;
    if (client) client.removeChannel(appRealtimeChannel);
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
      if (event === 'RECONNECT') return;
      console.log(`[REALTIME] event: ${event}`);

      if (window.showToast) {
        if (event === 'INSERT') {
          window.showToast(window.i18n ? window.i18n.t('toast_new_complaint') || 'New civic complaint reported in your city!' : 'New civic complaint reported in your city!', 'info');
        } else if (event === 'UPDATE') {
          window.showToast(window.i18n ? window.i18n.t('toast_complaint_updated') || 'A complaint status was updated.' : 'A complaint status was updated.', 'info');
        }
      }

      // Debounce the refresh by 1500ms to prevent rapid consecutive fetches
      if (_realtimeDebounceTimer) clearTimeout(_realtimeDebounceTimer);
      console.log('[REALTIME] refresh scheduled');
      _realtimeDebounceTimer = setTimeout(() => {
        loadAndRenderIssues(true).catch(err => console.error("Error refreshing issues on realtime update:", err));
        loadUserStats().catch(err => console.error("Error refreshing user stats on realtime update:", err));
      }, 1500);
    }
  });
}

// Initialize when window is ready
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    initDashboard();
  });
} else {
  initDashboard();
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
      await loadAndRenderIssues(true);
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

// Government Typewriter Ticker Engine
let _tickerTimer = null;
let _tickerMessages = [];
let _cachedTNLiveUpdates = null;
let _isFetchingTNUpdates = false;

async function loadTamilNaduDynamicUpdates() {
  if (_cachedTNLiveUpdates && _cachedTNLiveUpdates.length > 0) {
    integrateTNUpdatesIntoTicker(_cachedTNLiveUpdates);
    return _cachedTNLiveUpdates;
  }
  if (_isFetchingTNUpdates) return [];
  _isFetchingTNUpdates = true;

  try {
    const res = await fetch('/api/tamilnadu-updates');
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.updates) && data.updates.length > 0) {
        _cachedTNLiveUpdates = data.updates;
        integrateTNUpdatesIntoTicker(data.updates);
        return data.updates;
      }
    }
  } catch (err) {
    console.warn('[TN Updates] Async feed fetch notice:', err.message);
  } finally {
    _isFetchingTNUpdates = false;
  }
  return [];
}

function integrateTNUpdatesIntoTicker(updates) {
  if (!Array.isArray(updates) || updates.length === 0) return;
  const newHeadlines = updates
    .filter(u => u && u.title && u.title.trim().length > 10)
    .map(u => {
      const prefix = u.district && u.district !== 'Tamil Nadu' ? `[${u.district}] ` : '';
      return `${prefix}${u.title}`;
    });

  if (_tickerMessages && _tickerMessages.length > 0) {
    // Interleave live dynamic updates into current ticker messages without duplicating
    const currentSet = new Set(_tickerMessages);
    const uniqueNews = newHeadlines.filter(h => !currentSet.has(h));
    
    if (uniqueNews.length > 0) {
      const merged = [..._tickerMessages];
      uniqueNews.forEach((item, idx) => {
        const insertPos = (idx * 2 + 1) % (merged.length + 1);
        merged.splice(insertPos, 0, item);
      });
      _tickerMessages = merged;
      if (window.innerWidth <= 768) {
        initMobileMarqueeTicker();
      }
    }
  } else {
    _tickerMessages = newHeadlines;
    if (window.innerWidth <= 768) {
      initMobileMarqueeTicker();
    } else {
      _tickerMsgIdx = 0;
      _tickerCharIdx = 0;
      _tickerIsDeleting = false;
      runTickerTypewriter();
    }
  }
}

function initMobileMarqueeTicker() {
  const feedTextEl = document.getElementById('civic-intelligence-feed-text');
  if (!feedTextEl || !_tickerMessages || _tickerMessages.length === 0) return;

  if (_tickerTimer) {
    clearTimeout(_tickerTimer);
    _tickerTimer = null;
  }

  // Premium official government emblem separator
  const sep = `<span class="ticker-separator"><i class="fa-solid fa-building-columns"></i></span>`;
  const combined = _tickerMessages.slice(0, 15).map(m => `<span class="ticker-item">${m}</span>`).join(sep);
  // Duplicate for seamless 0-gap continuous CSS loop (-50% transform)
  feedTextEl.innerHTML = `<span class="ticker-marquee-inner">${combined}${sep}${combined}${sep}</span>`;
}

function updateCivicIntelligenceFeed(issues) {
  const feedTextEl = document.getElementById('civic-intelligence-feed-text');
  if (!feedTextEl) return;

  const msgs = [];
  const safeIssues = Array.isArray(issues) ? issues : [];

  // 1. Genuine Citizen Reports (Live from Database only — zero mock/fake data)
  const realIssues = safeIssues.filter(i => 
    i && i.title && i.title.trim().length > 3 && 
    !i.title.toLowerCase().includes('sample') && 
    !i.title.toLowerCase().includes('test') &&
    !i.title.toLowerCase().includes('dummy')
  );

  const recentPending = realIssues
    .filter(i => i.status === 'pending' || i.status === 'assigned' || i.status === 'in_progress')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 3);

  recentPending.forEach(r => {
    const loc = r.address ? ` (${r.address})` : '';
    msgs.push(`குடிமக்கள் பதிவுசெய்த புகார்: "${r.title}"${loc} — நகராட்சி துரித நடவடிக்கை குழுவிற்கு அனுப்பப்பட்டுள்ளது.`);
  });

  const recentResolved = realIssues
    .filter(i => i.status === 'resolved' || i.status === 'verified')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 3);

  recentResolved.forEach(r => {
    const loc = r.address ? ` (${r.address})` : '';
    msgs.push(`சமீபத்தில் தீர்க்கப்பட்ட புகார்: "${r.title}"${loc} • சரிபார்க்கப்பட்டு முழுமையாக தீர்க்கப்பட்டது.`);
  });

  // 2. Hon'ble Chief Minister Thiru C. Joseph Vijay's Vision & State Governance (Tamil)
  msgs.push("மாண்புமிகு முதலமைச்சர் திரு சி. ஜோசப் விஜய் அவர்களின் தலைமையில் தமிழகம் முழுவதும் மக்கள் குறைகள் 24 மணி நேரத்திற்குள் தீர்க்க நடவடிக்கை.");
  msgs.push("முதலமைச்சரின் தனிப்பிரிவு (CM Cell): பொதுமக்களின் அவசர புகார்களுக்கு முன்னுரிமை அளித்து உடனடி தீர்வு காண முதலமைச்சர் விஜய் உத்தரவு.");
  msgs.push("முதலமைச்சர் விஜய் அவர்களின் இளைஞர் நலன் திட்டம்: தமிழக இளைஞர்களுக்கு இலவச AI தொழில்நுட்ப பயிற்சி மற்றும் வேலைவாய்ப்பு முகாம்கள்.");
  msgs.push("ஊழலற்ற மக்கள் ஆட்சி: வெளிப்படையான நிர்வாகம் மற்றும் தரமான சாலை கட்டமைப்பை உறுதி செய்ய முதலமைச்சர் திரு சி. ஜோசப் விஜய் உத்தரவு.");
  msgs.push("தமிழக சீர்மிகு நகரங்கள் திட்டம்: 38 மாவட்டங்களிலும் நவீன சாலைகள், மழைநீர் வடிகால் மற்றும் தெருவிளக்குகள் புனரமைப்பு.");
  msgs.push("மக்களைத் தேடி அரசு நிர்வாகம்: அரசு நலத்திட்டங்கள் நேரடியாக ஒவ்வொரு குடும்பத்தின் இல்லத்திற்கே சென்றடைய முதலமைச்சர் திட்டம்.");
  msgs.push("தரக்கட்டுப்பாடு ஆய்வு: அரசு திட்டங்கள் மற்றும் பொதுப்பணி கட்டமைப்புகளில் எவ்வித சமரசமுமின்றி தரத்தை உறுதி செய்ய உத்தரவு.");

  // 3. Tamil Nadu State Pride, Industrial Leadership & Heritage (Tamil)
  msgs.push("தமிழ்நாடு — மின்னணு உற்பத்தி, ஆட்டோமொபைல் ஏற்றுமதி, காற்றாலை மின்சாரம் மற்றும் மென்பொருள் கண்டுபிடிப்புகளில் இந்தியாவின் முன்னணி மாநிலம்.");
  msgs.push("செம்மொழித் தமிழ் மற்றும் திராவிட கட்டிடக்கலை பெருமைமிகு 38 மாவட்டங்களை உள்ளடக்கிய வரலாற்று சிறப்புமிக்க தமிழ்நாடு.");
  msgs.push("பசுமைத் தமிழ்நாடு இயக்கம்: பிளாஸ்டிக் இல்லாத நகரங்கள், நதிகள் தூய்மை மற்றும் மரக்கன்றுகள் நடும் பிரம்மாண்ட திட்டம்.");
  msgs.push("தமிழக மெட்ரோ மற்றும் போக்குவரத்து விரிவாக்கம்: சென்னை, கோவை, மதுரை மற்றும் திருச்சி நகரங்களில் நவீன பொதுப்போக்குவரத்து.");
  msgs.push("தொழில்நுட்ப மையங்கள்: சென்னை, கோயம்புத்தூர், ஓசூர் மற்றும் தூத்துக்குடி ஆகிய இடங்களில் புதிய மின்சார வாகன மற்றும் தொழில் பூங்காக்கள்.");

  // 4. Tamil Nadu Flagship Welfare Schemes & Citizen Services (Tamil)
  msgs.push("கலைஞர் மகளிர் உரிமைத் திட்டம்: தகுதியுடைய குடும்பத் தலைவிகளுக்கு மாதம் ₹1,000 உரிமைத் தொகை நேரடியாக வங்கிக் கணக்கில் வரவு.");
  msgs.push("புதுமைப் பெண் & தமிழ்ப் புதல்வன் திட்டம்: உயர்கல்வி பயிலும் மாணவ-மாணவிகளுக்கு மாதம் ₹1,000 கல்வி ஊக்கத்தொகை.");
  msgs.push("முதலமைச்சரின் விரிவான மருத்துவக் காப்பீட்டுத் திட்டம் (CMCHIS): குடும்பத்திற்கு ஆண்டுக்கு ₹5 லட்சம் வரை கட்டணமில்லா சிகிச்சை.");
  msgs.push("நான் முதல்வன் திட்டம்: தமிழக இளைஞர்களுக்கு அதிநவீன தொழில்நுட்பம், ரோபாட்டிக்ஸ் மற்றும் இலவச திறன் மேம்பாட்டு பயிற்சிகள்.");
  msgs.push("மக்களைத் தேடி மருத்துவம்: முதியோர்களுக்கு இல்லத்திற்கே சென்று இலவச மருத்துவப் பரிசோதனை மற்றும் மருந்து மாத்திரைகள் வழங்கும் திட்டம்.");
  msgs.push("இல்லம் தேடிக் கல்வி: தமிழகத்தின் அனைத்து கிராமங்களிலும் மாணவர்களுக்கான மாலை நேர வழிகாட்டுதல் வகுப்புகள்.");
  msgs.push("மகளிர் கட்டணமில்லா பேருந்து பயணம்: தமிழகம் முழுவதும் அரசுப் பேருந்துகளில் மகளிர் மற்றும் மாணவர்களுக்கு இலவச பயணம்.");

  // 5. Official 24/7 Emergency & Citizen Helplines (Tamil)
  msgs.push("முதலமைச்சரின் உதவி மையம்: பொதுமக்கள் தங்கள் குறைகளை நேரடியாகத் தெரிவிக்க 1100 எண்ணை அழைக்கவும்.");
  msgs.push("அவசர மருத்துவ ஊர்தி சேவை: 38 மாவட்டங்களிலும் 24 மணி நேர இலவச ஆம்புலன்ஸ் சேவைக்கு 108 ஐ அழைக்கவும்.");
  msgs.push("தமிழ்நாடு காவல்துறை கட்டுப்பாட்டு அறை: 100 • தேசிய அவசர கால உதவி எண்: 112.");
  msgs.push("தீயணைப்பு மற்றும் மீட்புப் பணி: 101 • பெண்கள் பாதுகாப்பு உதவி எண்: 1091.");
  msgs.push("மின்வாரிய அவசர புகார் மையம் (மின்னகம்): 94987 94987 ஐ அழைக்கவும்.");
  msgs.push("குடிநீர் மற்றும் கழிவுநீர் வடிகால் வாரியம்: 1916 • மாநகராட்சி மக்கள் குறைதீர்க்கும் எண்: 1913.");

  // Fisher-Yates Shuffle for fresh, non-repetitive viewing on every visit
  for (let i = msgs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [msgs[i], msgs[j]] = [msgs[j], msgs[i]];
  }

  _tickerMessages = msgs;
  
  if (_tickerTimer) {
    clearTimeout(_tickerTimer);
    _tickerTimer = null;
  }

  if (window.innerWidth <= 768) {
    initMobileMarqueeTicker();
  } else {
    _tickerMsgIdx = 0;
    _tickerCharIdx = 0;
    _tickerIsDeleting = false;
    runTickerTypewriter();
  }

  // Asynchronously load and merge live dynamic Tamil Nadu updates from backend API
  loadTamilNaduDynamicUpdates();
}

function runTickerTypewriter() {
  if (window.innerWidth <= 768) {
    initMobileMarqueeTicker();
    return;
  }

  const feedTextEl = document.getElementById('civic-intelligence-feed-text');
  if (!feedTextEl || !_tickerMessages || _tickerMessages.length === 0) return;

  const currentMsg = _tickerMessages[_tickerMsgIdx % _tickerMessages.length];
  
  // Use Intl.Segmenter or Array.from for complete Tamil grapheme cluster typing
  let chars;
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('ta', { granularity: 'grapheme' });
    chars = Array.from(segmenter.segment(currentMsg), s => s.segment);
  } else {
    chars = Array.from(currentMsg);
  }

  if (!_tickerIsDeleting) {
    // Typing forward like live input
    _tickerCharIdx++;
    feedTextEl.textContent = chars.slice(0, _tickerCharIdx).join('');

    if (_tickerCharIdx >= chars.length) {
      // Finished typing full message: pause for 4.5 seconds to comfortably read
      _tickerIsDeleting = true;
      _tickerTimer = setTimeout(runTickerTypewriter, 4500);
      return;
    }
    // Realistic live keystroke typing speed (30ms - 45ms)
    const variance = Math.floor(Math.random() * 15);
    _tickerTimer = setTimeout(runTickerTypewriter, 32 + variance);
  } else {
    // Erasing backward cleanly
    _tickerCharIdx -= 2;
    if (_tickerCharIdx < 0) _tickerCharIdx = 0;
    feedTextEl.textContent = chars.slice(0, _tickerCharIdx).join('');

    if (_tickerCharIdx <= 0) {
      // Finished deleting: move to next message
      _tickerIsDeleting = false;
      _tickerMsgIdx = (_tickerMsgIdx + 1) % _tickerMessages.length;
      _tickerTimer = setTimeout(runTickerTypewriter, 350);
      return;
    }
    // Fast erase speed
    _tickerTimer = setTimeout(runTickerTypewriter, 14);
  }
}

// Window resize listener for responsive ticker transition
let _tickerLastIsMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    const isMobile = window.innerWidth <= 768;
    if (isMobile !== _tickerLastIsMobile) {
      _tickerLastIsMobile = isMobile;
      if (isMobile) {
        initMobileMarqueeTicker();
      } else {
        if (_tickerMessages && _tickerMessages.length > 0) {
          _tickerCharIdx = 0;
          _tickerIsDeleting = false;
          runTickerTypewriter();
        }
      }
    }
  });
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

  const isTa = window.i18n && window.i18n.getLanguage() === 'ta';
  const defaultCitizen = isTa ? 'குடிமகன்' : 'Citizen';
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
  if (isTa) {
    const taGreetings = {
      hero_greeting_morning: 'காலை வணக்கம்',
      hero_greeting_afternoon: 'மதிய வணக்கம்',
      hero_greeting_evening: 'மாலை வணக்கம்'
    };
    const taWord = taGreetings[greetingKey] || 'வணக்கம்';
    heroGreeting.innerHTML = `${taWord}, ${safeName}`;
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

