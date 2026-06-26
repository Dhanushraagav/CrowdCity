// CrowdCity - Issue Details Page Controller

let detailsMap = null;
let issueId = null;
let issueDetailData = null;

// Initialize Details Page
async function initDetailsPage() {
  const urlParams = new URLSearchParams(window.location.search);
  issueId = urlParams.get('id');

  if (!issueId) {
    console.error("No issue ID found in URL parameters");
    window.location.href = 'citizen-dashboard.html';
    return;
  }

  await loadIssueDetails();
  setupCommentSubmit();
  setupUpvoteAction();
  setupControlPanel();
  setupVerificationActions();
  setupCitizenActions();
}

// Fetch issue details and draw page
async function loadIssueDetails() {
  if (!issueId) {
    console.warn("[Details] loadIssueDetails called but issueId is not set yet.");
    return;
  }
  const loader = document.getElementById('details-loader');
  const content = document.getElementById('details-content');

  const { data: issue, error } = await window.API.getIssueDetails(issueId);

  if (error || !issue) {
    if (loader) {
      loader.innerHTML = `
        <div style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted);">
          <i class="fa-solid fa-circle-exclamation" style="font-size: 3rem; color: #ef4444; margin-bottom: 1rem;"></i>
          <h2>Failed to load issue details</h2>
          <p style="margin-top: 0.5rem;">${error || 'Issue not found'}</p>
          <a href="index.html" class="btn btn-secondary" style="margin-top: 1.5rem;">Return to Dashboard</a>
        </div>
      `;
      loader.style.height = 'auto';
    }
    return;
  }

  issueDetailData = issue;

  // Render elements
  document.getElementById('issue-title').textContent = issue.title;
  document.getElementById('issue-description').textContent = issue.description;
  document.getElementById('issue-address').textContent = issue.address || 'Location detected. Address unavailable.';
  document.getElementById('issue-lat').textContent = issue.latitude.toFixed(5);
  document.getElementById('issue-lng').textContent = issue.longitude.toFixed(5);
  document.getElementById('upvotes-count').textContent = issue.upvotes_count || 0;
  
  // Reporter info
  const reporterName = issue.reporter?.full_name || 'Anonymous Citizen';
  document.getElementById('reporter-name').textContent = reporterName;
  document.getElementById('reporter-avatar').textContent = reporterName.charAt(0).toUpperCase();
  const formattedDate = formatDate(new Date(issue.created_at));
  document.getElementById('issue-date').textContent = window.i18n ? window.i18n.t('reported_on', { date: formattedDate }) : `Reported on ${formattedDate}`;

  // Image handling
  const imgElement = document.getElementById('issue-image');
  if (issue.image_url) {
    imgElement.src = issue.image_url;
    document.getElementById('issue-image-container').classList.remove('hidden');
  } else {
    document.getElementById('issue-image-container').classList.add('hidden');
  }

  const categoryBadge = document.getElementById('issue-category-badge');
  categoryBadge.textContent = window.formatCategoryName(issue.category);
  categoryBadge.className = `badge badge-category ${issue.category}`;

  const statusBadge = document.getElementById('issue-status-badge');
  const statusKey = `status_${issue.status}`;
  statusBadge.textContent = window.i18n ? window.i18n.t(statusKey) : issue.status.replace('_', ' ');
  statusBadge.className = `badge badge-status ${issue.status}`;

  // Update visual stepper
  updateStepperUI(issue.status);

  // Toggle Emergency Alert Banner
  const emergencyBanner = document.getElementById('emergency-alert-banner');
  if (emergencyBanner) {
    if (issue.is_emergency) {
      emergencyBanner.classList.remove('hidden');
    } else {
      emergencyBanner.classList.add('hidden');
    }
  }

  // Toggle Citizen Verification and Resolution Proof Showcase
  const verifyPanel = document.getElementById('citizen-verification-panel');
  const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const isReporter = currentUser && currentUser.id === issue.reporter_id;

  if (verifyPanel) {
    if (issue.status === 'resolved' && isReporter) {
      verifyPanel.classList.remove('hidden');
    } else {
      verifyPanel.classList.add('hidden');
    }
  }

  const showcaseCard = document.getElementById('resolution-proof-showcase');
  if (showcaseCard) {
    if ((issue.status === 'resolved' || issue.status === 'verified') && (issue.completion_proof_url || issue.completion_notes)) {
      showcaseCard.classList.remove('hidden');
      const showcaseNotes = document.getElementById('showcase-proof-notes');
      if (showcaseNotes) {
        showcaseNotes.textContent = issue.completion_notes || (window.i18n ? window.i18n.t('no_resolution_notes') : 'No resolution notes provided.');
      }
      const showcaseImg = document.getElementById('showcase-proof-image');
      const imgWrapper = document.getElementById('showcase-proof-image-wrapper');
      if (showcaseImg && imgWrapper) {
        if (issue.completion_proof_url) {
          showcaseImg.src = issue.completion_proof_url;
          imgWrapper.classList.remove('hidden');
        } else {
          imgWrapper.classList.add('hidden');
        }
      }
    } else {
      showcaseCard.classList.add('hidden');
    }
  }

  // Check upvote memory
  const upvoteBtn = document.getElementById('btn-upvote');
  if (issue.user_has_upvoted) {
    upvoteBtn.classList.add('upvoted');
  } else {
    upvoteBtn.classList.remove('upvoted');
  }

  // Draw Map
  if (!detailsMap) {
    initDetailsMiniMap(issue.latitude, issue.longitude, issue.category);
  }

  // Draw timeline history from DB logs
  renderTimeline(issue);

  // Render comments
  renderCommentsList(issue.comments || []);

  // Configure RBAC Control Panel visibility
  renderControlPanelUI(issue.status);

  // Render AI Insights Card if AI data is available
  // Render AI Insights Card (Always visible, show sensible placeholders if null/undefined)
  const aiCard = document.getElementById('ai-insights-card');
  if (aiCard) {
    aiCard.classList.remove('hidden');
    
    const summaryText = document.getElementById('ai-summary-text');
    if (summaryText) {
      summaryText.textContent = issue.ai_summary || (window.i18n ? window.i18n.t('no_summary_generated') : 'No summary generated.');
    }
    
    const aiCatBadge = document.getElementById('ai-category-badge');
    if (aiCatBadge) {
      const aiCategory = issue.ai_category || 'other';
      aiCatBadge.textContent = window.formatCategoryName(aiCategory);
      aiCatBadge.className = `badge badge-category ${aiCategory}`;
    }
    
    const aiPriorityBadge = document.getElementById('ai-priority-badge');
    if (aiPriorityBadge) {
      const aiPriority = issue.ai_priority || 'low';
      aiPriorityBadge.textContent = aiPriority.toUpperCase();
      let priorityClass = 'badge-priority medium';
      if (aiPriority === 'low') priorityClass = 'badge-priority low';
      else if (aiPriority === 'high') priorityClass = 'badge-priority high';
      else if (aiPriority === 'critical') priorityClass = 'badge-priority critical';
      aiPriorityBadge.className = `badge ${priorityClass}`;
    }
    
    const aiDeptText = document.getElementById('ai-dept-text');
    if (aiDeptText) {
      aiDeptText.innerHTML = `<i class="fa-solid fa-building-flag"></i> ${issue.ai_department || 'Department of Public Works'}`;
    }
  }

  // Hide loader, show content
  if (loader) loader.classList.add('hidden');
  if (content) content.classList.remove('hidden');

  // Load new features (evidence, chat, citizen actions)
  await loadNewFeatures(issue);
}

