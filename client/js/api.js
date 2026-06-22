// CrowdCity - REST API Client Wrapper

const API_BASE = '/api';

/**
 * Perform a fetch request with automatic authorization header injection
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
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
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! Status: ${response.status}`);
    }

    return { data, error: null };
  } catch (error) {
    console.error(`API Request failed for ${endpoint}:`, error);
    return { data: null, error: error.message || 'API request failed' };
  }
}

const API = {
  // 1. Get Issues List
  getIssues: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.status) params.append('status', filters.status);
    if (filters.reporter_id) params.append('reporter_id', filters.reporter_id);
    if (filters.assigned_to) params.append('assigned_to', filters.assigned_to);
    if (filters.sort_by) params.append('sort_by', filters.sort_by);
    
    const queryString = params.toString();
    const endpoint = `/issues${queryString ? `?${queryString}` : ''}`;
    return request(endpoint, { method: 'GET' });
  },

  // 2. Get Single Issue details
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

  // 14. Get user notifications
  getNotifications: async () => {
    return request('/notifications', {
      method: 'GET'
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
  }
};

// Expose API globally
window.API = API;
