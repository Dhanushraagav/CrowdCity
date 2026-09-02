/**
 * CrowdCity AI - Dynamic Location-Based Citizen Dashboard Controller
 */

(function () {
  'use strict';

  // 1. Time Formatting Utility
  function formatRelativeTime(dateInput) {
    if (!dateInput) return 'Recently';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'Recently';
    
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} mins ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hrs ago`;
    if (diffSec < 172800) return 'Yesterday';
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} days ago`;
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  }

  // 2. Status Badge Class Helper
  function getStatusBadge(status) {
    const s = (status || '').toUpperCase();
    if (s === 'IN_PROGRESS' || s === 'PROGRESS') {
      return '<span class="status-badge-sm badge-progress">In Progress</span>';
    }
    if (s === 'RESOLVED' || s === 'CLOSED') {
      return '<span class="status-badge-sm badge-resolved">Resolved</span>';
    }
    return '<span class="status-badge-sm badge-pending">Under Review</span>';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 3. Main Dashboard Init
  async function initDynamicDashboard() {
    const user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    
    // Determine User City / Location Priority (1. Profile, 2. Storage, 3. Default)
    let userCity = 'Coimbatore';
    if (user && (user.city || user.district)) {
      userCity = user.city || user.district;
    } else if (localStorage.getItem('cc_user_location')) {
      userCity = localStorage.getItem('cc_user_location');
    }

    // Clean City Name
    userCity = userCity.replace(/ district$/i, '').trim();

    // Update City Indicators across Dashboard Header
    const headerCityEl = document.querySelector('.header-city-indicator span');
    if (headerCityEl) {
      headerCityEl.textContent = `${userCity}, Tamil Nadu`;
    }
    const headerCorpEl = document.getElementById('city-corp-name');
    if (headerCorpEl) {
      headerCorpEl.textContent = `${userCity} City Corp`;
    }

    // Fetch All Complaints from API
    let issues = [];
    try {
      if (window.API && typeof window.API.getIssues === 'function') {
        const res = await window.API.getIssues();
        if (res && res.data) {
          issues = Array.isArray(res.data) ? res.data : (res.data.issues || []);
        }
      }
    } catch (e) {
      console.warn('Failed to load issues from API:', e);
    }

    // ----------------------------------------------------
    // Section 1: Recent Complaint Activity (City Filtered)
    // ----------------------------------------------------
    const recentListEl = document.getElementById('dash-recent-activity-list');
    if (recentListEl) {
      const cityIssues = issues.filter(item => {
        if (!item) return false;
        const loc = (item.address || '') + ' ' + (item.city || '') + ' ' + (item.district || '');
        return loc.toLowerCase().includes(userCity.toLowerCase());
      });

      if (cityIssues.length === 0) {
        recentListEl.innerHTML = `
          <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
            <i class="fa-solid fa-inbox" style="font-size: 2rem; margin-bottom: 0.5rem; color: #cbd5e1;"></i>
            <p style="margin: 0; font-size: 0.88rem; font-weight: 600;">No recent complaints found for ${userCity}.</p>
          </div>
        `;
      } else {
        recentListEl.innerHTML = cityIssues.slice(0, 4).map(item => `
          <div class="activity-item" style="cursor: pointer;" onclick="window.location.href='issue-details.html?id=${item.id}'">
            <div class="activity-item-details">
              <h4 class="activity-item-title">${escapeHtml(item.title || 'Reported Issue')}</h4>
              <div class="activity-item-meta">
                <span style="font-family: monospace; font-weight: 700; color: var(--primary);">${escapeHtml(item.complaint_id || ('#CMP-' + (item.id || '').substring(0, 8)))}</span> &bull; 
                <span><i class="fa-solid fa-users"></i> ${item.citizen_count || 1} ${item.citizen_count === 1 ? 'citizen' : 'citizens'}</span> &bull; 
                <span>${escapeHtml(item.department || item.category || 'Civic Dept')}</span> &bull; 
                <span>${formatRelativeTime(item.created_at || item.updated_at)}</span>
              </div>
            </div>
            ${getStatusBadge(item.status)}
          </div>
        `).join('');
      }
    }

    // ----------------------------------------------------
    // Section 2: My Active Complaints
    // ----------------------------------------------------
    const myActiveListEl = document.getElementById('dash-my-active-list');
    if (myActiveListEl) {
      const myIssues = issues.filter(item => {
        if (!item) return false;
        const isMyIssue = user ? (item.reporter_id === user.id || item.user_email === user.email || item.is_supporting_report) : true;
        const isActive = item.status !== 'RESOLVED' && item.status !== 'CLOSED' && item.status !== 'verified';
        return isMyIssue && isActive;
      });

      if (myIssues.length === 0) {
        myActiveListEl.innerHTML = `
          <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
            <i class="fa-solid fa-clipboard-check" style="font-size: 2rem; margin-bottom: 0.5rem; color: #cbd5e1;"></i>
            <p style="margin: 0; font-size: 0.88rem; font-weight: 600;">No active complaints submitted yet.</p>
          </div>
        `;
      } else {
        myActiveListEl.innerHTML = myIssues.slice(0, 3).map(item => {
          const officer = item.assigned_to_name || item.assigned_officer || item.department || 'Assigned Authority';
          const completionText = item.expected_completion 
            ? `Expected completion: ${escapeHtml(item.expected_completion)}`
            : `Updated ${formatRelativeTime(item.updated_at || item.created_at)}`;

          return `
            <div class="activity-item" style="background: #ffffff; cursor: pointer;" onclick="window.location.href='issue-details.html?id=${item.id}'">
              <div class="activity-item-details">
                <h4 class="activity-item-title">${escapeHtml(item.title || 'Active Complaint')}</h4>
                <div class="activity-item-meta">
                  <span style="font-family: monospace; font-weight: 700; color: var(--primary);">${escapeHtml(item.complaint_id || ('#CMP-' + (item.id || '').substring(0, 8)))}</span> &bull; 
                  <span><i class="fa-solid fa-users"></i> ${item.citizen_count || 1} ${item.citizen_count === 1 ? 'citizen' : 'citizens'}</span> &bull; 
                  <span>Assigned: ${escapeHtml(officer)}</span>
                </div>
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.25rem;">
                  <i class="fa-regular fa-calendar-check"></i> ${completionText}
                </div>
              </div>
              ${getStatusBadge(item.status)}
            </div>
          `;
        }).join('');
      }
    }

    // ----------------------------------------------------
    // Section 3: City Announcements (Dynamic Location-Based)
    // ----------------------------------------------------
    const announcementsListEl = document.getElementById('dash-announcements-list');
    if (announcementsListEl) {
      let cityNotices = [];
      
      if (userCity.toLowerCase().includes('chennai')) {
        cityNotices = [
          { title: 'Metro Phase II Traffic Diversions on Anna Salai', desc: 'Temporary lane restriction active near Gemini Flyover. Commuters advised to use Mount Road bypass.', meta: 'Chennai Traffic Advisory • Active' },
          { title: 'Marina Beach Promenade Maintenance Drive', desc: 'Greater Chennai Corporation beautification drive in progress near Light House area.', meta: 'Greater Chennai Corp • Today' }
        ];
      } else if (userCity.toLowerCase().includes('madurai')) {
        cityNotices = [
          { title: 'Vaigai Riverfront Heritage Corridor Notice', desc: 'Madurai Corporation initiates special waste management drive along river banks.', meta: 'Madurai Corp • Active Notice' },
          { title: 'Meenakshi Temple Zone Vehicle Access Advisory', desc: 'Pedestrian plaza rules active around Chithirai streets.', meta: 'Madurai City Traffic • Updated' }
        ];
      } else {
        // Coimbatore / General Fallback
        cityNotices = [
          { title: `${userCity} Corporation Road Maintenance Work`, desc: 'Pothole restoration and asphalt surfacing active along major arterial corridors.', meta: `${userCity} City Corp • Active` },
          { title: 'Scheduled Municipal Water Supply Update', desc: 'Overhead tank pipeline maintenance in progress. Regular supply resumes tomorrow morning.', meta: `${userCity} TWAD Board • Notice` }
        ];
      }

      announcementsListEl.innerHTML = cityNotices.map((notice, idx) => `
        <div class="announcement-card" style="border-left-color: ${idx % 2 === 0 ? '#ea580c' : '#0284c7'};">
          <h4 class="announcement-title">${escapeHtml(notice.title)}</h4>
          <p class="announcement-desc">${escapeHtml(notice.desc)}</p>
          <span class="announcement-meta">${escapeHtml(notice.meta)}</span>
        </div>
      `).join('');
    }

    // ----------------------------------------------------
    // Section 4: Government Welfare Updates (Personalized)
    // ----------------------------------------------------
    const schemesListEl = document.getElementById('dash-schemes-list');
    if (schemesListEl) {
      const schemes = [
        { title: 'Kalaignar Magalir Urimai Thittam', desc: 'Monthly financial assistance for eligible women heads of households. Verification portal active.', meta: 'Social Welfare Dept • Active Scheme', color: '#7c3aed' },
        { title: 'Naan Mudhalvan Skill Initiative', desc: 'Upskilling & industry certification programs for Tamil Nadu youth.', meta: 'Higher Education Dept • Open Scheme', color: '#059669' },
        { title: 'Pudhumai Penn Financial Scheme', desc: 'Monthly support for government school girls pursuing higher education degrees.', meta: 'Social Welfare Dept • Active', color: '#0284c7' }
      ];

      schemesListEl.innerHTML = schemes.map(scheme => `
        <div class="announcement-card" style="border-left-color: ${scheme.color};">
          <h4 class="announcement-title">${escapeHtml(scheme.title)}</h4>
          <p class="announcement-desc">${escapeHtml(scheme.desc)}</p>
          <span class="announcement-meta">${escapeHtml(scheme.meta)}</span>
        </div>
      `).join('');
    }

    // ----------------------------------------------------
    // Section 5: Nearby Community Issues Grid
    // ----------------------------------------------------
    const nearbyGridEl = document.getElementById('dash-nearby-issues-grid');
    if (nearbyGridEl) {
      const nearbyIssues = issues.filter(item => {
        if (!item) return false;
        return (item.address || '').toLowerCase().includes(userCity.toLowerCase());
      });

      if (nearbyIssues.length === 0) {
        nearbyGridEl.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 1.5rem; text-align: center; color: var(--text-muted);">
            <i class="fa-solid fa-map-location-dot" style="font-size: 1.8rem; margin-bottom: 0.5rem; color: #cbd5e1;"></i>
            <p style="margin: 0; font-size: 0.85rem; font-weight: 600;">No nearby community issues reported in ${userCity}.</p>
          </div>
        `;
      } else {
        nearbyGridEl.innerHTML = nearbyIssues.slice(0, 3).map((item, idx) => {
          const dist = (0.4 + idx * 0.4).toFixed(1);
          return `
            <div class="nearby-issue-item">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="status-badge-sm ${item.status === 'RESOLVED' ? 'badge-resolved' : (item.status === 'IN_PROGRESS' ? 'badge-progress' : 'badge-pending')}">${escapeHtml(item.category || 'Issue')}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted);"><i class="fa-solid fa-location-arrow"></i> ${dist} km away</span>
              </div>
              <h4 style="font-size: 0.88rem; font-weight: 700; color: var(--text-main); margin: 0;">${escapeHtml(item.title || 'Community Issue')}</h4>
              <span style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(item.address || userCity)} &bull; ${formatRelativeTime(item.created_at)}</span>
            </div>
          `;
        }).join('');
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDynamicDashboard);
  } else {
    initDynamicDashboard();
  }
})();
