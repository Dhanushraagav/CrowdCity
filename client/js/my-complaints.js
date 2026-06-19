// CrowdCity - Personal Complaints Controller

let activeCategory = '';
let activeStatus = '';
let lastLoadId = 0;
let lastLoadedState = {
  userId: undefined,
  category: undefined,
  status: undefined
};

async function initMyComplaints() {
  setupFilterListeners();
}

// Fetch only user reported complaints
async function loadAndRenderMyIssues() {
  const container = document.getElementById('my-issues-list');
  if (!container) return;

  const loadId = ++lastLoadId;

  // Wait for auth initialization to complete before doing anything
  if (window.authInitPromise) {
    await window.authInitPromise;
  }

  // If a newer load has started, discard this one
  if (loadId !== lastLoadId) {
    return;
  }

  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const currentUserId = user ? user.id : null;

  // Deduplicate: if parameters match the last successfully loaded state, exit
  if (
    lastLoadedState.userId === currentUserId &&
    lastLoadedState.category === activeCategory &&
    lastLoadedState.status === activeStatus
  ) {
    return;
  }

  // Cache-first: render cached complaints if they exist and no filters are active
  let hasCachedData = false;
  if (!activeCategory && !activeStatus) {
    const cachedMyComplaints = localStorage.getItem('cc_my_complaints');
    if (cachedMyComplaints) {
      try {
        const issues = JSON.parse(cachedMyComplaints);
        renderMyIssuesList(issues);
        hasCachedData = true;
      } catch (e) {
        console.warn("Failed to parse cached complaints:", e);
      }
    }
  }

  // Draw shimming skeletons only if parameters changed or we don't have cached data
  if (!hasCachedData || activeCategory || activeStatus) {
    container.innerHTML = `
        <div class="issue-card" style="cursor: default; pointer-events: none; display: flex; flex-direction: column; gap: 12px; padding: 1.25rem; border: 1px solid var(--border-color);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div class="skeleton" style="width: 80px; height: 1.25rem; border-radius: var(--radius-sm);"></div>
            <div class="skeleton" style="width: 70px; height: 1.25rem; border-radius: var(--radius-sm);"></div>
          </div>
          <div class="skeleton" style="width: 50%; height: 1.2rem; border-radius: var(--radius-sm); margin-top: 4px;"></div>
          <div class="skeleton" style="width: 90%; height: 0.8rem; border-radius: var(--radius-sm);"></div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="skeleton" style="width: 12px; height: 12px; border-radius: var(--radius-round);"></div>
            <div class="skeleton" style="width: 150px; height: 0.75rem; border-radius: var(--radius-sm);"></div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; border-top: 1px solid var(--border-color); padding-top: 12px;">
            <div class="skeleton" style="width: 100px; height: 0.75rem; border-radius: var(--radius-sm);"></div>
            <div style="display: flex; gap: 8px;">
              <div class="skeleton" style="width: 50px; height: 1.5rem; border-radius: var(--radius-sm);"></div>
              <div class="skeleton" style="width: 110px; height: 1.5rem; border-radius: var(--radius-sm);"></div>
            </div>
          </div>
        </div>
        <div class="issue-card" style="cursor: default; pointer-events: none; display: flex; flex-direction: column; gap: 12px; padding: 1.25rem; border: 1px solid var(--border-color);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div class="skeleton" style="width: 90px; height: 1.25rem; border-radius: var(--radius-sm);"></div>
            <div class="skeleton" style="width: 60px; height: 1.25rem; border-radius: var(--radius-sm);"></div>
          </div>
          <div class="skeleton" style="width: 45%; height: 1.2rem; border-radius: var(--radius-sm); margin-top: 4px;"></div>
          <div class="skeleton" style="width: 85%; height: 0.8rem; border-radius: var(--radius-sm);"></div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="skeleton" style="width: 12px; height: 12px; border-radius: var(--radius-round);"></div>
            <div class="skeleton" style="width: 130px; height: 0.75rem; border-radius: var(--radius-sm);"></div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; border-top: 1px solid var(--border-color); padding-top: 12px;">
            <div class="skeleton" style="width: 90px; height: 0.75rem; border-radius: var(--radius-sm);"></div>
            <div style="display: flex; gap: 8px;">
              <div class="skeleton" style="width: 50px; height: 1.5rem; border-radius: var(--radius-sm);"></div>
              <div class="skeleton" style="width: 110px; height: 1.5rem; border-radius: var(--radius-sm);"></div>
            </div>
          </div>
        </div>
    `;
  }

  if (!user) {
    container.innerHTML = `<p style="text-align:center; padding:2rem; color:var(--text-muted);">Please log in to view your complaints.</p>`;
    document.body.classList.add('ready');
    document.body.style.visibility = 'visible';
    return;
  }

  const { data: issues, error } = await window.API.getIssues({
    reporter_id: user.id,
    category: activeCategory,
    status: activeStatus
  });

  // If a newer load has started, discard this render
  if (loadId !== lastLoadId) {
    return;
  }

  if (error || !issues) {
    console.error(`[My Complaints Load] Failed to load issues. loadId: ${loadId}. Error:`, error);
    // If we already have cached data displayed, don't show the error panel
    if (hasCachedData) {
      return;
    }
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 0.5rem; color: #ef4444;"></i>
        <p>Failed to load your complaints: ${error || 'Unknown error'}</p>
        <button onclick="loadAndRenderMyIssues()" class="btn btn-secondary" style="margin-top: 1rem;">Try Again</button>
      </div>
    `;
    document.body.classList.add('ready');
    document.body.style.visibility = 'visible';
    return;
  }

  // Check if fresh issues match the cached issues to avoid duplicate render
  const freshComplaintsStr = JSON.stringify(issues);
  const cachedMyComplaints = localStorage.getItem('cc_my_complaints');
  if (hasCachedData && cachedMyComplaints === freshComplaintsStr) {
    lastLoadedState = {
      userId: currentUserId,
      category: activeCategory,
      status: activeStatus
    };
    document.body.classList.add('ready');
    document.body.style.visibility = 'visible';
    return;
  }

  renderMyIssuesList(issues);
  
  // Cache the result for default category + status
  if (!activeCategory && !activeStatus) {
    localStorage.setItem('cc_my_complaints', freshComplaintsStr);
  }

  // Update last successfully loaded state
  lastLoadedState = {
    userId: currentUserId,
    category: activeCategory,
    status: activeStatus
  };

  document.body.classList.add('ready');
  document.body.style.visibility = 'visible';
}

  function renderMyIssuesList(issues) {
    const container = document.getElementById('my-issues-list');
    if (!container) return;

  if (issues.length === 0) {
    const tNoCases = window.i18n ? window.i18n.t('no_cases_reported') : 'No cases reported yet';
    const tNoCasesDesc = window.i18n ? window.i18n.t('no_cases_reported_desc') : 'You have not reported any civic infrastructure issues. Click the button above to submit your first case.';
    container.innerHTML = `
      <div class="glass-panel" style="text-align: center; padding: 4rem 2rem; color: var(--text-muted); border: 1px solid var(--border-color); border-radius: var(--radius-lg);">
        <i class="fa-solid fa-clipboard-question" style="font-size: 2.5rem; margin-bottom: 1rem; color: var(--text-muted); opacity: 0.6;"></i>
        <p style="font-weight: 700; color: var(--text-main); font-size: 1rem; margin-bottom: 0.25rem;">${tNoCases}</p>
        <p style="font-size: 0.85rem; max-width: 320px; margin: 0 auto; line-height: 1.4;">${tNoCasesDesc}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = issues.map(issue => {
    const timeAgo = formatTimeAgo(new Date(issue.created_at));
    const upvotedClass = (issue.user_has_upvoted || localStorage.getItem(`voted-${issue.id}`)) ? 'upvoted' : '';
    
    // Status details banner
    let statusNotice = '';
    if (issue.status === 'resolved' || issue.status === 'verified') {
      const tVerified = window.i18n ? window.i18n.t('verified_solution') : 'Verified Solution:';
      const tResolvedDefault = window.i18n ? window.i18n.t('resolved_successfully') : 'Resolved successfully.';
      const tViewProof = window.i18n ? window.i18n.t('view_proof_attachment') : 'View Completion Proof Attachment';
      statusNotice = `
        <div style="background-color:rgba(16,185,129,0.06); border:1px solid rgba(16,185,129,0.15); border-radius:var(--radius-sm); padding:0.75rem 1rem; margin-top:0.5rem; font-size:0.8rem; display:flex; flex-direction:column; gap:0.25rem;">
          <div style="color:#10b981; font-weight:700;"><i class="fa-solid fa-circle-check"></i> ${tVerified}</div>
          <p style="color:var(--text-main); font-style:italic;">"${escapeHTML(issue.completion_notes || tResolvedDefault)}"</p>
          ${issue.completion_proof_url ? `<a href="${issue.completion_proof_url}" target="_blank" style="color:var(--primary); font-weight:700; margin-top:0.25rem; display:inline-block;"><i class="fa-solid fa-image"></i> ${tViewProof}</a>` : ''}
        </div>
      `;
    } else if (issue.status === 'rejected') {
      const tDeclined = window.i18n ? window.i18n.t('declined_report_notice') : 'Declined: The report was closed or marked as duplicate/not applicable.';
      statusNotice = `
        <div style="background-color:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.15); border-radius:var(--radius-sm); padding:0.75rem 1rem; margin-top:0.5rem; font-size:0.8rem; color:#ef4444; font-weight:600;">
          <i class="fa-solid fa-circle-xmark"></i> ${tDeclined}
        </div>
      `;
    }

    const tStatusKey = `status_${issue.status}`;
    const tStatus = window.i18n ? window.i18n.t(tStatusKey) : issue.status.replace('_', ' ');
    const tSubmitted = window.i18n ? window.i18n.t('submitted_time_ago', { time: timeAgo }) : `Submitted ${timeAgo}`;
    const tTimelineDetails = window.i18n ? window.i18n.t('timeline_details') : 'Timeline & Details';

    return `
      <article class="issue-card" onclick="window.location.href='issue-details.html?id=${issue.id}'">
        <div class="issue-card-header">
          <span class="badge badge-category ${issue.category}">${window.formatCategoryName(issue.category)}</span>
          <span class="badge badge-status ${issue.status}">${tStatus}</span>
        </div>
        <h3 class="issue-card-title">${escapeHTML(issue.title)}</h3>
        <p class="issue-card-description">${escapeHTML(issue.description)}</p>
        
        <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.35rem;">
          <i class="fa-solid fa-location-dot"></i> <span>${escapeHTML(issue.address || 'Location')}</span>
        </div>
 
        ${statusNotice}
 
        <div class="issue-card-meta">
          <span>${tSubmitted}</span>
          <div class="issue-card-actions" onclick="event.stopPropagation()">
            <button class="upvote-action ${upvotedClass}" onclick="toggleMyUpvote('${issue.id}')" id="my-vote-btn-${issue.id}">
              <i class="fa-solid fa-thumbs-up"></i> <span id="my-vote-count-${issue.id}">${issue.upvotes_count || 0}</span>
            </button>
            <a href="issue-details.html?id=${issue.id}" class="btn btn-secondary" style="padding: 0.35rem 0.65rem; font-size: 0.75rem; border-radius: var(--radius-sm);">
              ${tTimelineDetails}
            </a>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

// Sidebar/Feed upvotes
async function toggleMyUpvote(id) {
  const voteBtn = document.getElementById(`my-vote-btn-${id}`);
  const countSpan = document.getElementById(`my-vote-count-${id}`);
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
  }
}

// Bind Category & Status Filters
function setupFilterListeners() {
  const catFilter = document.getElementById('my-cat-filter');
  const statFilter = document.getElementById('my-status-filter');

  if (catFilter) {
    catFilter.addEventListener('change', async () => {
      activeCategory = catFilter.value;
      await loadAndRenderMyIssues();
    });
  }

  if (statFilter) {
    statFilter.addEventListener('change', async () => {
      activeStatus = statFilter.value;
      await loadAndRenderMyIssues();
    });
  }
}

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

window.addEventListener('auth-change', async () => {
  await loadAndRenderMyIssues();
});

window.addEventListener('DOMContentLoaded', () => {
  initMyComplaints();
});

window.addEventListener('language-change', async () => {
  lastLoadedState = { userId: undefined, category: undefined, status: undefined };
  await loadAndRenderMyIssues();
});
