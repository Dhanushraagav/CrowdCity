// CrowdCity - Case Casework caselog inspector controller

let issueId = null;
let issueDetailData = null;
let detailsMap = null;
let selectedProofFile = null;
let detailsRealtimeChannel = null;

document.addEventListener('DOMContentLoaded', () => {
  // Check auth session
  window.addEventListener('auth-change', (e) => {
    const user = getCurrentUser();
    const role = getUserRole();
    if (!user || (role !== 'authority' && role !== 'admin')) {
      window.authRouter.redirectToLogin('authority');
    } else {
      initCaseworkCaselogInspector();
    }
  });

  const user = getCurrentUser();
  if (user) {
    initCaseworkCaselogInspector();
  }
});

let isInitialized = false;

function initCaseworkCaselogInspector() {
  if (isInitialized) return;
  isInitialized = true;

  const urlParams = new URLSearchParams(window.location.search);
  issueId = urlParams.get('id');
  console.log(`[Inspector] Initializing with issue ID: ${issueId}`);

  if (!issueId) {
    console.error("Missing issue ID parameter.");
    window.location.href = 'authority-reports.html';
    return;
  }

  loadCaseDetails();
  setupFormHandlers();
}

async function loadCaseDetails() {
  if (!issueId) {
    console.warn("[Inspector] loadCaseDetails called but issueId is not set yet.");
    return;
  }
  const loader = document.getElementById('details-loader');
  const content = document.getElementById('details-content');

  try {
    console.log(`[Inspector] Fetching details for issue ID: ${issueId}`);
    const result = await window.API.getIssueDetails(issueId);
    console.log("[Inspector] API Response result:", result);

    const { data: issue, error } = result;

    if (error) {
      console.error("[Inspector] API Error occurred:", error);
      if (loader) {
        loader.innerHTML = `
          <div style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted);">
            <i class="fa-solid fa-circle-exclamation" style="font-size: 3rem; color: #ef4444; margin-bottom: 1rem;"></i>
            <h2>Failed to load case details</h2>
            <p style="margin-top: 0.5rem; color: var(--text-main); font-weight: 500;">Error: ${error}</p>
            <p style="margin-top: 0.25rem; font-size: 0.85rem; color: var(--text-muted);">Issue ID: ${issueId}</p>
            <a href="authority-reports.html" class="btn btn-secondary" style="margin-top: 1.5rem;">Return to Cases Register</a>
          </div>
        `;
      }
      return;
    }

    if (!issue) {
      console.error("[Inspector] Issue not found (null payload)");
      if (loader) {
        loader.innerHTML = `
          <div style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted);">
            <i class="fa-solid fa-circle-exclamation" style="font-size: 3rem; color: #ef4444; margin-bottom: 1rem;"></i>
            <h2>Issue not found</h2>
            <p style="margin-top: 0.5rem; color: var(--text-main); font-weight: 500;">Case file for specified ID does not exist in registry.</p>
            <p style="margin-top: 0.25rem; font-size: 0.85rem; color: var(--text-muted);">Issue ID: ${issueId}</p>
            <a href="authority-reports.html" class="btn btn-secondary" style="margin-top: 1.5rem;">Return to Cases Register</a>
          </div>
        `;
      }
      return;
    }

    issueDetailData = issue;

  // Toggle loaders
  if (loader) loader.classList.add('hidden');
  if (content) content.classList.remove('hidden');

  // Populate data
  document.getElementById('issue-title').textContent = issue.title;
  document.getElementById('issue-description').textContent = issue.description;
  document.getElementById('issue-lat').textContent = issue.latitude.toFixed(5);
  document.getElementById('issue-lng').textContent = issue.longitude.toFixed(5);
  document.getElementById('issue-address').textContent = issue.address || 'Location detected. Address unavailable.';

  // Format date
  const dateStr = new Date(issue.created_at).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  document.getElementById('issue-date').textContent = `Reported on ${dateStr}`;

  // Categorization and status badges
  const catBadge = document.getElementById('issue-category-badge');
  catBadge.textContent = window.formatCategoryName(issue.category);
  catBadge.className = `badge badge-category ${issue.category}`;

  const statusBadge = document.getElementById('issue-status-badge');
  statusBadge.textContent = issue.status.replace('_', ' ');
  statusBadge.className = `badge badge-status ${issue.status}`;

  // Image upload preview
  const imgElement = document.getElementById('issue-image');
  if (issue.image_url) {
    imgElement.src = issue.image_url;
    document.getElementById('issue-image-container').classList.remove('hidden');
  } else {
    document.getElementById('issue-image-container').classList.add('hidden');
  }

  // Toggle Emergency Alert Banner
  const emergencyBanner = document.getElementById('emergency-alert-banner');
  if (emergencyBanner) {
    if (issue.is_emergency) {
      emergencyBanner.classList.remove('hidden');
    } else {
      emergencyBanner.classList.add('hidden');
    }
  }

  // Reporter
  const reporterName = issue.reporter?.full_name || 'Anonymous Citizen';
  document.getElementById('reporter-name').textContent = reporterName;
  document.getElementById('reporter-avatar').textContent = reporterName.charAt(0).toUpperCase();

  // AI Insights
  document.getElementById('ai-summary-text').textContent = issue.ai_summary || 'No summary generated.';
  document.getElementById('ai-dept-text').textContent = issue.ai_department || 'Unassigned';
  
  const aiCat = document.getElementById('ai-category-badge');
  aiCat.textContent = window.formatCategoryName(issue.ai_category || 'other');
  aiCat.className = `badge badge-category ${issue.ai_category ? issue.ai_category.toLowerCase() : 'other'}`;

  const aiPri = document.getElementById('ai-priority-badge');
  const aiPriority = (issue.ai_priority || 'low').toLowerCase();
  aiPri.textContent = aiPriority.toUpperCase();
  let priorityClass = 'badge-priority medium';
  if (aiPriority === 'low') priorityClass = 'badge-priority low';
  else if (aiPriority === 'high') priorityClass = 'badge-priority high';
  else if (aiPriority === 'critical') priorityClass = 'badge-priority critical';
  aiPri.className = `badge ${priorityClass}`;

  // Showcase proof
  const showcase = document.getElementById('resolution-proof-showcase');
  if ((issue.status === 'resolved' || issue.status === 'verified') && (issue.completion_proof_url || issue.completion_notes)) {
    showcase.classList.remove('hidden');
    document.getElementById('showcase-proof-notes').textContent = issue.completion_notes || 'No resolution notes entered.';
    if (issue.completion_proof_url) {
      document.getElementById('showcase-proof-image').src = issue.completion_proof_url;
      document.getElementById('showcase-proof-image-wrapper').classList.remove('hidden');
    } else {
      document.getElementById('showcase-proof-image-wrapper').classList.add('hidden');
    }
  } else {
    showcase.classList.add('hidden');
  }

  // Draw Leaflet Map
  initDetailsMiniMap(issue.latitude, issue.longitude, issue.category);

  // Timeline
  renderCaseworkTimeline(issue);

  // Caseload Assign Controls
  renderAssignPanel(issue);

  // Synchronize form select state
  const statusSelect = document.getElementById('dispatch-status-select');
  if (statusSelect) {
    statusSelect.value = issue.status;
    // Trigger change event to toggle photo upload visibility
    statusSelect.dispatchEvent(new Event('change'));
  }

  // Load new features (evidence gallery, chat)
  await loadAuthorityNewFeatures(issue);

  initRealtimeDetails();
  } catch (error) {
    console.error("[Inspector] Exception in loadCaseDetails:", error);
    if (loader) {
      loader.innerHTML = `
        <div style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted);">
          <i class="fa-solid fa-circle-exclamation" style="font-size: 3rem; color: #ef4444; margin-bottom: 1rem;"></i>
          <h2>An unexpected error occurred</h2>
          <p style="margin-top: 0.5rem; color: var(--text-main); font-weight: 500;">Error: ${error.message || error}</p>
          <p style="margin-top: 0.25rem; font-size: 0.85rem; color: var(--text-muted);">Issue ID: ${issueId}</p>
          <a href="authority-reports.html" class="btn btn-secondary" style="margin-top: 1.5rem;">Return to Cases Register</a>
        </div>
      `;
    }
  }
}

