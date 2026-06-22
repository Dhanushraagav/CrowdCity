// CrowdCity - Read-Only Profile Controller

let lastUserProfileData = null;
let lastUserBadges = null;
let lastUserIssuesProfile = null;

const PROFILE_BADGES_METADATA = [
  {
    type: 'first_report',
    name: 'Pioneer Reporter',
    desc: 'Awarded for filing your first civic complaint on CrowdCity.',
    icon: 'fa-solid fa-flag'
  },
  {
    type: 'report_verified',
    name: 'Civic Defender',
    desc: 'Earned when one of your reports is resolved successfully by public works.',
    icon: 'fa-solid fa-shield-halved'
  },
  {
    type: 'comment_added',
    name: 'Town Crier',
    desc: 'Earned for sharing local knowledge and commenting on active issues.',
    icon: 'fa-solid fa-comment-dots'
  },
  {
    type: 'vote_cast',
    name: 'Active Voter',
    desc: 'Awarded for supporting civic action and upvoting nearby reports.',
    icon: 'fa-solid fa-thumbs-up'
  }
];

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

// Fetch user metadata
// Render user profile UI elements
function renderProfileFields(displayName, email, avatarUrl, points, role, createdDate) {
  // Set sidebar display text
  const nameDisp = document.getElementById('profile-name-display');
  const emailDisp = document.getElementById('profile-email-display');
  const pointsDisp = document.getElementById('profile-points-display');
  const levelDisp = document.getElementById('profile-level-display');
  const roleBadge = document.getElementById('profile-role-badge');
  const streakDisp = document.getElementById('profile-streak-display');
  const joinedDisp = document.getElementById('profile-joined-display');

  if (nameDisp) nameDisp.textContent = displayName;
  if (emailDisp) emailDisp.textContent = email;
  if (pointsDisp) pointsDisp.textContent = `${points} pts`;
  if (levelDisp) levelDisp.textContent = getLevelFromPoints(points);
  
  if (roleBadge) {
    roleBadge.textContent = role;
    roleBadge.style.textTransform = 'capitalize';
  }
  
  if (joinedDisp) joinedDisp.textContent = window.i18n ? window.i18n.t('member_since', { date: createdDate }) : `Member since ${createdDate}`;

  // Set Overview panel stats
  const statsPoints = document.getElementById('stats-total-points');
  if (statsPoints) statsPoints.textContent = points;

  // Milestone levels & XP progress bar
  let milestoneMax = 50;
  let prevMilestone = 0;
  let nextRankName = "Local Watchdog";
  
  if (points >= 300) {
    milestoneMax = 500;
    prevMilestone = 300;
    nextRankName = "Master Watchdog";
  } else if (points >= 150) {
    milestoneMax = 300;
    prevMilestone = 150;
    nextRankName = "City Legend";
  } else if (points >= 50) {
    milestoneMax = 150;
    prevMilestone = 50;
    nextRankName = "Civic Leader";
  }

  const xpEarnedInLevel = points - prevMilestone;
  const levelRange = milestoneMax - prevMilestone;
  const progressPercent = Math.min(Math.max(Math.round((xpEarnedInLevel / levelRange) * 100), 0), 100);

  const xpTextEl = document.getElementById('stats-xp-text');
  const xpBarEl = document.getElementById('stats-xp-bar');
  const xpTipEl = document.getElementById('stats-next-rank-tip');

  if (xpTextEl) xpTextEl.textContent = `${points} / ${milestoneMax} PTS`;
  if (xpBarEl) xpBarEl.style.width = `${progressPercent}%`;
  if (xpTipEl) {
    if (points >= 300) {
      xpTipEl.textContent = window.i18n ? window.i18n.t('profile_xp_tip_legend') : `You are a City Legend! Keep up the amazing work!`;
    } else {
      const translatedRank = window.i18n ? window.i18n.t(`level_${nextRankName.toLowerCase().replace(' ', '_')}`) : nextRankName;
      xpTipEl.textContent = window.i18n 
        ? window.i18n.t('profile_xp_tip_next', { points: milestoneMax - points, rank: translatedRank }) 
        : `Earn ${milestoneMax - points} more points to rank up to ${nextRankName}!`;
    }
  }


  const avatarDisplay = document.getElementById('profile-avatar-display');
  if (avatarDisplay) {
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
  let points = 0;
  let role = 'citizen';
  let createdDate = '';

  // 1. Render from cached profile data immediately to prevent flickering
  const cachedProfileStr = localStorage.getItem('cc_user_profile');
  if (cachedProfileStr) {
    try {
      const cachedProfile = JSON.parse(cachedProfileStr);
      if (cachedProfile) {
        lastUserProfileData = cachedProfile;
        points = cachedProfile.points || 0;
        role = cachedProfile.role || 'citizen';
        if (cachedProfile.created_at) {
          const joined = new Date(cachedProfile.created_at);
          const lang = window.i18n ? window.i18n.getLanguage() : 'en';
          createdDate = joined.toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-US', { month: 'long', year: 'numeric' });
        }
        renderProfileFields(displayName, email, avatarUrl, points, role, createdDate);
      }
    } catch (e) {
      console.warn("Failed to parse cached profile:", e);
    }
  } else {
    // Render defaults if no cache yet
    renderProfileFields(displayName, email, avatarUrl, points, role, createdDate);
  }
  
  if (token) {
    try {
      const response = await fetch('/api/auth/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const profile = await response.json();
        lastUserProfileData = profile;
        points = profile.points || 0;
        role = profile.role || 'citizen';
        if (profile.created_at) {
          const joined = new Date(profile.created_at);
          const lang = window.i18n ? window.i18n.getLanguage() : 'en';
          createdDate = joined.toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-US', { month: 'long', year: 'numeric' });
        }
        // Render fresh values
        renderProfileFields(displayName, email, avatarUrl, points, role, createdDate);
        // Cache profile
        localStorage.setItem('cc_user_profile', JSON.stringify(profile));
      }
    } catch (err) {
      console.error("Failed to load user profile:", err);
    }
  }

}

// Fetch user badges and render unlocked vs locked status
async function loadUserMedals() {
  const container = document.getElementById('profile-badges-list');
  if (!container) return;

  const { data: unlockedBadges, error } = await window.API.getUserBadges();

  if (error) {
    container.innerHTML = `<p style="font-size:0.8rem; color:var(--text-muted); text-align:center;">Failed to load badges</p>`;
    return;
  }

  lastUserBadges = unlockedBadges;
  renderUserMedalsHTML(unlockedBadges);
}

function renderUserMedalsHTML(unlockedBadges) {
  const container = document.getElementById('profile-badges-list');
  if (!container) return;

  const unlockedTypes = (unlockedBadges || []).map(b => b.badge_type);

  container.innerHTML = PROFILE_BADGES_METADATA.map(meta => {
    const isUnlocked = unlockedTypes.includes(meta.type);
    const cardClass = isUnlocked ? 'unlocked' : 'locked';
    const statusKey = isUnlocked ? 'badge_status_unlocked' : 'badge_status_locked';
    const statusText = window.i18n ? window.i18n.t(statusKey) : (isUnlocked ? 'Unlocked' : 'Locked');
    const lockIcon = isUnlocked ? '' : `<i class="fa-solid fa-lock" style="position:absolute; top:12px; right:15px; font-size:0.75rem; color:var(--text-muted);"></i>`;
    const badgeName = window.i18n ? window.i18n.t(`badge_${meta.type}_name`) : meta.name;
    const badgeDesc = window.i18n ? window.i18n.t(`badge_${meta.type}_desc`) : meta.desc;

    return `
      <div class="badge-item-card ${cardClass}" ${isUnlocked ? `onclick="triggerConfetti()"` : ''} style="${isUnlocked ? 'cursor: pointer;' : ''}">
        ${lockIcon}
        <div class="badge-item-icon">
          <i class="${meta.icon}"></i>
        </div>
        <div style="flex:1;">
          <h4 style="font-size:1rem; font-weight:700; color:var(--text-main); display:flex; align-items:center; gap:0.5rem;">
            ${badgeName}
            <span class="badge" style="font-size:0.65rem; padding: 0.15rem 0.4rem; background-color:${isUnlocked ? 'rgba(16,185,129,0.1)' : 'var(--slate-200)'}; color:${isUnlocked ? '#10b981' : 'var(--text-muted)'};">${statusText}</span>
          </h4>
          <p style="font-size:0.8rem; color:var(--text-muted); margin-top:0.15rem; line-height:1.4;">${badgeDesc}</p>
        </div>
      </div>
    `;
  }).join('');
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
  const role = typeof getUserRole === 'function' ? getUserRole() : null;
  const isAuthority = role === 'authority' || role === 'admin';

  const totalReports = issues.length;
  const resolvedReports = issues.filter(i => i.status === 'resolved' || i.status === 'verified').length;
  const activeCases = issues.filter(i => i.status === 'pending' || i.status === 'assigned' || i.status === 'in_progress').length;
  const resolutionRate = totalReports > 0 ? Math.round((resolvedReports / totalReports) * 100) : 0;

  // Calculate active streak from reporting days
  let streak = 0;
  if (!isAuthority) {
    streak = calculateReportingStreak(issues);
  }

  // Set Overview stats
  const totalReportsEl = document.getElementById('stats-total-reports');
  const resolvedReportsEl = document.getElementById('stats-resolved-reports');
  const resolutionRateEl = document.getElementById('stats-resolution-rate');
  const impactSummaryEl = document.getElementById('community-impact-summary');
  const streakDisp = document.getElementById('profile-streak-display');
  const statsStreak = document.getElementById('stats-streak-days');

  if (totalReportsEl) totalReportsEl.textContent = totalReports;
  if (resolvedReportsEl) resolvedReportsEl.textContent = resolvedReports;
  if (resolutionRateEl) {
    resolutionRateEl.textContent = window.i18n 
      ? window.i18n.t('resolution_rate_stats', { rate: resolutionRate }) 
      : `${resolutionRate}% of your reported issues have been fully resolved.`;
  }
  
  if (streakDisp) {
    streakDisp.textContent = window.i18n 
      ? window.i18n.t('profile_streak', { streak: streak }) 
      : `${streak}-day streak`;
  }
  if (statsStreak) statsStreak.textContent = streak;

  // Render contribution calendar
  renderContributionCalendar(issues);

  if (impactSummaryEl) {
    if (totalReports === 0) {
      impactSummaryEl.textContent = window.i18n 
        ? window.i18n.t('profile_impact_empty') 
        : "You haven't filed any complaints yet. Start reporting local issues to earn points and help improve the neighborhood!";
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
    const validTabs = ['overview', 'achievements', 'activity'];
    if (validTabs.includes(hash)) {
      switchTab(hash);
    } else {
      switchTab('overview');
    }
  };

  window.addEventListener('hashchange', handleHash);
  handleHash();
}

// Calculate reporting streak from user's issues
function calculateReportingStreak(issues) {
  if (!issues || issues.length === 0) return 0;
  
  // Extract local dates (YYYY-MM-DD) from issues' created_at
  const dateStrings = issues.map(issue => {
    const date = new Date(issue.created_at);
    return date.getFullYear() + '-' + 
           String(date.getMonth() + 1).padStart(2, '0') + '-' + 
           String(date.getDate()).padStart(2, '0');
  });
  
  const uniqueDates = Array.from(new Set(dateStrings)).sort((a, b) => new Date(b) - new Date(a));
  
  const today = new Date();
  const todayStr = today.getFullYear() + '-' + 
                   String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                   String(today.getDate()).padStart(2, '0');
                   
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.getFullYear() + '-' + 
                       String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + 
                       String(yesterday.getDate()).padStart(2, '0');
  
  // Check if the most recent report is today or yesterday. If not, streak is 0.
  if (uniqueDates[0] !== todayStr && uniqueDates[0] !== yesterdayStr) {
    return 0;
  }
  
  let streak = 0;
  let checkDate = new Date(uniqueDates[0]); // start from the most recent reporting date
  
  while (true) {
    const checkDateStr = checkDate.getFullYear() + '-' + 
                         String(checkDate.getMonth() + 1).padStart(2, '0') + '-' + 
                         String(checkDate.getDate()).padStart(2, '0');
    if (uniqueDates.includes(checkDateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  
  return streak;
}

// Render Contribution Calendar Grid using real user issues
function renderContributionCalendar(issues = []) {
  const grid = document.getElementById('contrib-calendar-grid');
  const totalText = document.getElementById('contrib-total-text');
  if (!grid) return;

  const rows = 7;
  const cols = 32;
  const totalDays = rows * cols;
  
  // Map issues to dates
  const reportCountsByDate = {};
  issues.forEach(issue => {
    const date = new Date(issue.created_at);
    const dateStr = date.getFullYear() + '-' + 
                    String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(date.getDate()).padStart(2, '0');
    reportCountsByDate[dateStr] = (reportCountsByDate[dateStr] || 0) + 1;
  });

  const today = new Date();
  const activity = [];
  let totalContributions = 0;

  for (let i = 0; i < totalDays; i++) {
    const offset = i - (totalDays - 1);
    const cellDate = new Date(today);
    cellDate.setDate(today.getDate() + offset);
    
    const dateStr = cellDate.getFullYear() + '-' + 
                    String(cellDate.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(cellDate.getDate()).padStart(2, '0');
    
    const count = reportCountsByDate[dateStr] || 0;
    let level = 0;
    if (count >= 4) level = 4;
    else if (count === 3) level = 3;
    else if (count === 2) level = 2;
    else if (count === 1) level = 1;

    if (count > 0) {
      totalContributions += count;
    }
    activity.push({ level, dateStr, count });
  }

  // Render cells
  grid.innerHTML = activity.map(day => {
    const label = day.count === 1 ? '1 report' : `${day.count} reports`;
    const title = `${label} on ${day.dateStr}`;
    return `<div class="contrib-day level-${day.level}" title="${title}"></div>`;
  }).join('');

  if (totalText) {
    totalText.textContent = window.i18n 
      ? window.i18n.t('contributions_summary', { count: totalContributions, months: 7 }) 
      : `${totalContributions} contributions in the last 7 months`;
  }

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

function getLevelFromPoints(points) {
  let key = 'level_civic_novice';
  if (points >= 300) key = 'level_city_legend';
  else if (points >= 150) key = 'level_civic_leader';
  else if (points >= 50) key = 'level_local_watchdog';
  
  return window.i18n ? window.i18n.t(key) : key.replace('level_', '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
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
    loadUserMedals(),
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
      loadUserMedals(),
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
    const points = lastUserProfileData.points || 0;
    const role = lastUserProfileData.role || 'citizen';
    let createdDate = '';
    if (lastUserProfileData.created_at) {
      const joined = new Date(lastUserProfileData.created_at);
      const lang = window.i18n ? window.i18n.getLanguage() : 'en';
      createdDate = joined.toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-US', { month: 'long', year: 'numeric' });
    }
    renderProfileFields(displayName, email, avatarUrl, points, role, createdDate);
  }

  if (lastUserBadges) {
    renderUserMedalsHTML(lastUserBadges);
  }

  if (user && lastUserIssuesProfile) {
    renderUserActivityAndStatsHTML(user, lastUserIssuesProfile);
  }
});


// Canvas Confetti burst animation
function triggerConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  const colors = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#2dd4bf'];
  const particles = [];
  
  // Burst left
  for (let i = 0; i < 60; i++) {
    particles.push({
      x: 0,
      y: canvas.height,
      vx: Math.random() * 8 + 4,
      vy: -(Math.random() * 12 + 10),
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rSpeed: Math.random() * 4 - 2,
      opacity: 1
    });
  }
  
  // Burst right
  for (let i = 0; i < 60; i++) {
    particles.push({
      x: canvas.width,
      y: canvas.height,
      vx: -(Math.random() * 8 + 4),
      vy: -(Math.random() * 12 + 10),
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rSpeed: Math.random() * 4 - 2,
      opacity: 1
    });
  }
  
  let animationFrame;
  function updateConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let active = false;
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravity
      p.vx *= 0.98; // air resistance
      p.rotation += p.rSpeed;
      
      if (p.vy > 0) {
        p.opacity -= 0.012;
      }
      
      if (p.opacity > 0 && p.y < canvas.height && p.x >= 0 && p.x <= canvas.width) {
        active = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    });
    
    if (active) {
      animationFrame = requestAnimationFrame(updateConfetti);
    } else {
      cancelAnimationFrame(animationFrame);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  
  updateConfetti();
}
window.triggerConfetti = triggerConfetti;
