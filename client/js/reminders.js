// CrowdCity AI v2.0 - Smart Reminder Center JavaScript
// Features reminder management, calendar timeline views, status updates, snooze/complete actions, and Supabase sync.

(function() {
  'use strict';

  let userReminders = [];
  let currentStatusFilter = 'all';
  let currentCategoryFilter = 'all';
  let currentSearchQuery = '';

  const fallbackReminders = [
    {
      id: 'rem-1',
      title: 'Income Certificate Renewal Deadline',
      category: 'Income Certificate Renewal',
      related_scheme: 'Pudhumai Penn Scheme',
      reminder_date: '2026-08-01',
      reminder_time: '10:00',
      priority: 'High',
      status: 'Upcoming',
      notes: 'Apply via E-Sevai center for updated annual family income certificate.'
    },
    {
      id: 'rem-2',
      title: 'Aadhaar Biometric Update Appointment',
      category: 'Aadhaar Update',
      related_scheme: 'Kalaignar Magalir Urimai Thittam',
      reminder_date: new Date().toISOString().split('T')[0],
      reminder_time: '11:30',
      priority: 'Medium',
      status: 'Today',
      notes: 'Visit nearest Taluk office / Post Office Aadhaar center with original Ration Card.'
    }
  ];

  async function fetchReminders() {
    const container = document.getElementById('reminders-list-container');
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 4rem 1rem;">
          <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2.2rem; color: var(--primary); margin-bottom: 1rem;"></i>
          <p style="font-size: 0.95rem; color: var(--text-muted);">Loading your government deadline reminders...</p>
        </div>
      `;
    }

    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const session = await client.auth.getSession();
          const userId = session?.data?.session?.user?.id;

          if (!userId) {
            renderEmptyState("Please sign in to set and manage your government reminders.");
            return;
          }

          const { data, error } = await client
            .from('user_reminders')
            .select('*')
            .eq('user_id', userId)
            .order('reminder_date', { ascending: true });

          if (!error && data) {
            userReminders = data;
            localStorage.setItem('cc_user_reminders', JSON.stringify(userReminders));
            renderRemindersList();
            return;
          }
        }
      }
    } catch (err) {
      console.warn("Supabase fetch reminders error, using local fallback:", err);
    }

    // LocalStorage Fallback
    try {
      const stored = localStorage.getItem('cc_user_reminders');
      if (stored) {
        userReminders = JSON.parse(stored);
        renderRemindersList();
        return;
      }
    } catch (e) {}

    userReminders = [...fallbackReminders];
    renderRemindersList();
  }

  function renderEmptyState(message) {
    const container = document.getElementById('reminders-list-container');
    const countElem = document.getElementById('reminder-count');
    if (countElem) countElem.textContent = '0';

    if (!container) return;

    container.innerHTML = `
      <div style="text-align: center; padding: 4rem 1.5rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px;">
        <i class="fa-solid fa-bell-slash" style="font-size: 2.8rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
        <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.5rem 0;">No Reminders Scheduled</h3>
        <p style="font-size: 0.9rem; color: var(--text-muted); max-width: 480px; margin: 0 auto 1.5rem auto; line-height: 1.5;">${message}</p>
        <button type="button" class="btn btn-primary" onclick="document.getElementById('add-reminder-modal').style.display='flex'" style="padding: 0.75rem 1.5rem; font-weight: 700; border-radius: 12px; display: inline-flex; align-items: center; gap: 0.5rem;">
          <i class="fa-solid fa-plus"></i> <span>Create First Reminder</span>
        </button>
      </div>
    `;
  }

  function getPriorityBadgeStyle(priority) {
    switch (priority) {
      case 'High':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' };
      case 'Medium':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#d97706', border: 'rgba(245, 158, 11, 0.3)' };
      default:
        return { bg: 'rgba(13, 148, 136, 0.15)', text: 'var(--primary)', border: 'rgba(13, 148, 136, 0.3)' };
    }
  }

  function renderRemindersList() {
    const container = document.getElementById('reminders-list-container');
    const countElem = document.getElementById('reminder-count');

    let filtered = userReminders;
    if (currentStatusFilter !== 'all') {
      filtered = filtered.filter(r => r.status.toLowerCase() === currentStatusFilter.toLowerCase());
    }
    if (currentCategoryFilter !== 'all') {
      filtered = filtered.filter(r => r.category === currentCategoryFilter);
    }
    if (currentSearchQuery) {
      filtered = filtered.filter(r => 
        r.title.toLowerCase().includes(currentSearchQuery) ||
        (r.related_scheme && r.related_scheme.toLowerCase().includes(currentSearchQuery))
      );
    }

    if (countElem) countElem.textContent = filtered.length;

    if (!container) return;

    if (filtered.length === 0) {
      renderEmptyState("No reminders match your selected filter or search query.");
      return;
    }

    container.innerHTML = filtered.map(rem => {
      const pStyle = getPriorityBadgeStyle(rem.priority);
      const isCompleted = rem.status === 'Completed';

      return `
        <div class="reminder-card" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 18px; padding: 1.5rem; margin-bottom: 1.25rem; box-shadow: 0 6px 20px rgba(0,0,0,0.03); opacity: ${isCompleted ? '0.65' : '1'};">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.5rem; flex-wrap: wrap;">
            <div>
              <span style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.2rem 0.6rem; border-radius: 999px; background: ${pStyle.bg}; color: ${pStyle.text}; border: 1px solid ${pStyle.border}; display: inline-block; margin-bottom: 0.35rem;">
                ${rem.priority} Priority • ${rem.category}
              </span>
              <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main); margin: 0; text-decoration: ${isCompleted ? 'line-through' : 'none'};">${rem.title}</h3>
            </div>

            <div style="font-size: 0.85rem; font-weight: 800; color: var(--primary); background: var(--bg-app); border: 1px solid var(--border-color); padding: 0.4rem 0.85rem; border-radius: 10px;">
              <i class="fa-solid fa-calendar-day"></i> ${rem.reminder_date} ${rem.reminder_time ? `at ${rem.reminder_time}` : ''}
            </div>
          </div>

          ${rem.related_scheme ? `
            <div style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.75rem;">
              <i class="fa-solid fa-building-columns"></i> Scheme: <strong>${rem.related_scheme}</strong>
            </div>
          ` : ''}

          ${rem.notes ? `
            <div style="font-size: 0.88rem; color: var(--text-main); background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 10px; padding: 0.85rem; margin-bottom: 1rem; line-height: 1.5;">
              ${rem.notes}
            </div>
          ` : ''}

          <!-- Quick Actions -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-color); padding-top: 1rem; flex-wrap: wrap; gap: 0.75rem;">
            <button type="button" class="btn-toggle-complete" data-id="${rem.id}" style="background: ${isCompleted ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-app)'}; border: 1px solid ${isCompleted ? '#10b981' : 'var(--border-color)'}; color: ${isCompleted ? '#10b981' : 'var(--text-main)'}; font-size: 0.8rem; font-weight: 700; padding: 0.45rem 0.95rem; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 0.4rem;">
              <i class="fa-solid ${isCompleted ? 'fa-circle-check' : 'fa-circle'}"></i> <span>${isCompleted ? 'Completed' : 'Mark Complete'}</span>
            </button>

            <div style="display: flex; gap: 0.5rem;">
              <button type="button" class="btn-snooze-rem" data-id="${rem.id}" style="background: var(--bg-app); border: 1px solid var(--border-color); color: var(--text-main); font-size: 0.78rem; font-weight: 700; padding: 0.45rem 0.8rem; border-radius: 8px; cursor: pointer;">
                <i class="fa-solid fa-clock"></i> Snooze 1 Day
              </button>
              <button type="button" class="btn-delete-rem" data-id="${rem.id}" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444; width: 34px; height: 34px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Toggle Complete Listeners
    container.querySelectorAll('.btn-toggle-complete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const target = userReminders.find(r => r.id === id);
        if (target) {
          const nextStatus = target.status === 'Completed' ? 'Upcoming' : 'Completed';
          await updateReminderStatus(id, nextStatus);
        }
      });
    });

    // Snooze Listeners
    container.querySelectorAll('.btn-snooze-rem').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        await snoozeReminder(id);
      });
    });

    // Delete Listeners
    container.querySelectorAll('.btn-delete-rem').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        await deleteReminder(id);
      });
    });
  }

  async function addReminderRecord(newRem) {
    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const session = await client.auth.getSession();
          const userId = session?.data?.session?.user?.id;

          if (userId) {
            const payload = { user_id: userId, ...newRem };
            const { data, error } = await client.from('user_reminders').insert(payload).select();
            if (!error && data) {
              if (window.showToast) window.showToast("Reminder created successfully!", "success");
              fetchReminders();
              return;
            }
          }
        }
      }
    } catch (e) {}

    newRem.id = 'local_rem_' + Date.now();
    userReminders.unshift(newRem);
    localStorage.setItem('cc_user_reminders', JSON.stringify(userReminders));
    if (window.showToast) window.showToast("Reminder saved locally!", "success");
    renderRemindersList();
  }

  async function updateReminderStatus(id, newStatus) {
    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          await client.from('user_reminders').update({ status: newStatus }).eq('id', id);
        }
      }
    } catch (e) {}

    const target = userReminders.find(r => r.id === id);
    if (target) {
      target.status = newStatus;
      localStorage.setItem('cc_user_reminders', JSON.stringify(userReminders));
      renderRemindersList();
    }
  }

  async function snoozeReminder(id) {
    const target = userReminders.find(r => r.id === id);
    if (target) {
      const curDate = new Date(target.reminder_date);
      curDate.setDate(curDate.getDate() + 1);
      target.reminder_date = curDate.toISOString().split('T')[0];

      try {
        if (typeof window.getOrInitSupabaseClient === 'function') {
          const client = await window.getOrInitSupabaseClient();
          if (client) {
            await client.from('user_reminders').update({ reminder_date: target.reminder_date }).eq('id', id);
          }
        }
      } catch (e) {}

      localStorage.setItem('cc_user_reminders', JSON.stringify(userReminders));
      if (window.showToast) window.showToast("Reminder snoozed by 1 day!", "info");
      renderRemindersList();
    }
  }

  async function deleteReminder(id) {
    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          await client.from('user_reminders').delete().eq('id', id);
        }
      }
    } catch (e) {}

    userReminders = userReminders.filter(r => r.id !== id);
    localStorage.setItem('cc_user_reminders', JSON.stringify(userReminders));
    if (window.showToast) window.showToast("Reminder deleted.", "info");
    renderRemindersList();
  }

  document.addEventListener('DOMContentLoaded', () => {
    fetchReminders();

    // Add Reminder Modal Handlers
    const modal = document.getElementById('add-reminder-modal');
    const openModalBtn = document.getElementById('btn-open-add-reminder-modal');
    const closeModalBtn = document.getElementById('btn-close-add-reminder-modal');
    const saveRemBtn = document.getElementById('btn-save-new-reminder');

    if (openModalBtn && modal) openModalBtn.addEventListener('click', () => modal.style.display = 'flex');
    if (closeModalBtn && modal) closeModalBtn.addEventListener('click', () => modal.style.display = 'none');

    if (saveRemBtn) {
      saveRemBtn.addEventListener('click', () => {
        const title = document.getElementById('new-rem-title')?.value;
        const category = document.getElementById('new-rem-category')?.value;
        const scheme = document.getElementById('new-rem-scheme')?.value;
        const date = document.getElementById('new-rem-date')?.value || new Date().toISOString().split('T')[0];
        const time = document.getElementById('new-rem-time')?.value || '09:00';
        const priority = document.getElementById('new-rem-priority')?.value || 'Medium';
        const notes = document.getElementById('new-rem-notes')?.value;

        if (!title) {
          if (window.showToast) window.showToast("Please enter a reminder title.", "error");
          return;
        }

        addReminderRecord({
          title: title,
          category: category || 'Government Application Follow-up',
          related_scheme: scheme,
          reminder_date: date,
          reminder_time: time,
          priority: priority,
          status: 'Upcoming',
          notes: notes
        });

        if (modal) modal.style.display = 'none';
      });
    }

    // Filter & Search Handlers
    const searchInput = document.getElementById('input-reminder-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value.toLowerCase().trim();
        renderRemindersList();
      });
    }

    const statusFilter = document.getElementById('select-filter-status');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        currentStatusFilter = e.target.value;
        renderRemindersList();
      });
    }
  });

})();