// Draw Leaflet Mini Map
function initDetailsMiniMap(lat, lng, category) {
  const mapElement = document.getElementById('details-map');
  if (!mapElement) return;

  detailsMap = L.map('details-map', {
    zoomControl: true,
    dragging: !L.Browser.mobile,
    tap: !L.Browser.mobile
  }).setView([lat, lng], 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(detailsMap);

  const markerHtml = `
    <div style="
      width: 24px; 
      height: 24px; 
      border-radius: 50%; 
      border: 2px solid white; 
      box-shadow: var(--shadow-md); 
      background-color: var(--color-${category});
    "></div>
  `;

  const customIcon = L.divIcon({
    html: markerHtml,
    className: 'div-icon-container',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  L.marker([lat, lng], { icon: customIcon }).addTo(detailsMap);
}

// Render Comments Thread list
function renderCommentsList(comments) {
  const listContainer = document.getElementById('comments-list');
  const countSpan = document.getElementById('comments-count');
  
  if (!listContainer) return;

  countSpan.textContent = comments.length;

  if (comments.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.9rem;">
        ${window.i18n ? window.i18n.t('profile_no_comments') : 'No comments yet. Start the discussion!'}
      </div>
    `;
    return;
  }

  listContainer.innerHTML = comments.map(comment => {
    const authorName = comment.profiles?.full_name || 'Citizen';
    const initial = authorName.charAt(0).toUpperCase();
    const timeAgo = formatTimeAgo(new Date(comment.created_at));
    const user = getCurrentUser();
    const isOwner = user && (user.id === comment.user_id);
    const isAdmin = user && (getUserRole() === 'admin');

    let actionsHtml = '';
    if (isOwner) {
      actionsHtml = `
        <div class="comment-actions" style="display: flex; gap: 0.25rem;">
          <button class="btn-icon-sm" onclick="startEditComment('${comment.id}')" title="Edit" style="width:24px; height:24px; font-size:0.75rem; background:none; border:none; color:var(--text-muted); cursor:pointer;"><i class="fa-regular fa-edit"></i></button>
          <button class="btn-icon-sm" onclick="deleteComment('${comment.id}')" title="Delete" style="width:24px; height:24px; font-size:0.75rem; background:none; border:none; color:#ef4444; cursor:pointer;"><i class="fa-regular fa-trash-can"></i></button>
        </div>
      `;
    } else if (isAdmin) {
      actionsHtml = `
        <div class="comment-actions" style="display: flex; gap: 0.25rem;">
          <button class="btn-icon-sm" onclick="deleteComment('${comment.id}')" title="Delete" style="width:24px; height:24px; font-size:0.75rem; background:none; border:none; color:#ef4444; cursor:pointer;"><i class="fa-regular fa-trash-can"></i></button>
        </div>
      `;
    }

    return `
      <div class="comment-card" data-id="${comment.id}" style="background-color: var(--bg-app); border-radius: var(--radius-md); padding: 1rem; border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
        <div class="comment-header" style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem;">
          <span class="comment-author" style="font-weight: 600; color: var(--text-main); display: flex; align-items: center; gap: 0.5rem;">
            <div class="user-avatar" style="width: 20px; height: 20px; font-size: 0.65rem;">${initial}</div>
            ${escapeHTML(authorName)}
          </span>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="comment-date" style="color: var(--text-muted);">${timeAgo}</span>
            ${actionsHtml}
          </div>
        </div>
        <p class="comment-text" style="white-space: pre-wrap; font-size: 0.9rem; color: var(--text-main); line-height: 1.5; margin: 0;">${escapeHTML(comment.comment_text)}</p>
      </div>
    `;
  }).join('');
}

// Render Status History Timeline from logs
function renderTimeline(issue) {
  const list = document.getElementById('timeline-list');
  if (!list) return;

  const history = issue.history || [];

  if (history.length === 0) {
    // Fallback if logs array is missing
    const tPendingStatus = window.i18n ? window.i18n.t('status_pending') : 'Pending';
    const tSavedSuccess = window.i18n ? window.i18n.t('complaint_saved_success') : 'Complaint successfully saved in public database.';
    list.innerHTML = `
      <div style="position: relative;">
        <div style="position: absolute; left: -21px; top: 3px; width: 10px; height: 10px; border-radius: 50%; background-color: var(--primary); border: 2px solid var(--bg-surface);"></div>
        <div style="font-size: 0.85rem; font-weight: 700;">Status: ${tPendingStatus}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${formatDate(new Date(issue.created_at))}</div>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">${tSavedSuccess}</p>
      </div>
    `;
    return;
  }

  list.innerHTML = history.map((log) => {
    let dotColor = 'var(--primary)';
    if (log.status === 'resolved') dotColor = '#10b981'; // Green
    else if (log.status === 'rejected') dotColor = '#ef4444'; // Red
    else if (log.status === 'assigned') dotColor = '#f59e0b'; // Orange
    else if (log.status === 'in_progress') dotColor = '#8b5cf6'; // Purple

    let statusKey = `status_${log.status}`;
    const statusLabel = window.i18n ? window.i18n.t(statusKey) : log.status.replace('_', ' ');
    const updaterName = log.profiles?.full_name ? (window.i18n ? ' ' + window.i18n.t('by_author', { name: log.profiles.full_name }) : ` by ${log.profiles.full_name}`) : '';
    
    return `
      <div style="position: relative; margin-bottom: 1rem;">
        <div style="position: absolute; left: -21px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background-color: ${dotColor}; border: 2px solid var(--bg-surface); z-index: 5;"></div>
        <div style="font-size: 0.85rem; font-weight: 700; text-transform: capitalize;">Status: ${statusLabel}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${formatDate(new Date(log.created_at))}${escapeHTML(updaterName)}</div>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">${escapeHTML(log.notes)}</p>
      </div>
    `;

  }).join('');
}

// Render Control Panel visibility based on user roles
function renderControlPanelUI(status) {
  const panel = document.getElementById('authority-control-panel');
  const adminActions = document.getElementById('admin-only-actions');
  const select = document.getElementById('control-status-select');

  if (!panel) return;

  const role = typeof getUserRole === 'function' ? getUserRole() : null;

  if (role === 'authority' || role === 'admin') {
    panel.classList.remove('hidden');
    if (select) select.value = status;
  } else {
    panel.classList.add('hidden');
  }

  if (role === 'admin') {
    if (adminActions) adminActions.classList.remove('hidden');
  } else {
    if (adminActions) adminActions.classList.add('hidden');
  }
}

// Set up event listeners for control actions
function setupControlPanel() {
  const updateStatusBtn = document.getElementById('btn-update-status');
  const deleteBtn = document.getElementById('btn-delete-issue');
  const statusSelect = document.getElementById('control-status-select');
  const proofForm = document.getElementById('resolution-proof-form');

  if (statusSelect && proofForm) {
    statusSelect.addEventListener('change', () => {
      if (statusSelect.value === 'resolved') {
        proofForm.classList.remove('hidden');
      } else {
        proofForm.classList.add('hidden');
      }
    });
    // Trigger initially if resolved is pre-selected
    if (statusSelect.value === 'resolved') {
      proofForm.classList.remove('hidden');
    }
  }

  if (updateStatusBtn && statusSelect) {
    updateStatusBtn.addEventListener('click', async () => {
      const status = statusSelect.value;
      
      let payload = null;
      if (status === 'resolved') {
        const fileInput = document.getElementById('control-proof-file');
        const notesInput = document.getElementById('control-notes-input');
        const notes = notesInput ? notesInput.value.trim() : '';

        if (!fileInput || fileInput.files.length === 0) {
          window.showToast('Please upload a completion proof image to resolve this complaint.', 'warning');
          return;
        }
        if (!notes || notes.length < 5) {
          window.showToast('Please provide detailed completion notes (at least 5 characters).', 'warning');
          return;
        }

        const formData = new FormData();
        formData.append('status', status);
        formData.append('notes', notes);
        formData.append('proof', fileInput.files[0]);
        payload = formData;
      } else {
        const notes = prompt(`Optional: Enter notes for the status change to ${status.toUpperCase()}:`, '');
        if (notes === null) return; // User cancelled
        payload = { status, notes };
      }

      updateStatusBtn.disabled = true;
      updateStatusBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...';

      const { data, error } = await window.API.updateIssueStatus(issueId, payload);

      updateStatusBtn.disabled = false;
      updateStatusBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Status';

      if (error) {
        window.showToast(`Failed to update status: ${error}`, 'error');
      } else {
        window.showToast('Issue status updated successfully!', 'success');
        const fileInput = document.getElementById('control-proof-file');
        const notesInput = document.getElementById('control-notes-input');
        if (fileInput) fileInput.value = '';
        if (notesInput) notesInput.value = '';
        if (proofForm) proofForm.classList.add('hidden');
        
        await loadIssueDetails();
      }
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (confirm('⚠️ WARNING: Are you sure you want to permanently delete this issue report? This action cannot be undone.')) {
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Deleting...';

        const { error } = await window.API.deleteIssue(issueId);

        deleteBtn.disabled = false;
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Delete Issue';

        if (error) {
          window.showToast(`Failed to delete issue: ${error}`, 'error');
        } else {
          window.showToast('Issue deleted successfully.', 'success');
          window.location.href = 'citizen-dashboard.html';
        }
      }
    });
  }
}

// Handle Comment submit
function setupCommentSubmit() {
  const form = document.getElementById('comment-form');
  const alertBanner = document.getElementById('comments-alert');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBanner.classList.add('hidden');

    if (typeof getCurrentUser === 'function' && !getCurrentUser()) {
      alertBanner.textContent = 'You must be signed in to post comments.';
      alertBanner.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
      alertBanner.style.color = '#ef4444';
      alertBanner.classList.remove('hidden');
      return;
    }

    const text = document.getElementById('comment-text').value.trim();
    if (!text) return;

    const submitBtn = document.getElementById('btn-submit-comment');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Posting...';

    const { data: newComment, error } = await window.API.addComment(issueId, text);

    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-regular fa-paper-plane"></i> Post Comment';

    if (error) {
      alertBanner.textContent = `Comment post failed: ${error}`;
      alertBanner.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
      alertBanner.style.color = '#ef4444';
      alertBanner.classList.remove('hidden');
    } else {
      document.getElementById('comment-text').value = '';
      
      if (issueDetailData) {
        if (!issueDetailData.comments) issueDetailData.comments = [];
        issueDetailData.comments.push(newComment);
        renderCommentsList(issueDetailData.comments);
      }
    }
  });
}

// Handle Upvote click
function setupUpvoteAction() {
  const upvoteBtn = document.getElementById('btn-upvote');
  const countSpan = document.getElementById('upvotes-count');

  if (!upvoteBtn) return;

  upvoteBtn.addEventListener('click', async () => {
    if (typeof getCurrentUser === 'function' && !getCurrentUser()) {
      window.showToast("You must be logged in to upvote civic issues.", "warning");
      window.authRouter.redirectToLogin('citizen');
      return;
    }

    upvoteBtn.disabled = true;

    const { data, error } = await window.API.upvoteIssue(issueId);

    upvoteBtn.disabled = false;

    if (error) {
      console.error("Upvote toggle failed:", error);
      return;
    }

    if (data.upvoted !== undefined) {
      if (data.upvoted) {
        upvoteBtn.classList.add('upvoted');
        localStorage.setItem(`voted-${issueId}`, 'true');
      } else {
        upvoteBtn.classList.remove('upvoted');
        localStorage.removeItem(`voted-${issueId}`);
      }
    }

    if (data.upvotes_count !== undefined) {
      countSpan.textContent = data.upvotes_count;
    } else if (data.upvoted !== undefined) {
      let val = parseInt(countSpan.textContent);
      countSpan.textContent = data.upvoted ? val + 1 : Math.max(0, val - 1);
    }
  });
}

// Helper date formatter
function formatDate(date) {
  const lang = window.i18n ? window.i18n.getLanguage() : 'en';
  return date.toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
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

// Listen for custom authentication changes (triggers re-evaluation of panels on role-switch)
window.addEventListener('auth-change', async () => {
  console.log("Auth change event caught. Re-rendering details panels...");
  await loadIssueDetails();
});

// Bootstrap details page
window.addEventListener('DOMContentLoaded', () => {
  initDetailsPage();
});

window.addEventListener('language-change', () => {
  if (window.i18n) {
    window.i18n.translatePage();
  }
  if (issueDetailData) {
    const issue = issueDetailData;
    
    const formattedDate = formatDate(new Date(issue.created_at));
    const dateEl = document.getElementById('issue-date');
    if (dateEl) dateEl.textContent = window.i18n ? window.i18n.t('reported_on', { date: formattedDate }) : `Reported on ${formattedDate}`;

    const categoryBadge = document.getElementById('issue-category-badge');
    if (categoryBadge) {
      categoryBadge.textContent = window.formatCategoryName(issue.category);
    }

    const statusBadge = document.getElementById('issue-status-badge');
    if (statusBadge) {
      const statusKey = `status_${issue.status}`;
      statusBadge.textContent = window.i18n ? window.i18n.t(statusKey) : issue.status.replace('_', ' ');
    }

    updateStepperUI(issue.status);

    const showcaseCard = document.getElementById('resolution-proof-showcase');
    if (showcaseCard && !showcaseCard.classList.contains('hidden')) {
      const showcaseNotes = document.getElementById('showcase-proof-notes');
      if (showcaseNotes) {
        showcaseNotes.textContent = issue.completion_notes || (window.i18n ? window.i18n.t('no_resolution_notes') : 'No resolution notes provided.');
      }
    }

    const aiCard = document.getElementById('ai-insights-card');
    if (aiCard) {
      const summaryText = document.getElementById('ai-summary-text');
      if (summaryText) {
        summaryText.textContent = issue.ai_summary || (window.i18n ? window.i18n.t('no_summary_generated') : 'No summary generated.');
      }
      const aiCatBadge = document.getElementById('ai-category-badge');
      if (aiCatBadge) {
        const aiCategory = issue.ai_category || 'other';
        aiCatBadge.textContent = window.formatCategoryName(aiCategory);
        aiCatBadge.className = `badge badge-category ${aiCategory}`;
      }
      const aiPriorityBadge = document.getElementById('ai-priority-badge');
      if (aiPriorityBadge) {
        const aiPriority = issue.ai_priority || 'low';
        aiPriorityBadge.textContent = aiPriority.toUpperCase();
        let priorityClass = 'badge-priority medium';
        if (aiPriority === 'low') priorityClass = 'badge-priority low';
        else if (aiPriority === 'high') priorityClass = 'badge-priority high';
        else if (aiPriority === 'critical') priorityClass = 'badge-priority critical';
        aiPriorityBadge.className = `badge ${priorityClass}`;
      }
      const aiDeptText = document.getElementById('ai-dept-text');
      if (aiDeptText) {
        aiDeptText.innerHTML = `<i class="fa-solid fa-building-flag"></i> ${issue.ai_department || 'Department of Public Works'}`;
      }
    }

    renderTimeline(issue);
    renderCommentsList(issue.comments || []);
  }
});


// Comment Editing & Deletion Operations
window.startEditComment = function(commentId) {
  const commentCard = document.querySelector(`.comment-card[data-id="${commentId}"]`);
  if (!commentCard) return;
  
  const textElement = commentCard.querySelector('.comment-text');
  const originalText = textElement.textContent;
  
  commentCard.dataset.originalText = originalText;
  
  textElement.innerHTML = `
    <div class="edit-comment-wrapper" style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; width: 100%;">
      <textarea class="form-textarea edit-comment-textarea" style="min-height: 70px; font-size: 0.9rem; padding: 0.5rem; width: 100%; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">${originalText}</textarea>
      <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
        <button class="btn btn-secondary" onclick="cancelEditComment('${commentId}')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; border-radius: var(--radius-sm);">Cancel</button>
        <button class="btn btn-primary" onclick="saveEditComment('${commentId}')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; border-radius: var(--radius-sm);">Save</button>
      </div>
    </div>
  `;
  
  const actions = commentCard.querySelector('.comment-actions');
  if (actions) actions.style.display = 'none';
};

window.cancelEditComment = function(commentId) {
  const commentCard = document.querySelector(`.comment-card[data-id="${commentId}"]`);
  if (!commentCard) return;
  
  const textElement = commentCard.querySelector('.comment-text');
  const originalText = commentCard.dataset.originalText;
  textElement.textContent = originalText;
  
  const actions = commentCard.querySelector('.comment-actions');
  if (actions) actions.style.display = 'flex';
};

window.saveEditComment = async function(commentId) {
  const commentCard = document.querySelector(`.comment-card[data-id="${commentId}"]`);
  if (!commentCard) return;
  
  const textarea = commentCard.querySelector('.edit-comment-textarea');
  const newText = textarea.value.trim();
  if (!newText) return;
  
  const { data, error } = await window.API.editComment(commentId, newText);
  if (error) {
    window.showToast("Failed to edit comment: " + error, "error");
    return;
  }
  
  if (issueDetailData && issueDetailData.comments) {
    const comment = issueDetailData.comments.find(c => c.id === commentId);
    if (comment) {
      comment.comment_text = newText;
    }
  }
  
  renderCommentsList(issueDetailData.comments);
};

window.deleteComment = async function(commentId) {
  if (!confirm("Are you sure you want to delete this comment?")) return;
  
  const { error } = await window.API.deleteComment(commentId);
  if (error) {
    window.showToast("Failed to delete comment: " + error, "error");
    return;
  }
  
  if (issueDetailData && issueDetailData.comments) {
    issueDetailData.comments = issueDetailData.comments.filter(c => c.id !== commentId);
    renderCommentsList(issueDetailData.comments);
  }
};

// Update Visual Progress Stepper
function updateStepperUI(status) {
  const steps = ['reported', 'assigned', 'in_progress', 'resolved', 'verified'];
  
  let activeIndex = 0; // reported (pending)
  if (status === 'assigned') activeIndex = 1;
  else if (status === 'in_progress') activeIndex = 2;
  else if (status === 'resolved') activeIndex = 3;
  else if (status === 'verified') activeIndex = 4;
  else if (status === 'rejected') {
    const resolvedLabel = document.querySelector('#step-resolved .step-label');
    const resolvedCircle = document.querySelector('#step-resolved .step-circle');
    if (resolvedLabel && resolvedCircle) {
      resolvedLabel.textContent = "Rejected";
      resolvedCircle.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
    }
    activeIndex = 3; // Make line flow all the way but marked as rejected
  }

  // Update nodes styling
  steps.forEach((stepName, index) => {
    const node = document.getElementById(`step-${stepName}`);
    if (!node) return;

    const circle = node.querySelector('.step-circle');
    const label = node.querySelector('.step-label');

    if (index <= activeIndex) {
      circle.style.borderColor = 'var(--primary)';
      circle.style.backgroundColor = 'var(--primary)';
      circle.style.color = '#ffffff';
      circle.style.boxShadow = 'var(--shadow-glow)';
      label.style.color = 'var(--text-main)';
    } else {
      circle.style.borderColor = 'var(--border-color)';
      circle.style.backgroundColor = 'var(--bg-app)';
      circle.style.color = 'var(--text-muted)';
      circle.style.boxShadow = 'none';
      label.style.color = 'var(--text-muted)';
    }
    
    if (status === 'rejected' && index === 3) {
      circle.style.borderColor = '#ef4444';
      circle.style.backgroundColor = '#ef4444';
      circle.style.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.15)';
    }
  });

  // Update line progress
  const progressLine = document.getElementById('stepper-progress-line');
  if (progressLine) {
    const percentage = (activeIndex / (steps.length - 1)) * 100;
    progressLine.style.width = `${percentage}%`;
    if (status === 'rejected') {
      progressLine.style.background = 'linear-gradient(90deg, var(--primary) 0%, #ef4444 100%)';
    } else {
      progressLine.style.background = 'var(--primary)';
    }
  }
}

// Set up Citizen Verification Actions
function setupVerificationActions() {
  const approveBtn = document.getElementById('btn-verify-approve');
  const reopenBtn = document.getElementById('btn-verify-reopen');

  if (approveBtn) {
    approveBtn.addEventListener('click', async () => {
      approveBtn.disabled = true;
      approveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Verifying...';

      const { error } = await window.API.verifyIssue(issueId);

      approveBtn.disabled = false;
      approveBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> Approve & Verify';

      if (error) {
        window.showToast(`Failed to verify resolution: ${error}`, "error");
      } else {
        window.showToast('Thank you! You have successfully verified and approved the resolution.', "success");
        await loadIssueDetails();
      }
    });
  }

  if (reopenBtn) {
    reopenBtn.addEventListener('click', async () => {
      const reason = prompt('Please enter the reason for reopening this complaint (e.g. issues still persist):');
      if (reason === null) return; // Cancelled
      if (reason.trim() === '') {
        window.showToast('A reason is required to reopen the complaint.', "warning");
        return;
      }

      reopenBtn.disabled = true;
      reopenBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Reopening...';

      const { error } = await window.API.reopenIssue(issueId, reason.trim());

      reopenBtn.disabled = false;
      reopenBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Reopen Complaint';

      if (error) {
        window.showToast(`Failed to reopen complaint: ${error}`, "error");
      } else {
        window.showToast('Complaint has been reopened. Responding crews will be notified.', "success");
        await loadIssueDetails();
      }
    });
  }
}

// ============================================================
// NEW FEATURES: Citizen Actions, Evidence, Chat, Withdraw
// ============================================================

let chatRealtimeChannel = null;
let chatPresenceChannel = null;

// Setup citizen-specific action panel and all new feature handlers
function setupCitizenActions() {
  const panel = document.getElementById('citizen-actions-panel');
  const withdrawBtn = document.getElementById('btn-withdraw');
  const receiptBtn = document.getElementById('btn-download-receipt');
  const showEvidenceBtn = document.getElementById('btn-show-evidence-upload');
  const uploadBtn = document.getElementById('btn-upload-evidence');
  const evidenceSection = document.getElementById('evidence-upload-section');
  const evidenceDropzone = document.getElementById('evidence-dropzone');
  const evidenceFileInput = document.getElementById('evidence-file-input');

  // Download Receipt
  if (receiptBtn) {
    receiptBtn.addEventListener('click', async () => {
      let token = null;
      if (typeof window.getOrRefreshAccessToken === 'function') {
        token = await window.getOrRefreshAccessToken();
      } else if (typeof getAuthToken === 'function') {
        token = getAuthToken();
      }
      const receiptUrl = `/api/issues/${issueId}/receipt${token ? '?token=' + encodeURIComponent(token) : ''}`;
      window.open(receiptUrl, '_blank');
    });
  }

  // Toggle evidence upload section
  if (showEvidenceBtn && evidenceSection) {
    showEvidenceBtn.addEventListener('click', () => {
      evidenceSection.classList.toggle('hidden');
    });
  }

  // Evidence dropzone click
  if (evidenceDropzone && evidenceFileInput) {
    evidenceDropzone.addEventListener('click', () => evidenceFileInput.click());
    evidenceFileInput.addEventListener('change', () => {
      if (uploadBtn) {
        uploadBtn.disabled = !evidenceFileInput.files || evidenceFileInput.files.length === 0;
      }
    });
  }

  // Upload evidence files
  if (uploadBtn) {
    uploadBtn.addEventListener('click', async () => {
      if (!evidenceFileInput || !evidenceFileInput.files || evidenceFileInput.files.length === 0) return;

      const progressEl = document.getElementById('evidence-upload-progress');
      if (progressEl) progressEl.classList.remove('hidden');
      uploadBtn.disabled = true;
      uploadBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Uploading...';

      const formData = new FormData();
      for (let i = 0; i < evidenceFileInput.files.length; i++) {
        formData.append('evidence', evidenceFileInput.files[i]);
      }

      const { data, error } = await window.API.uploadEvidence(issueId, formData);

      if (progressEl) progressEl.classList.add('hidden');
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Upload Files';

      if (error) {
        window.showToast(`Evidence upload failed: ${error}`, 'error');
      } else {
        window.showToast('Evidence uploaded successfully!', 'success');
        evidenceFileInput.value = '';
        uploadBtn.disabled = true;
        evidenceSection.classList.add('hidden');
        // Reload to refresh evidence gallery
        await loadIssueDetails();
      }
    });
  }

  // Withdraw button → show modal
  if (withdrawBtn) {
    withdrawBtn.addEventListener('click', () => {
      const modal = document.getElementById('withdraw-modal');
      if (modal) modal.classList.remove('hidden');
    });
  }

  // Withdraw modal handlers
  const withdrawModal = document.getElementById('withdraw-modal');
  const withdrawCancel = document.getElementById('withdraw-cancel-btn');
  const withdrawConfirm = document.getElementById('withdraw-confirm-btn');
  const withdrawBackdrop = document.getElementById('withdraw-modal-backdrop');

  function closeWithdrawModal() {
    if (withdrawModal) withdrawModal.classList.add('hidden');
    const reasonInput = document.getElementById('withdraw-reason');
    if (reasonInput) reasonInput.value = '';
  }

  if (withdrawCancel) withdrawCancel.addEventListener('click', closeWithdrawModal);
  if (withdrawBackdrop) withdrawBackdrop.addEventListener('click', closeWithdrawModal);

  if (withdrawConfirm) {
    withdrawConfirm.addEventListener('click', async () => {
      const reasonInput = document.getElementById('withdraw-reason');
      const reason = reasonInput ? reasonInput.value.trim() : '';

      withdrawConfirm.disabled = true;
      withdrawConfirm.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Withdrawing...';

      const { error } = await window.API.withdrawIssue(issueId, reason);

      withdrawConfirm.disabled = false;
      withdrawConfirm.innerHTML = 'Confirm Withdraw';

      if (error) {
        window.showToast(`Failed to withdraw: ${error}`, 'error');
      } else {
        window.showToast('Complaint has been withdrawn successfully.', 'success');
        closeWithdrawModal();
        await loadIssueDetails();
      }
    });
  }

  // Chat form submit
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');

  if (chatForm) {
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = chatInput ? chatInput.value.trim() : '';
      if (!text) return;

      const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
      if (!currentUser) {
        window.showToast('You must be logged in to send messages.', 'warning');
        return;
      }

      // Optimistically append the message
      appendChatMessage({
        message_text: text,
        sender_id: currentUser.id,
        created_at: new Date().toISOString(),
        sender: { full_name: currentUser.user_metadata?.full_name || 'You' }
      });

      chatInput.value = '';

      const { error } = await window.API.sendChatMessage(issueId, text);
      if (error) {
        window.showToast(`Message failed: ${error}`, 'error');
      }
    });
  }
}

// Render evidence gallery from attachments array
function renderEvidenceGallery(attachments) {
  const gallery = document.getElementById('evidence-gallery');
  if (!gallery) return;

  if (!attachments || attachments.length === 0) {
    gallery.classList.add('hidden');
    return;
  }

  gallery.classList.remove('hidden');
  gallery.innerHTML = `
    <div class="glass-panel" style="padding: 0; overflow: hidden;">
      <div style="padding: 1rem 1.5rem 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
        <i class="fa-solid fa-images" style="color: var(--primary);"></i>
        <h4 style="font-size: 1rem; font-family: var(--font-heading); margin: 0;">Evidence Attachments (${attachments.length})</h4>
      </div>
      <div class="evidence-grid">
        ${attachments.map(att => `
          <div class="evidence-thumb" onclick="window.open('${att.url || att.file_url || ''}', '_blank')">
            <img src="${att.url || att.file_url || att.thumbnail_url || ''}" alt="Evidence" loading="lazy">
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Render all chat messages
function renderChatMessages(messages) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;

  if (!messages || messages.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 2rem 0;">No messages yet. Start the conversation!</div>';
    return;
  }

  container.innerHTML = messages.map(msg => {
    const isSent = currentUser && msg.sender_id === currentUser.id;
    const senderName = msg.sender?.full_name || (isSent ? 'You' : 'Authority');
    const timeStr = new Date(msg.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    return `
      <div class="chat-bubble ${isSent ? 'sent' : 'received'}">
        <div style="font-size: 0.72rem; font-weight: 600; margin-bottom: 0.15rem; opacity: 0.85;">${escapeHTML(senderName)}</div>
        ${escapeHTML(msg.message_text)}
        <span class="chat-time">${timeStr}</span>
      </div>
    `;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

// Append a single new chat message
function appendChatMessage(message) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  // Clear "no messages" placeholder
  const placeholder = container.querySelector('div[style*="text-align: center"]');
  if (placeholder && placeholder.textContent.includes('No messages')) {
    placeholder.remove();
  }

  const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const isSent = currentUser && message.sender_id === currentUser.id;
  const senderName = message.sender?.full_name || (isSent ? 'You' : 'Authority');
  const timeStr = new Date(message.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${isSent ? 'sent' : 'received'}`;
  bubble.innerHTML = `
    <div style="font-size: 0.72rem; font-weight: 600; margin-bottom: 0.15rem; opacity: 0.85;">${escapeHTML(senderName)}</div>
    ${escapeHTML(message.message_text)}
    <span class="chat-time">${timeStr}</span>
  `;

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

// Setup Supabase Realtime subscription for chat messages & presence status
function setupChatRealtime(currentIssueId) {
  // Clean up existing subscriptions
  if (chatRealtimeChannel && typeof supabaseClient !== 'undefined' && supabaseClient) {
    supabaseClient.removeChannel(chatRealtimeChannel);
    chatRealtimeChannel = null;
  }
  if (chatPresenceChannel && typeof supabaseClient !== 'undefined' && supabaseClient) {
    supabaseClient.removeChannel(chatPresenceChannel);
    chatPresenceChannel = null;
  }

  if (typeof supabaseClient === 'undefined' || !supabaseClient) return;

  // 1. Subscribe to Chat Messages
  chatRealtimeChannel = supabaseClient
    .channel(`public:messages:issue_${currentIssueId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `issue_id=eq.${currentIssueId}`
    }, (payload) => {
      const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
      // Don't duplicate messages we sent ourselves (already optimistically appended)
      if (currentUser && payload.new.sender_id === currentUser.id) return;
      appendChatMessage(payload.new);
    })
    .subscribe((status) => {
      console.log(`Chat Realtime subscription status: ${status}`);
    });

  // 2. Subscribe to Presence (Online Status tracking)
  const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  chatPresenceChannel = supabaseClient.channel(`presence:issue_${currentIssueId}`);
  chatPresenceChannel
    .on('presence', { event: 'sync' }, () => {
      const state = chatPresenceChannel.presenceState();
      let authorityOnline = false;
      Object.keys(state).forEach((key) => {
        state[key].forEach((pres) => {
          if (pres.role === 'authority') {
            authorityOnline = true;
          }
        });
      });

      const statusSpan = document.getElementById('chat-presence-status');
      if (statusSpan) {
        if (authorityOnline) {
          statusSpan.style.background = 'rgba(16, 185, 129, 0.1)';
          statusSpan.style.color = '#10b981';
          statusSpan.innerHTML = '<span style="width: 6px; height: 6px; border-radius: 50%; background-color: #10b981; box-shadow: 0 0 8px #10b981; display: inline-block;"></span>Online';
        } else {
          statusSpan.style.background = 'rgba(107, 114, 128, 0.1)';
          statusSpan.style.color = '#6b7280';
          statusSpan.innerHTML = '<span style="width: 6px; height: 6px; border-radius: 50%; background-color: #6b7280; display: inline-block;"></span>Offline';
        }
      }
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && currentUser) {
        await chatPresenceChannel.track({
          user_id: currentUser.id,
          role: 'citizen'
        });
      }
    });
}

// Load and configure new features after issue data is loaded
async function loadNewFeatures(issue) {
  const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const isReporter = currentUser && currentUser.id === issue.reporter_id;

  // === Always Show Receipt & Upload Evidence Cards ===
  const receiptCard = document.getElementById('download-receipt-card');
  if (receiptCard) {
    receiptCard.style.display = 'flex';
    receiptCard.style.visibility = 'visible';
    receiptCard.style.opacity = '1';
    receiptCard.classList.remove('hidden');
  }

  const evidenceCard = document.getElementById('evidence-upload-section');
  if (evidenceCard) {
    evidenceCard.style.display = 'flex';
    evidenceCard.style.visibility = 'visible';
    evidenceCard.style.opacity = '1';
    evidenceCard.classList.remove('hidden');
  }

  // === Citizen Actions Panel (for Withdraw action) ===
  const citizenPanel = document.getElementById('citizen-actions-panel');
  if (citizenPanel) {
    const terminalStatuses = ['resolved', 'verified', 'withdrawn', 'rejected'];
    const isTerminal = terminalStatuses.includes(issue.status);
    const showWithdraw = !isTerminal && isReporter;
    
    const withdrawBtn = document.getElementById('btn-withdraw');
    if (withdrawBtn) {
      withdrawBtn.style.display = showWithdraw ? '' : 'none';
    }

    if (showWithdraw) {
      citizenPanel.classList.remove('hidden');
      citizenPanel.style.display = 'flex';
      citizenPanel.style.visibility = 'visible';
      citizenPanel.style.opacity = '1';
    } else {
      citizenPanel.classList.add('hidden');
      citizenPanel.style.display = 'none';
    }
  }

  // === Evidence Gallery ===
  renderEvidenceGallery(issue.attachments || issue.evidence || []);

  // === Chat Panel ===
  const chatPanel = document.getElementById('chat-panel');
  if (chatPanel) {
    if (issue.assigned_to) {
      chatPanel.classList.remove('hidden');

      // Load existing messages
      const { data: messages, error } = await window.API.getChatMessages(issueId);
      if (!error && messages) {
        renderChatMessages(Array.isArray(messages) ? messages : []);
      }

      // Setup realtime for new messages
      setupChatRealtime(issueId);
    } else {
      chatPanel.classList.add('hidden');
    }
  }
}
