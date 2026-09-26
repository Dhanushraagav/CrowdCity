/**
 * CrowdCity AI — Smart Reminder & Follow-up Center (client/js/reminders.js)
 * Manages government document renewals, application follow-ups, and scheme deadlines.
 * Strictly user-scoped (bound to authenticated user_id) and evaluated in Asia/Kolkata (IST).
 */

let userReminders = [];
let currentFilterStatus = 'all';
let currentSearchQuery = '';
let currentUserId = null;
let refreshIntervalHandle = null;

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // UTC+05:30

/**
 * Returns current Date ('YYYY-MM-DD') and Time ('HH:MM') in Asia/Kolkata (IST).
 */
function getIstNow(offsetMinutes = 0) {
  const targetMs = Date.now() + offsetMinutes * 60 * 1000 + IST_OFFSET_MS;
  const d = new Date(targetMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const mins = String(d.getUTCMinutes()).padStart(2, '0');
  return {
    dateStr: `${year}-${month}-${day}`,
    timeStr: `${hours}:${mins}`
  };
}

/**
 * Parses an IST date ('YYYY-MM-DD') and time ('HH:MM') into UTC epoch milliseconds.
 */
function parseIstEpochMs(dateStr, timeStr) {
  if (!dateStr || !timeStr) return NaN;
  const cleanDate = String(dateStr).trim();
  const cleanTime = String(timeStr).trim().slice(0, 5);
  return Date.parse(`${cleanDate}T${cleanTime}:00+05:30`);
}

/**
 * Normalizes a reminder record returned from API or Supabase.
 */
function normalizeReminder(row) {
  if (!row) return null;
  const { dateStr: todayIst } = getIstNow();
  const ref = String(row.related_application_ref || '').trim();
  const isSent = Boolean(row.email_sent) || row.status === 'Sent' || ref.startsWith('sent|');
  let sentAt = row.sent_at || null;
  if (!sentAt && ref.startsWith('sent|')) {
    sentAt = ref.split('|')[1] || null;
  }

  let status = row.status || 'Scheduled';
  if (status !== 'Completed') {
    if (isSent) {
      status = 'Sent';
    } else if (status === 'Scheduled' || status === 'Upcoming' || status === 'Today') {
      status = row.reminder_date === todayIst ? 'Today' : 'Scheduled';
    }
  }

  return {
    ...row,
    reminder_time: String(row.reminder_time || '09:00').slice(0, 5),
    status,
    email_sent: isSent,
    sent_at: sentAt
  };
}

/**
 * Resolves the current authenticated user's session (userId and accessToken).
 */
async function resolveAuthenticatedUser() {
  try {
    const supabase = window.getSupabaseClient ? await window.getSupabaseClient() : null;
    if (supabase && supabase.auth) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        return {
          userId: session.user.id,
          accessToken: session.access_token,
          email: session.user.email
        };
      }
    }
  } catch (e) {
    console.warn('[Reminders] Session lookup notice:', e.message);
  }

  try {
    const rawSession = localStorage.getItem('cc_session');
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      if (parsed?.user?.id) {
        return {
          userId: parsed.user.id,
          accessToken: parsed.access_token,
          email: parsed.user.email
        };
      }
    }
  } catch (e) {}

  return null;
}

/**
 * Saves strictly user-scoped cache in localStorage and purges any legacy unscoped cache.
 */
function syncUserScopedLocalCache(userId, remindersList) {
  try {
    localStorage.removeItem('cc_user_reminders'); // Purge legacy unscoped key
    if (userId) {
      localStorage.setItem(`cc_user_reminders_${userId}`, JSON.stringify(remindersList || []));
    }
  } catch (e) {}
}

/**
 * Updates the #reminder-count badge in the hero header to reflect active reminders only.
 */
function updateActiveReminderCounter() {
  const countBadge = document.getElementById('reminder-count');
  if (!countBadge) return;
  const activeCount = userReminders.filter(
    (r) => ['Scheduled', 'Upcoming', 'Today'].includes(r.status) && !r.email_sent
  ).length;
  countBadge.textContent = String(activeCount);
}

/**
 * Initialize Reminder Page
 */
