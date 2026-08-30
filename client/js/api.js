// CrowdCity - REST API Client Wrapper (Clean Rewritten Architecture)

const API_BASE = '/api';

// In-flight GET request deduplication & Fast SWR memory caching
const _inFlight = new Map();
const _apiCache = new Map();
const _CACHE_TTL_MS = 6000;

function _clearApiCache() {
  _apiCache.clear();
}

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

  // Resolve authentication token if available
  let token = null;
  if (typeof getAuthToken === 'function') {
    token = getAuthToken();
  }
  if (!token && typeof getSession === 'function') {
    const session = getSession();
    token = session?.access_token || null;
  }
  if (!token && typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem('cc_access_token') || localStorage.getItem('supabase.auth.token');
      if (stored) {
        if (stored.startsWith('{')) {
          const parsed = JSON.parse(stored);
          token = parsed?.currentSession?.access_token || parsed?.access_token || null;
        } else {
          token = stored;
        }
      }
    } catch (e) {}
  }

  if (token && typeof token === 'string' && token.split('.').length === 3) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (options.auth === true) {
    return {
      data: null,
      error: 'Authentication required',
      status: 401
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

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

    // Fast instant return from memory cache if recent (< 6s)
    const cached = _apiCache.get(endpoint);
    if (cached && (Date.now() - cached.timestamp < _CACHE_TTL_MS)) {
      return Promise.resolve(cached.response);
    }

    return _dedupFetch(dedupKey, async () => {
      console.log('[DATA] getIssues START', endpoint);
      const res = await request(endpoint, { method: 'GET', auth: false });
      console.log(`[DATA] getIssues RESPONSE ${res.status}`);

      if (res.data) {
        const count = Array.isArray(res.data) ? res.data.length : (res.data.issues ? res.data.issues.length : 0);
        console.log(`[DATA] getIssues SUCCESS: ${count}`);
        _apiCache.set(endpoint, { timestamp: Date.now(), response: res });
      } else {
        console.warn(`[DATA] getIssues ERROR: ${res.error}`);
      }
      console.log('[DATA] getIssues END');
      return res;
    });
  },

  // 2. Get Single Issue details
  getIssueDetails: async (id) => {
    return request(`/issues/${id}`, { method: 'GET', auth: false });
  },

  // 3. Report a new issue
  createIssue: async (issueData) => {
    _clearApiCache();
    return request('/issues', {
      method: 'POST',
      body: issueData,
      auth: true
    });
  },

  // 4. Toggle issue upvote
  upvoteIssue: async (id) => {
    _clearApiCache();
    return request(`/issues/${id}/upvote`, {
      method: 'POST',
      auth: true
    });
  },

  // 5. Submit comment on an issue
  addComment: async (id, commentText) => {
    return request(`/issues/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment_text: commentText }),
      auth: true
    });
  },

  // 6. Update Issue Status (Authority/Admin Only)
  updateIssueStatus: async (id, statusData) => {
    _clearApiCache();
    const isFormData = statusData instanceof FormData;
    return request(`/issues/${id}/status`, {
      method: 'PATCH',
      body: isFormData ? statusData : JSON.stringify(statusData),
      auth: true
    });
  },

  // 7. Assign complaint (Authority/Admin Only)
  assignIssue: async (id, assignedTo = null) => {
    _clearApiCache();
    const options = { method: 'POST', auth: true };
    if (assignedTo) {
      options.body = JSON.stringify({ assigned_to: assignedTo });
    }
    return request(`/issues/${id}/assign`, options);
  },

  // 8. Get caseload statistics
  getAuthorityStats: async () => {
    return request('/issues/authority/stats', {
      method: 'GET',
      auth: true
    });
  },

  // 9. Delete Issue (Admin Only)
  deleteIssue: async (id) => {
    _clearApiCache();
    return request(`/issues/${id}`, {
      method: 'DELETE',
      auth: true
    });
  },

  // 10. Update User Role (Admin Only)
  updateUserRole: async (targetUserId, role) => {
    return request('/auth/role', {
      method: 'POST',
      body: JSON.stringify({ userId: targetUserId, role }),
      auth: true
    });
  },

  // 11. Request AI suggestion
  analyzeWithAi: async (title, description) => {
    return request('/ai/analyze', {
      method: 'POST',
      body: JSON.stringify({ title, description }),
      auth: false
    });
  },

  // Translate & clean voice text
  translateVoiceText: async (text) => {
    return request('/ai/translate-voice', {
      method: 'POST',
      body: JSON.stringify({ text }),
      auth: false
    });
  },

  // Analyze image with AI
  analyzeImageWithAi: async (imageBase64) => {
    return request('/ai/analyze-image', {
      method: 'POST',
      body: JSON.stringify({ image: imageBase64 }),
      auth: false
    });
  },

  // 12. Get all users (Admin Only)
  getAllUsers: async () => {
    return request('/auth/users', {
      method: 'GET',
      auth: true
    });
  },

  // 13. Get system-wide analytics (Admin Only)
  getAdminAnalytics: async () => {
    return request('/issues/admin/analytics', {
      method: 'GET',
      auth: true
    });
  },

  // 14. Get user notifications — reads live PostgreSQL database via backend
  getNotifications: () => {
    return _dedupFetch('GET:/notifications', async () => {
      console.log('[DATA] getNotifications START');
      const res = await request('/notifications', { method: 'GET', auth: true });
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
      method: 'PATCH',
      auth: true
    });
  },

  // 16. Mark all notifications as read
  markAllNotificationsAsRead: async () => {
    return request('/notifications/read-all', {
      method: 'PATCH',
      auth: true
    });
  },

  // 17. Edit comment
  editComment: async (commentId, commentText) => {
    return request(`/issues/comments/${commentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ comment_text: commentText }),
      auth: true
    });
  },

  // 18. Delete comment
  deleteComment: async (commentId) => {
    return request(`/issues/comments/${commentId}`, {
      method: 'DELETE',
      auth: true
    });
  },

  // 20. Get current user badges
  getUserBadges: async () => {
    return request('/gamification/badges', {
      method: 'GET',
      auth: true
    });
  },

  // 21. Get advanced analytics data
  getAdvancedAnalytics: async () => {
    return request('/issues/analytics', {
      method: 'GET',
      auth: true
    });
  },

  // 22. AI Chatbot assistant conversations
  chatWithAi: async (messages) => {
    return request('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ messages }),
      auth: true
    });
  },

  // 23. Verify issue resolution
  verifyIssue: async (id) => {
    return request(`/issues/${id}/verify`, {
      method: 'POST',
      auth: true
    });
  },

  // 24. Reopen resolved issue
  reopenIssue: async (id, reason = '') => {
    return request(`/issues/${id}/reopen`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
      auth: true
    });
  },

  // 25. Suspend or unsuspend user (Admin Only)
  suspendUser: async (id, isSuspended) => {
    return request(`/auth/users/${id}/suspend`, {
      method: 'PATCH',
      body: JSON.stringify({ isSuspended }),
      auth: true
    });
  },

  // 26. Verify authority user (Admin Only)
  verifyAuthority: async (id, isVerified) => {
    return request(`/auth/users/${id}/verify-authority`, {
      method: 'PATCH',
      body: JSON.stringify({ isVerified }),
      auth: true
    });
  },

  // 27. Assign user department (Admin Only)
  assignUserDepartment: async (id, departmentId) => {
    return request(`/auth/users/${id}/assign-department`, {
      method: 'PATCH',
      body: JSON.stringify({ departmentId }),
      auth: true
    });
  },

  // 28. Get all departments
  getDepartments: async () => {
    return request('/departments', { method: 'GET', auth: false });
  },

  // 29. Create department (Admin Only)
  createDepartment: async (deptData) => {
    return request('/departments', {
      method: 'POST',
      body: JSON.stringify(deptData),
      auth: true
    });
  },

  // 30. Update department (Admin Only)
  updateDepartment: async (id, deptData) => {
    return request(`/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(deptData),
      auth: true
    });
  },

  // 31. Delete department (Admin Only)
  deleteDepartment: async (id) => {
    return request(`/departments/${id}`, {
      method: 'DELETE',
      auth: true
    });
  },

  // 32. Transportation Module APIs
  getTransportationReports: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/transportation/reports${query ? '?' + query : ''}`, { method: 'GET', auth: false });
  },

  getTransportationReportById: async (id) => {
    return request(`/transportation/reports/${id}`, { method: 'GET', auth: false });
  },

  createTransportationReport: async (reportData) => {
    return request('/transportation/reports', {
      method: 'POST',
      body: JSON.stringify(reportData),
      auth: true
    });
  },

  updateTransportationReportStatus: async (id, updateData) => {
    return request(`/transportation/reports/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
      auth: true
    });
  },

  analyzeTransportationIssue: async (data) => {
    return request('/transportation/analyze', {
      method: 'POST',
      body: JSON.stringify(data),
      auth: false
    });
  },

  // 33. AI decisions
  getAiDecisions: async () => {
    return request('/issues/admin/ai-decisions', { method: 'GET', auth: true });
  },

  overrideAiDecision: async (id, overrideData) => {
    return request(`/issues/admin/ai-decisions/${id}/override`, {
      method: 'POST',
      body: JSON.stringify(overrideData),
      auth: true
    });
  },

  // 34. Withdraw complaint
  withdrawIssue: async (id, reason = '') => {
    return request(`/issues/${id}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
      auth: true
    });
  },

  // 35. Upload evidence
  uploadEvidence: async (id, formData) => {
    return request(`/issues/${id}/evidence`, {
      method: 'POST',
      body: formData,
      auth: true
    });
  },

  // 36. Chat messages
  getChatMessages: async (id) => {
    return request(`/issues/${id}/messages`, { method: 'GET', auth: true });
  },

  sendChatMessage: async (id, messageText) => {
    return request(`/issues/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message_text: messageText }),
      auth: true
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
      }),
      auth: true
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
