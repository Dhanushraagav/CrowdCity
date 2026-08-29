// CrowdCity - REST API Client Wrapper

const API_BASE = '/api';

// ─── In-flight request deduplication ─────────────────────────────────────────
// If the same request is already in-flight, return the existing Promise.
// Prevents duplicate concurrent fetches caused by rapid auth-change/realtime events.
const _inFlight = new Map();
function _dedupFetch(key, fetcher) {
  if (_inFlight.has(key)) return _inFlight.get(key);
  const p = fetcher().finally(() => _inFlight.delete(key));
  _inFlight.set(key, p);
  return p;
}

// ─── Helper to obtain initialized Supabase SDK client ────────────────────────
async function _getSupabaseClient() {
  if (window.supabaseClient) return window.supabaseClient;
  if (typeof supabaseClient !== 'undefined' && supabaseClient) return supabaseClient;
  if (typeof window.getOrInitSupabaseClient === 'function') {
    try {
      const client = await window.getOrInitSupabaseClient();
      if (client) return client;
    } catch (e) {}
  }
  if (window.authInitPromise) {
    try {
      await window.authInitPromise;
      if (window.supabaseClient) return window.supabaseClient;
    } catch (e) {}
  }
  return null;
}



/**
 * Perform a fetch request with automatic authorization header injection
 */