async function initRemindersPage() {
  setupReminderEventListeners();

  // Purge legacy global unscoped reminder storage immediately
  try {
    localStorage.removeItem('cc_user_reminders');
  } catch (e) {}

  await loadUserReminders();

  // Check if URL has query parameters to pre-fill reminder modal (e.g. from Scheme Checker / Services)
  const params = new URLSearchParams(window.location.search);
  const prefillTitle = params.get('title');
  const prefillScheme = params.get('scheme');
  if (prefillTitle || prefillScheme) {
    openAddReminderModal({
      title: prefillTitle || `Follow-up: ${prefillScheme}`,
      related_scheme: prefillScheme || ''
    });
  }

  // Poll every 30 seconds while on /reminders so due reminders automatically transition to "Sent" in UI
  if (!refreshIntervalHandle) {
    refreshIntervalHandle = setInterval(() => {
      loadUserReminders({ silent: true });
    }, 30000);
  }
}

/**
 * Load user reminders from Backend API (/api/reminders) with Supabase user-scoped fallback.
 */
async function loadUserReminders({ silent = false } = {}) {
  const container = document.getElementById('reminders-list-container');
  if (container && !silent) {
    container.innerHTML = `<div style="text-align: center; padding: 3rem; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p style="margin-top: 0.75rem;">Loading your reminders...</p></div>`;
  }

  const auth = await resolveAuthenticatedUser();
  if (!auth || !auth.userId) {
    currentUserId = null;
    userReminders = [];
    updateActiveReminderCounter();
    renderRemindersList();
    return;
  }

  currentUserId = auth.userId;

  // 1. Primary path: Authenticated Backend API (/api/reminders)
  if (auth.accessToken) {
    try {
      const response = await fetch('/api/reminders', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${auth.accessToken}`
        }
      });

      if (response.ok) {
        const payload = await response.json();
        if (Array.isArray(payload.reminders)) {
          userReminders = payload.reminders.map(normalizeReminder).filter(Boolean);
          syncUserScopedLocalCache(auth.userId, userReminders);
          updateActiveReminderCounter();
          renderRemindersList();
          return;
        }
      }
    } catch (apiErr) {
      console.warn('[Reminders] Backend API unreachable, falling back to direct Supabase query:', apiErr.message);
    }
  }

  // 2. Fallback path: Direct Supabase query strictly scoped to auth.userId
  try {
    const supabase = window.getSupabaseClient ? await window.getSupabaseClient() : null;
    if (supabase) {
      const { data, error } = await supabase
        .from('user_reminders')
        .select('*')
        .eq('user_id', auth.userId)
        .order('reminder_date', { ascending: true })
        .order('reminder_time', { ascending: true });

      if (!error && Array.isArray(data)) {
        userReminders = data.map(normalizeReminder).filter(Boolean);
        syncUserScopedLocalCache(auth.userId, userReminders);
        updateActiveReminderCounter();
        renderRemindersList();
        return;
      }
    }
  } catch (err) {
    console.warn('[Reminders] Direct Supabase fallback notice:', err.message);
  }

  // 3. Offline user-scoped cache (strictly matching auth.userId only, NEVER hardcoded fallback data)
  try {
    const saved = localStorage.getItem(`cc_user_reminders_${auth.userId}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      userReminders = Array.isArray(parsed)
        ? parsed.filter((r) => r && r.user_id === auth.userId).map(normalizeReminder)
        : [];
    } else {
      userReminders = [];
    }
  } catch (e) {
    userReminders = [];
  }

  updateActiveReminderCounter();
  renderRemindersList();
}

/**
 * Render Reminders List
 */
function renderRemindersList() {
  const container = document.getElementById('reminders-list-container');
  if (!container) return;

  // Always keep header active count accurate regardless of active search/filter
  updateActiveReminderCounter();

  const { dateStr: todayStr } = getIstNow();

  const filtered = userReminders.filter((rem) => {
    const normalized = normalizeReminder(rem);
    const displayStatus = normalized.status;

    const matchStatus =
      currentFilterStatus === 'all' ||
      (currentFilterStatus === 'Today' && (rem.reminder_date === todayStr && displayStatus !== 'Completed' && displayStatus !== 'Sent')) ||
      (currentFilterStatus === 'Upcoming' && (displayStatus === 'Scheduled' || displayStatus === 'Upcoming')) ||
      (currentFilterStatus === 'Sent' && displayStatus === 'Sent') ||
      displayStatus.toLowerCase() === currentFilterStatus.toLowerCase();

    const q = currentSearchQuery.toLowerCase();
    const matchSearch =
      !q ||
      (rem.title || '').toLowerCase().includes(q) ||
      (rem.category || '').toLowerCase().includes(q) ||
      (rem.related_scheme || '').toLowerCase().includes(q) ||
      (rem.notes || '').toLowerCase().includes(q);

    return matchStatus && matchSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3.5rem 1.5rem; background: var(--bg-surface); border: 1px dashed var(--border-color); border-radius: 16px;">
        <i class="fa-regular fa-bell-slash" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
        <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">No reminders found</h3>
        <p style="font-size: 0.88rem; color: var(--text-muted); max-width: 420px; margin: 0 auto 1.25rem auto;">
          Set a reminder for certificate renewals, office visits, or scheme deadlines so you never miss an important date.
        </p>
        <button type="button" onclick="openAddReminderModal()" class="btn btn-primary" style="padding: 0.55rem 1.25rem; font-size: 0.85rem; font-weight: 700; border-radius: 10px;">
          <i class="fa-solid fa-plus"></i> Create Reminder
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      ${filtered.map((rem) => buildReminderCardHTML(normalizeReminder(rem), todayStr)).join('')}
    </div>
  `;
}

/**
 * Build single Reminder Card HTML
 */
function buildReminderCardHTML(rem, todayStr) {
  const isCompleted = rem.status === 'Completed';
  const isSent = rem.email_sent || rem.status === 'Sent';
  const isOverdue = !isCompleted && !isSent && rem.reminder_date < todayStr;
  const isToday = !isCompleted && !isSent && rem.reminder_date === todayStr;

  const priorityColors = {
    High: { bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444' },
    Medium: { bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b' },
    Low: { bg: 'rgba(59, 130, 246, 0.12)', text: '#3b82f6' }
  };
  const pStyle = priorityColors[rem.priority] || priorityColors.Medium;

  let dateBadgeLabel = rem.reminder_date;
  let dateBadgeColor = 'var(--text-muted)';
  if (isCompleted) {
    dateBadgeLabel = `Completed • ${rem.reminder_date}`;
    dateBadgeColor = '#10b981';
  } else if (isSent) {
    dateBadgeLabel = `Email Sent • ${rem.reminder_date}`;
    dateBadgeColor = '#0d9488';
  } else if (isOverdue) {
    dateBadgeLabel = `Overdue (${rem.reminder_date})`;
    dateBadgeColor = '#ef4444';
  } else if (isToday) {
    dateBadgeLabel = `Today (${rem.reminder_date})`;
    dateBadgeColor = '#10b981';
  }

  const statusBadgeHTML = isSent
    ? `<span style="font-size: 0.72rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 999px; background: rgba(16, 185, 129, 0.12); color: #10b981;"><i class="fa-solid fa-envelope-circle-check"></i> Email Sent</span>`
    : `<span style="font-size: 0.72rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 999px; background: rgba(13, 148, 136, 0.12); color: var(--primary);">${escapeHtml(rem.status || 'Scheduled')}</span>`;

  return `
    <div class="gov-reminder-card" style="background: var(--bg-surface); border: 1px solid ${isOverdue ? 'rgba(239,68,68,0.4)' : 'var(--border-color)'}; border-radius: 14px; padding: 1.25rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; opacity: ${isCompleted ? '0.65' : '1'}; transition: all 0.2s ease;">
      <div style="flex: 1; min-width: 240px;">
        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.4rem;">
          <span style="font-size: 0.72rem; font-weight: 800; padding: 0.2rem 0.6rem; border-radius: 999px; background: ${pStyle.bg}; color: ${pStyle.text}; text-transform: uppercase;">
            ${escapeHtml(rem.priority || 'Medium')} Priority
          </span>
          <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); background: var(--bg-app); padding: 0.2rem 0.6rem; border-radius: 6px; border: 1px solid var(--border-color);">
            ${escapeHtml(rem.category || 'Follow-up')}
          </span>
          ${statusBadgeHTML}
          ${rem.related_scheme ? `<span style="font-size: 0.75rem; font-weight: 700; color: var(--primary);"><i class="fa-solid fa-link"></i> ${escapeHtml(rem.related_scheme)}</span>` : ''}
        </div>

        <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--text-main); margin: 0 0 0.25rem 0; ${isCompleted ? 'text-decoration: line-through;' : ''}">
          ${escapeHtml(rem.title)}
        </h4>

        ${rem.notes ? `<p style="font-size: 0.84rem; color: var(--text-muted); margin: 0 0 0.5rem 0;">${escapeHtml(rem.notes)}</p>` : ''}

        <div style="display: flex; align-items: center; gap: 1rem; font-size: 0.8rem; color: var(--text-muted);">
          <span style="color: ${dateBadgeColor}; font-weight: 700;"><i class="fa-regular fa-calendar"></i> ${escapeHtml(dateBadgeLabel)}</span>
          <span><i class="fa-regular fa-clock"></i> ${escapeHtml(rem.reminder_time || '09:00')} IST</span>
          ${rem.repeat_frequency && rem.repeat_frequency !== 'None' ? `<span><i class="fa-solid fa-rotate"></i> ${escapeHtml(rem.repeat_frequency)}</span>` : ''}
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
        ${!isCompleted ? `
          <button type="button" onclick="markReminderComplete('${rem.id}')" class="btn btn-outline" style="padding: 0.45rem 0.85rem; font-size: 0.78rem; font-weight: 700; border-radius: 8px; color: #10b981; border-color: rgba(16,185,129,0.3);">
            <i class="fa-solid fa-check"></i> Complete
          </button>
          <button type="button" onclick="snoozeReminder('${rem.id}')" class="btn btn-outline" style="padding: 0.45rem 0.85rem; font-size: 0.78rem; font-weight: 700; border-radius: 8px;">
            <i class="fa-regular fa-clock"></i> +3 Days
          </button>
        ` : ''}
        <button type="button" onclick="deleteReminder('${rem.id}')" class="btn btn-outline" style="padding: 0.45rem 0.75rem; font-size: 0.78rem; border-radius: 8px; color: #ef4444; border-color: rgba(239,68,68,0.25);">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      </div>
    </div>
  `;
}

/**
 * Mark Reminder Complete
 */
window.markReminderComplete = async function (id) {
  const auth = await resolveAuthenticatedUser();
  if (!auth || !auth.userId) return;

  try {
    if (auth.accessToken) {
      const res = await fetch(`/api/reminders/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.accessToken}`
        },
        body: JSON.stringify({ status: 'Completed' })
      });
      if (res.ok) {
        await loadUserReminders({ silent: true });
        if (typeof window.showToast === 'function') {
          window.showToast('Reminder marked as completed!', 'success');
        }
        return;
      }
    }

    // Fallback direct Supabase update scoped strictly to user_id
    const supabase = window.getSupabaseClient ? await window.getSupabaseClient() : null;
    if (supabase) {
      await supabase
        .from('user_reminders')
        .update({ status: 'Completed' })
        .eq('id', id)
        .eq('user_id', auth.userId);
    }

    await loadUserReminders({ silent: true });
    if (typeof window.showToast === 'function') {
      window.showToast('Reminder marked as completed!', 'success');
    }
  } catch (e) {
    console.error('[Reminders] Failed to mark complete:', e);
  }
};

/**
 * Snooze Reminder by 3 Days (in Asia/Kolkata IST)
 */
window.snoozeReminder = async function (id) {
  const target = userReminders.find((r) => r.id === id);
  if (!target) return;

  const auth = await resolveAuthenticatedUser();
  if (!auth || !auth.userId) return;

  const baseEpoch = parseIstEpochMs(target.reminder_date, target.reminder_time || '09:00');
  const snoozedMs = (Number.isNaN(baseEpoch) ? Date.now() : baseEpoch) + 3 * 24 * 60 * 60 * 1000;
  const snoozedIst = new Date(snoozedMs + IST_OFFSET_MS);
  const newDateStr = `${snoozedIst.getUTCFullYear()}-${String(snoozedIst.getUTCMonth() + 1).padStart(2, '0')}-${String(snoozedIst.getUTCDate()).padStart(2, '0')}`;

  try {
    if (auth.accessToken) {
      const res = await fetch(`/api/reminders/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.accessToken}`
        },
        body: JSON.stringify({
          reminder_date: newDateStr,
          status: 'Scheduled'
        })
      });
      if (res.ok) {
        await loadUserReminders({ silent: true });
        if (typeof window.showToast === 'function') {
          window.showToast(`Snoozed to ${newDateStr}`, 'info');
        }
        return;
      }
    }

    const supabase = window.getSupabaseClient ? await window.getSupabaseClient() : null;
    if (supabase) {
      await supabase
        .from('user_reminders')
        .update({ reminder_date: newDateStr, status: 'Scheduled', related_application_ref: null })
        .eq('id', id)
        .eq('user_id', auth.userId);
    }

    await loadUserReminders({ silent: true });
    if (typeof window.showToast === 'function') {
      window.showToast(`Snoozed to ${newDateStr}`, 'info');
    }
  } catch (e) {
    console.error('[Reminders] Failed to snooze reminder:', e);
  }
};

/**
 * Delete Reminder
 */
window.deleteReminder = async function (id) {
  const auth = await resolveAuthenticatedUser();
  if (!auth || !auth.userId) return;

  try {
    if (auth.accessToken) {
      const res = await fetch(`/api/reminders/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`
        }
      });
      if (res.ok) {
        await loadUserReminders({ silent: true });
        if (typeof window.showToast === 'function') {
          window.showToast('Reminder deleted.', 'info');
        }
        return;
      }
    }

    const supabase = window.getSupabaseClient ? await window.getSupabaseClient() : null;
    if (supabase) {
      await supabase
        .from('user_reminders')
        .delete()
        .eq('id', id)
        .eq('user_id', auth.userId);
    }

    await loadUserReminders({ silent: true });
    if (typeof window.showToast === 'function') {
      window.showToast('Reminder deleted.', 'info');
    }
  } catch (e) {
    console.error('[Reminders] Failed to delete reminder:', e);
  }
};

/**
 * Open Add Reminder Modal with IST defaults
 */
window.openAddReminderModal = function (prefill = {}) {
  const modal = document.getElementById('add-reminder-modal');
  if (!modal) return;

  const titleInput = document.getElementById('new-rem-title');
  const schemeInput = document.getElementById('new-rem-scheme');
  const dateInput = document.getElementById('new-rem-date');
  const timeInput = document.getElementById('new-rem-time');
  const notesInput = document.getElementById('new-rem-notes');

  if (titleInput) titleInput.value = prefill.title || '';
  if (schemeInput) schemeInput.value = prefill.related_scheme || '';
  if (notesInput) notesInput.value = prefill.notes || '';

  // Default to current date & +5 minutes in Asia/Kolkata (IST)
  const { dateStr: todayIst } = getIstNow(0);
  const { dateStr: defaultDateIst, timeStr: defaultTimeIst } = getIstNow(5);

  if (dateInput) {
    dateInput.min = todayIst;
    dateInput.value = prefill.reminder_date || defaultDateIst;
  }
  if (timeInput) {
    timeInput.value = prefill.reminder_time || defaultTimeIst;
  }

  modal.style.display = 'flex';
};

window.closeAddReminderModal = function () {
  const modal = document.getElementById('add-reminder-modal');
  if (modal) modal.style.display = 'none';
};

/**
 * Save New Reminder from Modal -> Backend API -> Supabase Database -> UI Refresh
 */
window.saveNewReminder = async function () {
  const title = document.getElementById('new-rem-title')?.value.trim();
  const category = document.getElementById('new-rem-category')?.value || 'Government Application Follow-up';
  const related_scheme = document.getElementById('new-rem-scheme')?.value.trim() || '';
  const reminder_date = document.getElementById('new-rem-date')?.value || '';
  const reminder_time = (document.getElementById('new-rem-time')?.value || '09:00').slice(0, 5);
  const priority = document.getElementById('new-rem-priority')?.value || 'Medium';
  const notes = document.getElementById('new-rem-notes')?.value.trim() || '';

  if (!title) {
    if (typeof window.showToast === 'function') {
      window.showToast('Please enter a Reminder Title.', 'error');
    } else {
      alert('Please enter a reminder title.');
    }
    return;
  }

  if (!reminder_date || !reminder_time) {
    if (typeof window.showToast === 'function') {
      window.showToast('Please select both a Date and Time.', 'error');
    } else {
      alert('Please select both a Date and Time.');
    }
    return;
  }

  // Validate that scheduled Date + Time in Asia/Kolkata (IST) is not in the past
  const scheduledMs = parseIstEpochMs(reminder_date, reminder_time);
  if (Number.isNaN(scheduledMs) || scheduledMs < Date.now() - 60 * 1000) {
    const { dateStr: nowDate, timeStr: nowTime } = getIstNow();
    const msg = `Scheduled time (${reminder_date} ${reminder_time} IST) cannot be in the past. Current IST time is ${nowDate} ${nowTime}.`;
    if (typeof window.showToast === 'function') {
      window.showToast(msg, 'error');
    } else {
      alert(msg);
    }
    return;
  }

  const auth = await resolveAuthenticatedUser();
  if (!auth || !auth.userId) {
    if (typeof window.showToast === 'function') {
      window.showToast('Please sign in to save reminders to your account.', 'error');
    }
    return;
  }

  const payload = {
    title,
    category,
    priority,
    related_scheme: related_scheme || null,
    reminder_date,
    reminder_time,
    repeat_frequency: 'One-time',
    notes: notes || null
  };

  let savedReminder = null;

  // 1. Primary path: POST /api/reminders
  if (auth.accessToken) {
    try {
      const response = await fetch('/api/reminders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${auth.accessToken}`
        },
        body: JSON.stringify(payload)
      });

      const resBody = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errMsg = resBody.error || 'Failed to save reminder.';
        if (typeof window.showToast === 'function') {
          window.showToast(errMsg, 'error');
        } else {
          alert(errMsg);
        }
        return;
      }

      if (resBody.reminder) {
        savedReminder = normalizeReminder(resBody.reminder);
      }
    } catch (apiErr) {
      console.warn('[Reminders] POST /api/reminders network fallback:', apiErr.message);
    }
  }

  // 2. Fallback path: Direct Supabase insert strictly bound to auth.userId
  if (!savedReminder) {
    try {
      const supabase = window.getSupabaseClient ? await window.getSupabaseClient() : null;
      if (supabase) {
        const { data, error } = await supabase
          .from('user_reminders')
          .insert([{
            user_id: auth.userId,
            title: payload.title,
            category: payload.category,
            priority: payload.priority,
            related_scheme: payload.related_scheme,
            reminder_date: payload.reminder_date,
            reminder_time: payload.reminder_time,
            repeat_frequency: payload.repeat_frequency,
            status: 'Scheduled',
            notes: payload.notes
          }])
          .select('*')
          .single();

        if (error) {
          throw error;
        }
        savedReminder = normalizeReminder(data);
      }
    } catch (dbErr) {
      console.error('[Reminders] Database save failed:', dbErr);
      if (typeof window.showToast === 'function') {
        window.showToast(dbErr.message || 'Could not save reminder to database.', 'error');
      }
      return;
    }
  }

  closeAddReminderModal();

  // Clear modal fields
  const titleEl = document.getElementById('new-rem-title');
  const schemeEl = document.getElementById('new-rem-scheme');
  const notesEl = document.getElementById('new-rem-notes');
  if (titleEl) titleEl.value = '';
  if (schemeEl) schemeEl.value = '';
  if (notesEl) notesEl.value = '';

  // Refresh from database so list & active counter are 100% synchronized
  await loadUserReminders({ silent: true });

  if (typeof window.showToast === 'function') {
    window.showToast('Reminder scheduled! You will receive an email notification at the scheduled time.', 'success');
  }
};

function setupReminderEventListeners() {
  const searchInput = document.getElementById('input-reminder-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value.trim();
      renderRemindersList();
    });
  }

  const filterSelect = document.getElementById('select-filter-status');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      currentFilterStatus = e.target.value;
      renderRemindersList();
    });
  }

  const openModalBtn = document.getElementById('btn-open-add-reminder-modal');
  if (openModalBtn) {
    openModalBtn.addEventListener('click', () => openAddReminderModal());
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', initRemindersPage);
