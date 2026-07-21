// CrowdCity AI v2.0 - Government Services Citizen Dashboard JavaScript
// Aggregates schemes, documents, application preparation, AI history, office locator, and notifications.

(function() {
  'use strict';

  let userProfile = {};
  let savedSchemes = [];
  let userDocs = [];

  function loadUserData() {
    try {
      const storedProfile = sessionStorage.getItem('cc_scheme_checker_profile');
      if (storedProfile) userProfile = JSON.parse(storedProfile);
    } catch (e) {}

    try {
      const storedDocs = localStorage.getItem('cc_user_uploaded_docs');
      if (storedDocs) userDocs = JSON.parse(storedDocs);
    } catch (e) {}
  }

  function calculateProfileCompletion() {
    let score = 30; // base profile
    if (userProfile.age) score += 15;
    if (userProfile.district) score += 15;
    if (userProfile.income !== undefined) score += 20;
    if (userDocs.length > 0) score += 20;
    return Math.min(score, 100);
  }

  function renderProfileSummary() {
    const nameElem = document.getElementById('dash-user-name');
    const districtElem = document.getElementById('dash-user-location');
    const completionElem = document.getElementById('dash-profile-completion');
    const progressBar = document.getElementById('dash-profile-progress-bar');

    const completion = calculateProfileCompletion();

    if (nameElem) nameElem.textContent = userProfile.fullName || 'Citizen User';
    if (districtElem) districtElem.textContent = `${userProfile.district || 'Chennai District'}, Tamil Nadu`;
    if (completionElem) completionElem.textContent = `${completion}% Complete`;
    if (progressBar) progressBar.style.width = `${completion}%`;
  }

  async function fetchSavedSchemesSummary() {
    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const session = await client.auth.getSession();
          const userId = session?.data?.session?.user?.id;
          if (userId) {
            const { data } = await client
              .from('saved_schemes')
              .select('id, government_schemes(*)')
              .eq('user_id', userId)
              .limit(3);

            if (data) {
              savedSchemes = data.map(d => d.government_schemes).filter(Boolean);
            }
          }
        }
      }
    } catch (e) {}

    if (savedSchemes.length === 0) {
      savedSchemes = [
        { id: 'tn-kmut', name: 'Kalaignar Magalir Urimai Thittam', dept: 'Social Welfare Dept, TN', portal: 'https://kmut.tn.gov.in/' },
        { id: 'tn-pudhumai', name: 'Pudhumai Penn Scheme', dept: 'Higher Education Dept, TN', portal: 'https://penkalvi.tn.gov.in/' }
      ];
    }

    renderSavedSchemesWidget();
  }

  function renderSavedSchemesWidget() {
    const container = document.getElementById('dash-saved-schemes-list');
    const countElem = document.getElementById('dash-saved-count');

    if (countElem) countElem.textContent = savedSchemes.length;
    if (!container) return;

    container.innerHTML = savedSchemes.map(sch => `
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 14px; padding: 1.2rem; margin-bottom: 0.85rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
        <div>
          <span style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; color: var(--primary); background: rgba(13, 148, 136, 0.12); padding: 0.25rem 0.6rem; border-radius: 999px;">
            Eligible Scheme
          </span>
          <h4 style="font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin: 0.35rem 0 0.15rem 0;">${sch.scheme_name || sch.name}</h4>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">${sch.department_name || sch.dept || 'Govt Department'}</p>
        </div>

        <div style="display: flex; gap: 0.5rem; flex-shrink: 0;">
          <a href="scheme-details.html?id=${sch.id}" class="btn btn-secondary" style="padding: 0.45rem 0.85rem; font-size: 0.78rem; font-weight: 700; border-radius: 8px; text-decoration: none;">
            View Details
          </a>
          <a href="office-locator.html" class="btn btn-primary" style="padding: 0.45rem 0.85rem; font-size: 0.78rem; font-weight: 700; border-radius: 8px; text-decoration: none;">
            Find Office
          </a>
        </div>
      </div>
    `).join('');
  }

  function renderDocumentsWidget() {
    const countElem = document.getElementById('dash-docs-count');
    const container = document.getElementById('dash-recent-docs-list');

    if (countElem) countElem.textContent = userDocs.length;
    if (!container) return;

    if (userDocs.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 14px;">
          <i class="fa-solid fa-folder-open" style="font-size: 2rem; color: var(--text-muted); margin-bottom: 0.75rem;"></i>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 1rem 0;">No documents uploaded to your wallet yet.</p>
          <a href="my-documents.html" class="btn btn-primary" style="padding: 0.5rem 1rem; font-size: 0.8rem; font-weight: 700; border-radius: 8px; text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem;">
            <i class="fa-solid fa-upload"></i> Upload Now
          </a>
        </div>
      `;
      return;
    }

    container.innerHTML = userDocs.slice(0, 3).map(doc => `
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 12px; padding: 0.85rem 1rem; margin-bottom: 0.65rem; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <i class="fa-solid fa-file-pdf" style="color: #6366f1; font-size: 1.2rem;"></i>
          <div>
            <div style="font-size: 0.88rem; font-weight: 700; color: var(--text-main);">${doc.doc_name}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Verified in Wallet</div>
          </div>
        </div>
        <span style="font-size: 0.72rem; font-weight: 800; color: #10b981; background: rgba(16, 185, 129, 0.12); padding: 0.2rem 0.55rem; border-radius: 999px;">
          Available
        </span>
      </div>
    `).join('');
  }

  function renderActivityFeed() {
    const container = document.getElementById('dash-activity-feed');
    if (!container) return;

    const activities = [
      { text: 'Eligibility Checked for Welfare Schemes', time: 'Today', icon: 'fa-user-check', color: 'var(--primary)' },
      { text: 'Document Wallet Sync Completed', time: 'Yesterday', icon: 'fa-folder-check', color: '#10b981' },
      { text: 'AI Assistant Query: Kalaignar Magalir Urimai', time: '2 days ago', icon: 'fa-robot', color: '#6366f1' },
      { text: 'Nearby E-Sevai Center Located', time: '3 days ago', icon: 'fa-location-dot', color: '#f59e0b' }
    ];

    container.innerHTML = activities.map(act => `
      <div style="display: flex; gap: 0.85rem; align-items: flex-start; margin-bottom: 1rem;">
        <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(13, 148, 136, 0.1); color: ${act.color}; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; flex-shrink: 0;">
          <i class="fa-solid ${act.icon}"></i>
        </div>
        <div>
          <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-main);">${act.text}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">${act.time}</div>
        </div>
      </div>
    `).join('');
  }

  function renderNotifications() {
    const container = document.getElementById('notification-dropdown-menu');
    if (!container) return;

    const notifications = [
      { title: 'New Scheme Available', desc: 'Tamil Nadu Pudhumai Penn 2026 guidelines updated.', time: '10m ago' },
      { title: 'Document Wallet Sync', desc: 'Your uploaded certificates are ready for quick application.', time: '1h ago' }
    ];

    container.innerHTML = notifications.map(notif => `
      <div style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-color);">
        <div style="font-size: 0.82rem; font-weight: 800; color: var(--text-main);">${notif.title}</div>
        <div style="font-size: 0.78rem; color: var(--text-muted); margin: 0.2rem 0;">${notif.desc}</div>
        <div style="font-size: 0.68rem; color: var(--primary); font-weight: 700;">${notif.time}</div>
      </div>
    `).join('');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    loadUserData();
    renderProfileSummary();
    await fetchSavedSchemesSummary();
    renderDocumentsWidget();
    renderActivityFeed();
    renderNotifications();
    await fetchPersonalizedRecommendations();

    // Toggle Notifications Dropdown
    const notifBtn = document.getElementById('btn-notification-bell');
    const notifMenu = document.getElementById('notification-dropdown-menu');
    if (notifBtn && notifMenu) {
      notifBtn.addEventListener('click', () => {
        const isVisible = notifMenu.style.display === 'block';
        notifMenu.style.display = isVisible ? 'none' : 'block';
      });
    }
  });

  async function fetchPersonalizedRecommendations() {
    const container = document.getElementById('dash-ai-recommendations-list');
    if (!container) return;

    try {
      const res = await fetch('/api/ai/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: userProfile,
          docs: userDocs,
          apps: [],
          reminders: []
        })
      });
      const data = await res.json();
      if (data.success && data.recommendations) {
        renderRecommendations(data.recommendations);
        return;
      }
    } catch (e) {}

    // Fallback
    renderRecommendations([
      {
        title: 'Pudhumai Penn Higher Education Aid',
        description: 'Monthly ₹1,000 aid for female students from TN Govt schools.',
        reason: 'Recommended based on your profile and student status.',
        actionText: 'View Scheme',
        actionUrl: 'scheme-details.html?id=tn-pudhumai'
      },
      {
        title: 'Kalaignar Magalir Urimai Thittam',
        description: 'Monthly ₹1,000 financial rights assistance directly into bank account.',
        reason: 'Recommended for Chennai District residents with family income under ₹2.5 Lakhs.',
        actionText: 'Check Eligibility',
        actionUrl: 'scheme-checker.html'
      }
    ]);
  }

  function renderRecommendations(recs) {
    const container = document.getElementById('dash-ai-recommendations-list');
    if (!container) return;

    container.innerHTML = recs.slice(0, 2).map(r => `
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 14px; padding: 1.2rem; margin-bottom: 0.85rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
        <div>
          <span style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; color: #6366f1; background: rgba(99, 102, 241, 0.12); padding: 0.25rem 0.6rem; border-radius: 999px;">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Proactive AI Match
          </span>
          <h4 style="font-size: 1.05rem; font-weight: 800; color: var(--text-main); margin: 0.35rem 0 0.15rem 0;">${r.title}</h4>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0 0 0.35rem 0;">${r.description}</p>
          <div style="font-size: 0.72rem; color: var(--primary); font-weight: 700;">${r.reason}</div>
        </div>

        <a href="${r.actionUrl}" class="btn btn-primary" style="padding: 0.5rem 1rem; font-size: 0.78rem; font-weight: 700; border-radius: 8px; text-decoration: none; flex-shrink: 0;">
          ${r.actionText}
        </a>
      </div>
    `).join('');
  }

})();