async function request(endpoint, options = {}) {
  let url = `${API_BASE}${endpoint}`;
  
  // Set up default headers
  const headers = {
    ...options.headers,
  };

  // Only set application/json content type if request is not FormData
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  // Get authentication token from auth controller (attempting async refresh first)
  let token = null;
  if (typeof window.getOrRefreshAccessToken === 'function') {
    token = await window.getOrRefreshAccessToken();
  } else if (typeof getAuthToken === 'function') {
    token = getAuthToken();
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Access-Token'] = token;
    headers['X-Auth-Token'] = token;
    if (!url.includes('token=')) {
      url += (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  const config = {
    ...options,
    headers,
    signal: options.signal || controller.signal
  };

  try {
    const response = await fetch(url, config);
    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = `HTTP error ${response.status}`;
      try {
        const errData = await response.json();
        if (errData && errData.error) errorMessage = errData.error;
      } catch (e) {
        // Non-JSON error response
      }
      return { data: null, error: errorMessage };
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return { data, error: null };
    } else {
      return { data: null, error: 'Server returned non-JSON response' };
    }
  } catch (error) {
    clearTimeout(timeoutId);
    return { data: null, error: error.name === 'AbortError' ? 'Request timed out' : (error.message || 'API request failed') };
  }
}

const API = {
  // Generic request method
  request: request,

  // 1. Get Issues — Backend REST API (reads live PostgreSQL database)
  // Deduplicated: concurrent calls with same filters share one in-flight request.
  getIssues: (filters = {}) => {
    const norm = {
      category: (filters.category && filters.category !== 'all') ? filters.category : '',
      status: (filters.status && filters.status !== 'all') ? filters.status : '',
      reporter_id: filters.reporter_id || '',
      assigned_to: filters.assigned_to || '',
      sort_by: filters.sort_by === 'popularity' ? 'popularity' : 'newest'
    };
    const key = `issues:${JSON.stringify(norm)}`;
    return _dedupFetch(key, async () => {
      console.log('[DATA] getIssues START (fetching from /api/issues)', norm);
      const params = new URLSearchParams();
      if (norm.category) params.append('category', norm.category);
      if (norm.status) params.append('status', norm.status);
      if (norm.reporter_id) params.append('reporter_id', norm.reporter_id);
      if (norm.assigned_to) params.append('assigned_to', norm.assigned_to);
      if (norm.sort_by) params.append('sort_by', norm.sort_by);
      const qs = params.toString();
      const res = await request(`/issues${qs ? `?${qs}` : ''}`, { method: 'GET' });
      if (res && res.data) {
        console.log('[DATA] getIssues SUCCESS:', Array.isArray(res.data) ? res.data.length : (res.data.issues ? res.data.issues.length : 0), 'records loaded from live database');
      } else {
        console.warn('[DATA] getIssues Notice:', res?.error);
      }
      console.log('[DATA] getIssues END');
      return res;
    });
  },

  // 2. Get Single Issue details — Backend REST API
  getIssueDetails: async (id) => {
    return request(`/issues/${id}`, { method: 'GET' });
  },

  // 3. Report a new issue (supports JSON or FormData for uploads)
  createIssue: async (issueData) => {
    return request('/issues', {
      method: 'POST',
      body: issueData
    });
  },

  // 4. Toggle issue upvote
  upvoteIssue: async (id) => {
    return request(`/issues/${id}/upvote`, {
      method: 'POST'
    });
  },

  // 5. Submit comment on an issue
  addComment: async (id, commentText) => {
    return request(`/issues/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment_text: commentText })
    });
  },

  // 6. Update Issue Status (Authority/Admin Only)
  // Accepts a statusData payload which can be standard JSON or FormData containing proof file attachments
  updateIssueStatus: async (id, statusData) => {
    const isFormData = statusData instanceof FormData;
    return request(`/issues/${id}/status`, {
      method: 'PATCH',
      body: isFormData ? statusData : JSON.stringify(statusData)
    });
  },

  // 7. Assign/delegate complaint to inspector (Authority/Admin Only)
  assignIssue: async (id, assignedTo = null) => {
    const options = { method: 'POST' };
    if (assignedTo) {
      options.body = JSON.stringify({ assigned_to: assignedTo });
    }
    return request(`/issues/${id}/assign`, options);
  },

  // 8. Get caseload statistics for logged-in authority user
  getAuthorityStats: async () => {
    return request('/issues/authority/stats', {
      method: 'GET'
    });
  },

  // 9. Delete Issue (Admin Only)
  deleteIssue: async (id) => {
    return request(`/issues/${id}`, {
      method: 'DELETE'
    });
  },

  // 10. Update User Role (Admin Only)
  updateUserRole: async (targetUserId, role) => {
    return request('/auth/role', {
      method: 'POST',
      body: JSON.stringify({ userId: targetUserId, role })
    });
  },

  // 11. Request AI suggestion
  analyzeWithAi: async (title, description) => {
    return request('/ai/analyze', {
      method: 'POST',
      body: JSON.stringify({ title, description })
    });
  },

  // Translate & clean voice text (Tamil/Tanglish/English -> Perfect English)
  translateVoiceText: async (text) => {
    return request('/ai/translate-voice', {
      method: 'POST',
      body: JSON.stringify({ text })
    });
  },

  // Analyze image with AI (Camera / Upload Vision Detection)
  analyzeImageWithAi: async (imageBase64) => {
    return request('/ai/analyze-image', {
      method: 'POST',
      body: JSON.stringify({ image: imageBase64 })
    });
  },

  // 12. Get all users (Admin Only)
  getAllUsers: async () => {
    return request('/auth/users', {
      method: 'GET'
    });
  },

  // 13. Get system-wide analytics (Admin Only)
  getAdminAnalytics: async () => {
    return request('/issues/admin/analytics', {
      method: 'GET'
    });
  },

  // 14. Get user notifications — Backend REST API (reads live PostgreSQL database)
  // Deduplicated: concurrent calls share one in-flight request.
  getNotifications: () => {
    return _dedupFetch('notifications:user', async () => {
      console.log('[DATA] getNotifications START (fetching from /api/notifications)');
      const res = await request('/notifications', { method: 'GET' });
      if (res && res.data) {
        console.log('[DATA] getNotifications SUCCESS:', Array.isArray(res.data) ? res.data.length : (res.data.notifications ? res.data.notifications.length : 0), 'notifications loaded from live database');
      } else {
        console.warn('[DATA] getNotifications Notice:', res?.error);
      }
      return res;
    });
  },

  // 15. Mark single notification as read
  markNotificationAsRead: async (id) => {
    return request(`/notifications/${id}/read`, {
      method: 'PATCH'
    });
  },

  // 16. Mark all notifications as read
  markAllNotificationsAsRead: async () => {
    return request('/notifications/read-all', {
      method: 'PATCH'
    });
  },

  // 17. Edit comment
  editComment: async (commentId, commentText) => {
    return request(`/issues/comments/${commentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ comment_text: commentText })
    });
  },

  // 18. Delete comment
  deleteComment: async (commentId) => {
    return request(`/issues/comments/${commentId}`, {
      method: 'DELETE'
    });
  },

  // 20. Get current user badges
  getUserBadges: async () => {
    return request('/gamification/badges', {
      method: 'GET'
    });
  },

  // 21. Get advanced analytics data
  getAdvancedAnalytics: async () => {
    return request('/issues/analytics', {
      method: 'GET'
    });
  },

  // 22. AI Chatbot assistant conversations
  chatWithAi: async (messages) => {
    return request('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ messages })
    });
  },

  // 23. Verify issue resolution (Citizen Only)
  verifyIssue: async (id) => {
    return request(`/issues/${id}/verify`, {
      method: 'POST'
    });
  },

  // 24. Reopen resolved issue (Citizen Only)
  reopenIssue: async (id, reason = '') => {
    return request(`/issues/${id}/reopen`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  // 25. Suspend or unsuspend user (Admin Only)
  suspendUser: async (id, isSuspended) => {
    return request(`/auth/users/${id}/suspend`, {
      method: 'PATCH',
      body: JSON.stringify({ isSuspended })
    });
  },

  // 26. Verify or unverify authority user (Admin Only)
  verifyAuthority: async (id, isVerified) => {
    return request(`/auth/users/${id}/verify-authority`, {
      method: 'PATCH',
      body: JSON.stringify({ isVerified })
    });
  },

  // 27. Assign a department to an authority user (Admin Only)
  assignUserDepartment: async (id, departmentId) => {
    return request(`/auth/users/${id}/assign-department`, {
      method: 'PATCH',
      body: JSON.stringify({ departmentId })
    });
  },

  // 28. Get all departments
  getDepartments: async () => {
    return request('/departments', { method: 'GET' });
  },

  // 29. Create department (Admin Only)
  createDepartment: async (deptData) => {
    return request('/departments', {
      method: 'POST',
      body: JSON.stringify(deptData)
    });
  },

  // 30. Update department (Admin Only)
  updateDepartment: async (id, deptData) => {
    return request(`/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(deptData)
    });
  },

  // 31. Delete department (Admin Only)
  deleteDepartment: async (id) => {
    return request(`/departments/${id}`, {
      method: 'DELETE'
    });
  },

  // 32. Transportation Module APIs (v3.2)
  getTransportationReports: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/transportation/reports${query ? '?' + query : ''}`, { method: 'GET' });
  },

  getTransportationReportById: async (id) => {
    return request(`/transportation/reports/${id}`, { method: 'GET' });
  },

  createTransportationReport: async (reportData) => {
    return request('/transportation/reports', {
      method: 'POST',
      body: JSON.stringify(reportData)
    });
  },

  updateTransportationReportStatus: async (id, updateData) => {
    return request(`/transportation/reports/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  },

  analyzeTransportationIssue: async (data) => {
    return request('/transportation/analyze', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // 32. Get AI decisions data comparison (Admin Only)
  getAiDecisions: async () => {
    return request('/issues/admin/ai-decisions', { method: 'GET' });
  },

  // 33. Override AI decisions (Admin Only)
  overrideAiDecision: async (id, overrideData) => {
    return request(`/issues/admin/ai-decisions/${id}/override`, {
      method: 'POST',
      body: JSON.stringify(overrideData)
    });
  },

  // 34. Withdraw complaint (Citizen Only)
  withdrawIssue: async (id, reason = '') => {
    return request(`/issues/${id}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  // 35. Upload additional evidence
  uploadEvidence: async (id, formData) => {
    return request(`/issues/${id}/evidence`, {
      method: 'POST',
      body: formData
    });
  },

  // 36. Get chat messages for an issue
  getChatMessages: async (id) => {
    return request(`/issues/${id}/messages`, { method: 'GET' });
  },

  // 37. Send chat message
  sendChatMessage: async (id, messageText) => {
    return request(`/issues/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message_text: messageText })
    });
  },

  // 39. Send email to citizen (backend routed)
  sendCitizenEmail: async (issueId, recipientEmail, subject, message) => {
    return request(`/issues/${issueId}/email`, {
      method: 'POST',
      body: JSON.stringify({
        recipient_email: recipientEmail,
        subject: subject,
        message: message
      })
    });
  },

  // 38. Centralized Realtime Subscription Helper with Reconnection Auto-Sync
  subscribeRealtime: (options) => {
    const { channelName, events, onEvent, onStatusChange } = options;
    const client = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (!client) {
      console.warn("[Realtime] supabaseClient not initialized yet.");
      return null;
    }

    let wasDisconnected = false;
    const channel = client.channel(channelName);

    events.forEach(evt => {
      channel.on('postgres_changes', {
        event: evt.event || '*',
        schema: 'public',
        table: evt.table,
        filter: evt.filter
      }, (payload) => {
        console.log(`[Realtime] Event received on ${channelName}:`, payload);
        if (onEvent) onEvent(evt.event, payload);
      });
    });

    channel.subscribe((status, err) => {
      console.log(`[Realtime] Subscription status for ${channelName}: ${status}`, err || '');
      
      if (onStatusChange) {
        onStatusChange(status, err);
      }

      if (status === 'SUBSCRIBED') {
        if (wasDisconnected) {
          console.log(`[Realtime] Reconnected on ${channelName}. Triggering sync...`);
          if (window.showToast) {
            window.showToast(window.i18n ? window.i18n.t('realtime_reconnected') || 'Real-time sync restored.' : 'Real-time sync restored.', 'success');
          }
          if (onEvent) onEvent('RECONNECT', null);
          wasDisconnected = false;
        }
      } else if (status === 'CLOSED' || status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
        wasDisconnected = true;
      }
    });

    return channel;
  },

  // Assistant Chat for Schemes
  assistantChat: async (messages, userProfile = {}, schemeKnowledge = []) => {
    return request('/ai/assistant-chat', {
      method: 'POST',
      body: JSON.stringify({ messages, userProfile, schemeKnowledge })
    });
  }
};

// Expose API globally
window.API = API;