function initRealtimeDetails() {
  if (detailsRealtimeChannel) {
    const client = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (client) {
      client.removeChannel(detailsRealtimeChannel);
    }
    detailsRealtimeChannel = null;
  }

  if (!issueId) return;
  if (!window.API || typeof window.API.subscribeRealtime !== 'function') return;

  detailsRealtimeChannel = window.API.subscribeRealtime({
    channelName: `public:auth_issue_details:${issueId}`,
    events: [
      { event: 'UPDATE', table: 'issues', filter: `id=eq.${issueId}` },
      { event: 'INSERT', table: 'comments', filter: `issue_id=eq.${issueId}` }
    ],
    onEvent: (event, payload) => {
      console.log(`[Authority Details Realtime] Event ${event} received.`, payload);
      
      const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;

      if (window.showToast) {
        if (event === 'UPDATE') {
          window.showToast(window.i18n ? window.i18n.t('toast_issue_updated') || 'Case details updated!' : 'Case details updated!', 'info');
        } else if (event === 'INSERT') {
          if (currentUser && payload.new.user_id === currentUser.id) return;
          window.showToast(window.i18n ? window.i18n.t('toast_new_comment') || 'New discussion comment added.' : 'New discussion comment added.', 'info');
        }
      }

      loadCaseDetails().catch(err => console.error("Error refreshing case details:", err));
    }
  });
}

