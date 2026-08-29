// CrowdCity - REST API Client Wrapper (Clean Rewritten Architecture)

const API_BASE = '/api';

// In-flight GET request deduplication
const _inFlight = new Map();
function _dedupFetch(key, fetcher) {
  if (_inFlight.has(key)) return _inFlight.get(key);
  const p = fetcher().finally(() => _inFlight.delete(key));
  _inFlight.set(key, p);
  return p;
}

/**
 * Single unified request function
 * Relative /api URLs only, credentials omit, standard 20s timeout, safe error parsing
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  const headers = {
    'Accept': 'application/json',
    ...options.headers
  };

  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // Attach Authorization header if a valid JWT token exists in session
  let token = null;
  if (typeof getAuthToken === 'function') {
    token = getAuthToken();
  }
  if (!token && typeof getSession === 'function') {
    const session = getSession();
    token = session?.access_token || null;
  }

  if (token && typeof token === 'string' && token.split('.').length === 3) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  const config = {
    method: options.method || 'GET',
    ...options,
    headers,
    credentials: 'omit',
    cache: 'no-store',
    signal: options.signal || controller.signal
  };

  try {
    const response = await fetch(url, config);
    clearTimeout(timeoutId);

    const status = response.status;
    let data = null;
    let error = null;

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const json = await response.json();
        if (response.ok) {
          data = json;
        } else {
          error = json.error || json.message || `HTTP ${status}`;
        }
      } catch (e) {
        error = `Failed to parse JSON response (HTTP ${status})`;
      }
    } else {
      const text = await response.text();
      if (response.ok) {
        data = text;
      } else {
        error = text || `HTTP ${status}`;
      }
    }

    return { data, error, status };
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    return {
      data: null,
      error: isTimeout ? 'Request timed out' : (err.message || 'Network request failed'),
      status: isTimeout ? 408 : 0
    };
  }
}

const API = {
  request: request,

  // 1. Get Issues — reads live PostgreSQL database via backend
  getIssues: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.category && filters.category !== 'all') params.append('category', filters.category);
    if (filters.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters.reporter_id) params.append('reporter_id', filters.reporter_id);
    if (filters.assigned_to) params.append('assigned_to', filters.assigned_to);
    params.append('sort_by', filters.sort_by === 'popularity' ? 'popularity' : 'newest');
    if (filters.limit) params.append('limit', filters.limit);

    const qs = params.toString();
    const endpoint = `/issues${qs ? `?${qs}` : ''}`;
    const dedupKey = `GET:${endpoint}`;

    return _dedupFetch(dedupKey, async () => {
      console.log('[DATA] getIssues START', endpoint);
      const res = await request(endpoint, { method: 'GET' });
      console.log(`[DATA] getIssues RESPONSE ${res.status}`);

      if (res.data) {
        const count = Array.isArray(res.data) ? res.data.length : (res.data.issues ? res.data.issues.length : 0);
        console.log(`[DATA] getIssues SUCCESS: ${count}`);
      } else {
        console.warn(`[DATA] getIssues ERROR: ${res.error}`);
      }
      console.log('[DATA] getIssues END');
      return res;
    });
  },

  // 2. Get Single Issue details
  getIssueDetails: async (id) => {
    return request(`/issues/${id}`, { method: 'GET' });
  },

  // 3. Report a new issue
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
  updateIssueStatus: async (id, statusData) => {
    const isFormData = statusData instanceof FormData;
    return request(`/issues/${id}/status`, {
      method: 'PATCH',
      body: isFormData ? statusData : JSON.stringify(statusData)
    });
  },

  // 7. Assign complaint (Authority/Admin Only)
  assignIssue: async (id, assignedTo = null) => {
    const options = { method: 'POST' };
    if (assignedTo) {
      options.body = JSON.stringify({ assigned_to: assignedTo });
    }
    return request(`/issues/${id}/assign`, options);
  },

  // 8. Get caseload statistics
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

  // Translate & clean voice text
  translateVoiceText: async (text) => {
    return request('/ai/translate-voice', {
      method: 'POST',
      body: JSON.stringify({ text })
    });
  },

  // Analyze image with AI
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

  // 14. Get user notifications — reads live PostgreSQL database via backend
  getNotifications: () => {
    return _dedupFetch('GET:/notifications', async () => {
      console.log('[DATA] getNotifications START');
      const res = await request('/notifications', { method: 'GET' });
      console.log(`[DATA] getNotifications RESPONSE ${res.status}`);

      if (res.data) {
        const count = Array.isArray(res.data) ? res.data.length : 0;
        console.log(`[DATA] getNotifications SUCCESS: ${count}`);
      } else {
        console.log(`[DATA] getNotifications END (${res.error || 'Empty'})`);
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

  // 23. Verify issue resolution
  verifyIssue: async (id) => {
    return request(`/issues/${id}/verify`, {
      method: 'POST'
    });
  },

  // 24. Reopen resolved issue
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

  // 26. Verify authority user (Admin Only)
  verifyAuthority: async (id, isVerified) => {
    return request(`/auth/users/${id}/verify-authority`, {
      method: 'PATCH',
      body: JSON.stringify({ isVerified })
    });
  },

  // 27. Assign user department (Admin Only)
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

  // 32. Transportation Module APIs
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

  // 33. AI decisions
  getAiDecisions: async () => {
    return request('/issues/admin/ai-decisions', { method: 'GET' });
  },

  overrideAiDecision: async (id, overrideData) => {
    return request(`/issues/admin/ai-decisions/${id}/override`, {
      method: 'POST',
      body: JSON.stringify(overrideData)
    });
  },

  // 34. Withdraw complaint
  withdrawIssue: async (id, reason = '') => {
    return request(`/issues/${id}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  // 35. Upload evidence
  uploadEvidence: async (id, formData) => {
    return request(`/issues/${id}/evidence`, {
      method: 'POST',
      body: formData
    });
  },

  // 36. Chat messages
  getChatMessages: async (id) => {
    return request(`/issues/${id}/messages`, { method: 'GET' });
  },

  sendChatMessage: async (id, messageText) => {
    return request(`/issues/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message_text: messageText })
    });
  },

  // 39. Send email to citizen
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

  // 38. Realtime Subscription Helper
  subscribeRealtime: (options) => {
    const { channelName, events, onEvent, onStatusChange } = options;
    const client = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (!client) {
      return null;
    }

    const channel = client.channel(channelName);

    events.forEach(evt => {
      channel.on('postgres_changes', {
        event: evt.event || '*',
        schema: 'public',
        table: evt.table,
        filter: evt.filter
      }, (payload) => {
        if (onEvent) onEvent(evt.event, payload);
      });
    });

    channel.subscribe((status, err) => {
      if (onStatusChange) onStatusChange(status, err);
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