function initDetailsMiniMap(lat, lng, category) {
  if (detailsMap) {
    detailsMap.setView([lat, lng], 14);
    return;
  }

  // Initialize Map
  detailsMap = L.map('details-mini-map', {
    zoomControl: false,
    attributionControl: false
  }).setView([lat, lng], 14);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 20
  }).addTo(detailsMap);

  const markerHtmlStyles = `
    background-color: var(--primary);
    width: 24px;
    height: 24px;
    display: block;
    left: -12px;
    top: -12px;
    position: relative;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    border: 2px solid #ffffff;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;

  const pinIcon = L.divIcon({
    className: "custom-pin-icon",
    iconAnchor: [0, 12],
    html: `<span style="${markerHtmlStyles}" />`
  });

  L.marker([lat, lng], { icon: pinIcon }).addTo(detailsMap);

  // Resize handling to ensure Leaflet maps redraw correctly on mobile/window resize
  const mapElement = document.getElementById('details-mini-map');
  if (mapElement) {
    window.addEventListener('resize', () => {
      if (detailsMap) {
        detailsMap.invalidateSize();
      }
    });

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        if (detailsMap) {
          detailsMap.invalidateSize();
        }
      });
      observer.observe(mapElement);
    }
  }
}

function renderCaseworkTimeline(issue) {
  const container = document.getElementById('timeline-list');
  if (!container) return;

  const history = issue.history || [];

  if (history.length === 0) {
    // Inject initial case submission log
    const dateStr = new Date(issue.created_at).toLocaleString();
    container.innerHTML = `
      <div class="timeline-item active">
        <div class="timeline-dot"></div>
        <div class="timeline-meta">${dateStr} • Reported by Citizen</div>
        <div class="timeline-content">Complaint filed. Assigned status set to pending.</div>
      </div>
    `;
    return;
  }

  // Sort logs by date ascending
  const sorted = [...history].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  container.innerHTML = sorted.map((log, idx) => {
    const isLatest = idx === sorted.length - 1;
    const dateStr = new Date(log.created_at).toLocaleString();
    const updaterName = log.profiles?.full_name || 'System Dispatcher';
    const notesStr = log.notes || log.remarks || `Caselog status updated to ${log.status.toUpperCase()}.`;

    return `
      <div class="timeline-item ${isLatest ? 'active' : ''}">
        <div class="timeline-dot"></div>
        <div class="timeline-meta">${dateStr} • ${updaterName}</div>
        <div class="timeline-content">${escapeHTML(notesStr)}</div>
      </div>
    `;
  }).join('');
}

function renderAssignPanel(issue) {
  const container = document.getElementById('assignment-status-area');
  if (!container) return;

  const user = getCurrentUser();
  if (!user) return;

  if (!issue.assigned_to) {
    container.innerHTML = `
      <div style="font-size: 0.82rem; color: var(--text-muted); font-weight:600; margin-bottom: 0.75rem;">CASE WORKER ASSIGNEE</div>
      <button class="btn btn-secondary" onclick="handleSelfAssign()" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 0.85rem; font-weight:700;">
        <i class="fa-solid fa-user-plus"></i> Self Assign Case
      </button>
    `;
  } else if (issue.assigned_to === user.id) {
    container.innerHTML = `
      <div style="font-size: 0.72rem; color: var(--text-muted); font-weight:600; margin-bottom: 0.25rem;">CASE WORKER ASSIGNEE</div>
      <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--primary); font-weight: 800; font-size: 0.95rem;">
        <i class="fa-solid fa-user-check"></i> Assigned to You
      </div>
    `;
  } else {
    container.innerHTML = `
      <div style="font-size: 0.72rem; color: var(--text-muted); font-weight:600; margin-bottom: 0.25rem;">CASE WORKER ASSIGNEE</div>
      <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-main); font-weight: 700; font-size: 0.95rem;">
        <i class="fa-solid fa-user-lock"></i> Assigned to Inspector
      </div>
    `;
  }
}

async function handleSelfAssign() {
  const user = getCurrentUser();
  
  // Log Supabase authentication session and user state
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      const sessionResult = await supabaseClient.auth.getSession();
      const userResult = await supabaseClient.auth.getUser();
      console.log("[Inspector] Supabase Client Session:", sessionResult);
      console.log("[Inspector] Supabase Client User:", userResult);
      
      if (!sessionResult.data.session) {
        console.warn("[Inspector] No active session found in Supabase client. Redirecting to login.");
        window.showToast("Session expired or invalid. Please log in again.", "warning");
        window.authRouter.redirectToLogin('authority');
        return;
      }
    } catch (e) {
      console.error("[Inspector] Error retrieving Supabase auth state:", e);
    }
  } else {
    console.error("[Inspector] Supabase Client is not initialized.");
  }

  if (!user) {
    console.warn("[Inspector] No cached user found in localStorage. Redirecting to login.");
    window.authRouter.redirectToLogin('authority');
    return;
  }

  try {
    const token = typeof getAuthToken === 'function' ? getAuthToken() : null;
    console.log(`[Inspector] Sending assign request with token: ${token ? token.substring(0, 15) + '...' : 'none'}`);

    const { error } = await window.API.assignIssue(issueId, user.id);
    if (error) {
      window.showToast(`Assignment failed: ${error}`, "error");
    } else {
      loadCaseDetails();
    }
  } catch (err) {
    console.error("Self assign error:", err);
  }
}

function setupFormHandlers() {
  const statusSelect = document.getElementById('dispatch-status-select');
  const uploadPanel = document.getElementById('proof-upload-panel');
  const proofDropzone = document.getElementById('proof-dropzone');
  const proofInput = document.getElementById('proof-input');
  const clearBtn = document.getElementById('btn-clear-proof');
  const dispatchForm = document.getElementById('dispatch-form');
  const alertBanner = document.getElementById('dispatch-alert');
  const submitBtn = document.getElementById('btn-dispatch-submit');

  function showAlert(msg, isSuccess = false) {
    if (!alertBanner) return;
    alertBanner.textContent = msg;
    if (isSuccess) {
      alertBanner.className = 'alert-banner success';
      alertBanner.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
      alertBanner.style.color = '#10b981';
      alertBanner.style.border = '1px solid rgba(16, 185, 129, 0.3)';
    } else {
      alertBanner.className = 'alert-banner error';
      alertBanner.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
      alertBanner.style.color = '#ef4444';
      alertBanner.style.border = '1px solid rgba(239, 68, 68, 0.3)';
    }
    alertBanner.classList.remove('hidden');
  }

  // Toggle proof upload panel based on status
  if (statusSelect) {
    statusSelect.addEventListener('change', () => {
      if (alertBanner) alertBanner.classList.add('hidden');
      if (statusSelect.value === 'resolved') {
        uploadPanel.classList.remove('hidden');
      } else {
        uploadPanel.classList.add('hidden');
      }
    });
  }

  // Drag and drop photo triggers
  if (proofDropzone && proofInput) {
    proofDropzone.addEventListener('click', () => proofInput.click());

    proofInput.addEventListener('change', () => {
      if (proofInput.files && proofInput.files.length > 0) {
        selectedProofFile = proofInput.files[0];
        // Preview
        const reader = new FileReader();
        reader.onload = (e) => {
          document.getElementById('proof-preview').src = e.target.result;
          document.getElementById('proof-preview-wrapper').classList.remove('hidden');
        };
        reader.readAsDataURL(selectedProofFile);
      }
    });
  }

  // Clear photo preview
  if (clearBtn && proofInput) {
    clearBtn.addEventListener('click', () => {
      proofInput.value = '';
      selectedProofFile = null;
      document.getElementById('proof-preview-wrapper').classList.add('hidden');
    });
  }

  // Submit Form
  if (dispatchForm) {
    dispatchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (alertBanner) alertBanner.classList.add('hidden');

      const status = statusSelect.value;
      const notes = document.getElementById('dispatch-notes').value.trim();

      if (status === 'resolved' && !selectedProofFile && (!issueDetailData || !issueDetailData.completion_proof_url)) {
        showAlert('Resolution proof photo is strictly required to resolve this complaint.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving Caselog...';

      try {
        const formData = new FormData();
        formData.append('status', status);
        formData.append('notes', notes);
        if (selectedProofFile) {
          formData.append('proof', selectedProofFile);
        }

        const { error } = await window.API.updateIssueStatus(issueId, formData);

        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Apply Status Update';

        if (error) {
          showAlert(error || 'Failed to submit case update.');
        } else {
          // Show confirmation message
          const successMsg = status === 'resolved'
            ? 'Success: Case status updated to Resolved! The citizen who filed this report has been informed.'
            : (status === 'timeline_update'
               ? 'Success: Casework timeline update added!'
               : `Success: Case status updated to ${status.replace('_', ' ')}!`);
          
          showAlert(successMsg, true);
          window.showToast(successMsg, "success");

          // Clear file state and reload
          selectedProofFile = null;
          if (proofInput) proofInput.value = '';
          document.getElementById('proof-preview-wrapper').classList.add('hidden');
          document.getElementById('dispatch-notes').value = '';
          loadCaseDetails();
        }
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Apply Status Update';
        showAlert(err.message || 'An unexpected dispatch error occurred.');
      }
    });
  }
}

// Global handleSelfAssign trigger mapping
window.handleSelfAssign = handleSelfAssign;

// Escape helper
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

// ============================================================
// NEW FEATURES: Evidence Gallery, Chat
// ============================================================

let chatRealtimeChannel = null;
let chatPresenceChannel = null;

async function loadAuthorityNewFeatures(issue) {
  // === Evidence Gallery ===
  renderEvidenceGallery(issue.attachments || issue.evidence || []);

  // === Chat Panel ===
  const chatPanel = document.getElementById('chat-panel');
  if (chatPanel) {
    const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (issue.assigned_to && currentUser && currentUser.id === issue.assigned_to) {
      chatPanel.classList.remove('hidden');

      // Load existing messages
      const { data, error } = await window.API.getChatMessages(issueId);
      if (!error && data && data.messages) {
        renderChatMessages(data.messages);
      }

      // Setup realtime for new messages
      setupChatRealtime(issueId);

      // Setup chat form
      setupChatForm();
    } else {
      chatPanel.classList.add('hidden');
    }
  }
}

function renderEvidenceGallery(attachments) {
  const gallery = document.getElementById('evidence-gallery');
  if (!gallery) return;

  if (!attachments || attachments.length === 0) {
    gallery.classList.add('hidden');
    return;
  }

  gallery.classList.remove('hidden');
  gallery.innerHTML = `
    <div style="background-color: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 0; overflow: hidden; box-shadow: var(--shadow-sm);">
      <div style="padding: 1rem 1.5rem 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
        <i class="fa-solid fa-images" style="color: var(--primary);"></i>
        <h4 style="font-size: 1rem; font-family: var(--font-heading); margin: 0;">Citizen Evidence (${attachments.length})</h4>
      </div>
      <div class="evidence-grid">
        ${attachments.map(att => `
          <div class="evidence-thumb" onclick="window.open('${att.url || att.file_url || ''}', '_blank')">
            <img src="${att.url || att.file_url || ''}" alt="Evidence" loading="lazy">
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

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
    const senderName = msg.sender?.full_name || (isSent ? 'You' : 'Citizen');
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

function appendChatMessage(message) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const placeholder = container.querySelector('div[style*="text-align: center"]');
  if (placeholder && placeholder.textContent.includes('No messages')) {
    placeholder.remove();
  }

  const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const isSent = currentUser && message.sender_id === currentUser.id;
  const senderName = message.sender?.full_name || (isSent ? 'You' : 'Citizen');
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

function setupChatRealtime(currentIssueId) {
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
      if (currentUser && payload.new.sender_id === currentUser.id) return;
      appendChatMessage(payload.new);
    })
    .subscribe((status) => {
      console.log(`[Authority Chat] Realtime subscription status: ${status}`);
    });

  // 2. Subscribe to Presence (Online Status tracking)
  const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  chatPresenceChannel = supabaseClient.channel(`presence:issue_${currentIssueId}`);
  chatPresenceChannel
    .on('presence', { event: 'sync' }, () => {
      const state = chatPresenceChannel.presenceState();
      let citizenOnline = false;
      Object.keys(state).forEach((key) => {
        state[key].forEach((pres) => {
          if (pres.role === 'citizen') {
            citizenOnline = true;
          }
        });
      });

      const statusSpan = document.getElementById('chat-presence-status');
      if (statusSpan) {
        if (citizenOnline) {
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
          role: 'authority'
        });
      }
    });
}

function setupChatForm() {
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');

  if (chatForm) {
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = chatInput ? chatInput.value.trim() : '';
      if (!text) return;

      const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
      if (!currentUser) {
        if (typeof showToast === 'function') showToast('You must be logged in to send messages.', 'warning');
        return;
      }

      appendChatMessage({
        message_text: text,
        sender_id: currentUser.id,
        created_at: new Date().toISOString(),
        sender: { full_name: currentUser.user_metadata?.full_name || 'You' }
      });

      chatInput.value = '';

      const { error } = await window.API.sendChatMessage(issueId, text);
      if (error) {
        if (typeof showToast === 'function') showToast(`Message failed: ${error}`, 'error');
      }
    });
  }
}
