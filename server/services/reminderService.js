import { supabaseAdmin } from '../config/supabase.js';
import { sendScheduledReminderEmail } from './emailService.js';

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // UTC+05:30
const MAX_DELIVERY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 2 * 60 * 1000; // 2 minutes backoff between retries
const STALE_LOCK_MS = 5 * 60 * 1000; // 5 minutes stale lock recovery

let isSweepRunning = false;
let workerIntervalHandle = null;

/**
 * Returns the current date ('YYYY-MM-DD') and time ('HH:MM') in Asia/Kolkata (IST).
 */
export const getCurrentIstDateTime = (nowMs = Date.now()) => {
  const istDate = new Date(nowMs + IST_OFFSET_MS);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istDate.getUTCDate()).padStart(2, '0');
  const hours = String(istDate.getUTCHours()).padStart(2, '0');
  const minutes = String(istDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(istDate.getUTCSeconds()).padStart(2, '0');

  return {
    dateStr: `${year}-${month}-${day}`,
    timeStr: `${hours}:${minutes}`,
    fullTimeStr: `${hours}:${minutes}:${seconds}`,
    epochMs: nowMs
  };
};

/**
 * Parses a date ('YYYY-MM-DD') and time ('HH:MM' or 'HH:MM:SS') in Asia/Kolkata (UTC+05:30)
 * into a UTC epoch timestamp in milliseconds.
 */
export const parseIstDateTimeToEpochMs = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return NaN;
  const cleanDate = String(dateStr).trim();
  const cleanTime = String(timeStr).trim();
  const normalizedTime = cleanTime.length === 5 ? `${cleanTime}:00` : cleanTime.slice(0, 8);
  const isoIst = `${cleanDate}T${normalizedTime}+05:30`;
  return Date.parse(isoIst);
};

/**
 * Parses delivery metadata encoded in `related_application_ref`.
 * Supported encodings:
 * - "sent|<sentAtIso>|<messageId>"
 * - "lock|<lockedAtIso>"
 * - "fail|<attempts>|<lastAttemptIso>|<errorCode>"
 */
export const parseDeliveryMeta = (refValue, rawStatus, createdAt) => {
  const ref = String(refValue || '').trim();
  if (ref.startsWith('sent|')) {
    const [, sentAtIso, messageId] = ref.split('|');
    return {
      email_sent: true,
      sent_at: sentAtIso || createdAt || new Date().toISOString(),
      updated_at: sentAtIso || createdAt || new Date().toISOString(),
      delivery_attempts: 1,
      provider_message_id: messageId || null
    };
  }
  if (ref.startsWith('fail|')) {
    const [, attemptsStr, lastAttemptIso, errorCode] = ref.split('|');
    return {
      email_sent: false,
      sent_at: null,
      updated_at: lastAttemptIso || createdAt || new Date().toISOString(),
      delivery_attempts: parseInt(attemptsStr, 10) || 1,
      last_attempt_at: lastAttemptIso || null,
      last_error: errorCode || null,
      provider_message_id: null
    };
  }
  if (ref.startsWith('lock|')) {
    const [, lockedAtIso] = ref.split('|');
    return {
      email_sent: false,
      sent_at: null,
      updated_at: lockedAtIso || createdAt || new Date().toISOString(),
      locked_at: lockedAtIso || null,
      delivery_attempts: 0,
      provider_message_id: null
    };
  }
  return {
    email_sent: rawStatus === 'Sent',
    sent_at: rawStatus === 'Sent' ? (createdAt || new Date().toISOString()) : null,
    updated_at: createdAt || new Date().toISOString(),
    delivery_attempts: rawStatus === 'Sent' ? 1 : 0,
    provider_message_id: null
  };
};

/**
 * Hydrates a raw `public.user_reminders` row with normalized IST status and email delivery fields.
 */
export const hydrateReminderRecord = (row, nowMs = Date.now()) => {
  if (!row) return null;
  const meta = parseDeliveryMeta(row.related_application_ref, row.status, row.created_at);
  const { dateStr: todayIst } = getCurrentIstDateTime(nowMs);
  const rawStatus = row.status || 'Scheduled';

  let displayStatus = rawStatus;
  if (meta.email_sent && rawStatus !== 'Completed') {
    displayStatus = 'Sent';
  } else if (rawStatus === 'Scheduled' || rawStatus === 'Upcoming' || rawStatus === 'Today') {
    if (row.reminder_date === todayIst) {
      displayStatus = 'Today';
    } else {
      displayStatus = 'Scheduled';
    }
  }

  return {
    ...row,
    reminder_time: String(row.reminder_time || '').slice(0, 5),
    status: displayStatus,
    raw_status: rawStatus,
    email_sent: Boolean(meta.email_sent),
    sent_at: meta.sent_at || null,
    updated_at: meta.updated_at || row.created_at || new Date().toISOString(),
    delivery_attempts: meta.delivery_attempts || 0,
    provider_message_id: meta.provider_message_id || null
  };
};

/**
 * Validates reminder input fields and timezone constraints in Asia/Kolkata.
 */
export const validateReminderInput = (payload, { allowPastDate = false } = {}) => {
  const title = String(payload?.title || '').trim();
  const category = String(payload?.category || '').trim();
  const priority = String(payload?.priority || 'Medium').trim();
  const related_scheme = String(payload?.related_scheme || '').trim() || null;
  const reminder_date = String(payload?.reminder_date || '').trim();
  const reminder_time = String(payload?.reminder_time || '').trim().slice(0, 5);
  const repeat_frequency = String(payload?.repeat_frequency || 'One-time').trim();
  const notes = String(payload?.notes || '').trim() || null;

  if (!title) {
    const err = new Error('Reminder Title is required.');
    err.statusCode = 400;
    throw err;
  }
  if (!category) {
    const err = new Error('Category is required.');
    err.statusCode = 400;
    throw err;
  }
  if (!['Low', 'Medium', 'High'].includes(priority)) {
    const err = new Error('Priority must be Low, Medium, or High.');
    err.statusCode = 400;
    throw err;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reminder_date)) {
    const err = new Error('Valid Date (YYYY-MM-DD) is required.');
    err.statusCode = 400;
    throw err;
  }
  if (!/^\d{2}:\d{2}$/.test(reminder_time)) {
    const err = new Error('Valid Time (HH:MM) is required.');
    err.statusCode = 400;
    throw err;
  }

  const scheduledEpochMs = parseIstDateTimeToEpochMs(reminder_date, reminder_time);
  if (Number.isNaN(scheduledEpochMs)) {
    const err = new Error('Invalid Date or Time value.');
    err.statusCode = 400;
    throw err;
  }

  if (!allowPastDate) {
    // Allow a 60-second grace window for same-minute submission in IST
    const nowMs = Date.now() - 60 * 1000;
    if (scheduledEpochMs < nowMs) {
      const { dateStr, timeStr } = getCurrentIstDateTime();
      const err = new Error(
        `Scheduled date/time (${reminder_date} ${reminder_time} IST) cannot be in the past. Current IST time is ${dateStr} ${timeStr}.`
      );
      err.statusCode = 400;
      throw err;
    }
  }

  return {
    title,
    category,
    priority,
    related_scheme,
    reminder_date,
    reminder_time,
    repeat_frequency,
    notes
  };
};

/**
 * Lists all reminders strictly owned by `userId`.
 */
export const listUserReminders = async (userId) => {
  if (!userId) {
    const err = new Error('Authentication required.');
    err.statusCode = 401;
    throw err;
  }

  const { data, error } = await supabaseAdmin
    .from('user_reminders')
    .select('*')
    .eq('user_id', userId)
    .order('reminder_date', { ascending: true })
    .order('reminder_time', { ascending: true });

  if (error) {
    const err = new Error(`Failed to fetch reminders: ${error.message}`);
    err.statusCode = 500;
    throw err;
  }

  const nowMs = Date.now();
  return (data || []).map((row) => hydrateReminderRecord(row, nowMs));
};

/**
 * Creates a new reminder in `public.user_reminders` strictly bound to `userId`.
 */
export const createUserReminder = async (userId, payload) => {
  if (!userId) {
    const err = new Error('Authentication required.');
    err.statusCode = 401;
    throw err;
  }

  const validated = validateReminderInput(payload);

  const insertPayload = {
    user_id: userId,
    title: validated.title,
    category: validated.category,
    priority: validated.priority,
    related_scheme: validated.related_scheme,
    reminder_date: validated.reminder_date,
    reminder_time: validated.reminder_time,
    repeat_frequency: validated.repeat_frequency,
    status: 'Scheduled',
    notes: validated.notes,
    related_application_ref: null
  };

  const { data, error } = await supabaseAdmin
    .from('user_reminders')
    .insert([insertPayload])
    .select('*')
    .single();

  if (error) {
    const err = new Error(`Failed to save reminder: ${error.message}`);
    err.statusCode = 500;
    throw err;
  }

  return hydrateReminderRecord(data);
};

/**
 * Updates an existing reminder ONLY if it is owned by `userId`.
 */
export const updateUserReminder = async (userId, reminderId, updates) => {
  if (!userId) {
    const err = new Error('Authentication required.');
    err.statusCode = 401;
    throw err;
  }

  // Verify strict ownership first
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('user_reminders')
    .select('*')
    .eq('id', reminderId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    const err = new Error(`Database error: ${fetchError.message}`);
    err.statusCode = 500;
    throw err;
  }
  if (!existing) {
    const err = new Error('Reminder not found or access denied.');
    err.statusCode = 404;
    throw err;
  }

  const patch = {};
  if (updates.status !== undefined) {
    patch.status = String(updates.status).trim();
  }
  if (updates.reminder_date !== undefined) {
    patch.reminder_date = String(updates.reminder_date).trim();
  }
  if (updates.reminder_time !== undefined) {
    patch.reminder_time = String(updates.reminder_time).trim().slice(0, 5);
  }
  if (updates.title !== undefined) {
    patch.title = String(updates.title).trim();
  }
  if (updates.category !== undefined) {
    patch.category = String(updates.category).trim();
  }
  if (updates.priority !== undefined) {
    patch.priority = String(updates.priority).trim();
  }
  if (updates.related_scheme !== undefined) {
    patch.related_scheme = updates.related_scheme ? String(updates.related_scheme).trim() : null;
  }
  if (updates.notes !== undefined) {
    patch.notes = updates.notes ? String(updates.notes).trim() : null;
  }

  // If rescheduled/snoozed to a new date/time, reset status to Scheduled and clear prior delivery lock
  if ((patch.reminder_date || patch.reminder_time) && patch.status !== 'Completed') {
    patch.status = 'Scheduled';
    patch.related_application_ref = null;
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('user_reminders')
    .update(patch)
    .eq('id', reminderId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (updateError) {
    const err = new Error(`Failed to update reminder: ${updateError.message}`);
    err.statusCode = 500;
    throw err;
  }

  return hydrateReminderRecord(updated);
};

/**
 * Deletes a reminder ONLY if it is owned by `userId`.
 */
export const deleteUserReminder = async (userId, reminderId) => {
  if (!userId) {
    const err = new Error('Authentication required.');
    err.statusCode = 401;
    throw err;
  }

  const { data: deleted, error } = await supabaseAdmin
    .from('user_reminders')
    .delete()
    .eq('id', reminderId)
    .eq('user_id', userId)
    .select('id');

  if (error) {
    const err = new Error(`Failed to delete reminder: ${error.message}`);
    err.statusCode = 500;
    throw err;
  }

  if (!deleted || deleted.length === 0) {
    const err = new Error('Reminder not found or access denied.');
    err.statusCode = 404;
    throw err;
  }

  return { deleted: true, id: reminderId };
};

/**
 * Resolves the trusted registered email and display name for a user_id from Supabase Auth / profiles.
 */
export const resolveTrustedUserRecipient = async (userId) => {
  if (!userId) return null;

  try {
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (!authErr && authData?.user?.email) {
      const user = authData.user;
      const fullName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email.split('@')[0];
      return {
        email: user.email,
        name: fullName
      };
    }
  } catch (err) {
    console.warn(`[ReminderScheduler] auth.admin.getUserById fallback for ${userId}:`, err.message);
  }

  // Fallback to public.users table if present
  try {
    const { data: dbUser } = await supabaseAdmin
      .from('users')
      .select('email, name, full_name')
      .eq('id', userId)
      .maybeSingle();

    if (dbUser?.email) {
      return {
        email: dbUser.email,
        name: dbUser.full_name || dbUser.name || dbUser.email.split('@')[0]
      };
    }
  } catch (_) {
    // ignore
  }

  return null;
};

/**
 * Executes a single sweep of due reminders in Asia/Kolkata timezone.
 * Atomically claims each due reminder before dispatching email via Resend so duplicate
 * emails are never sent even if multiple sweeps trigger.
 */
export const processDueRemindersSweep = async (nowMs = Date.now()) => {
  if (isSweepRunning) {
    return { skipped: true, reason: 'sweep_already_in_progress', processed: 0, sent: 0, failed: 0 };
  }

  isSweepRunning = true;
  const summary = {
    checked: 0,
    due: 0,
    claimed: 0,
    sent: 0,
    failed: 0,
    skippedDuplicate: 0,
    results: []
  };

  try {
    const { dateStr: todayIst } = getCurrentIstDateTime(nowMs);

    // Fetch active/pending reminders whose reminder_date is <= today in IST (or stale Processing locks)
    const { data: candidates, error } = await supabaseAdmin
      .from('user_reminders')
      .select('*')
      .in('status', ['Scheduled', 'Upcoming', 'Today', 'Processing'])
      .lte('reminder_date', todayIst)
      .order('reminder_date', { ascending: true })
      .order('reminder_time', { ascending: true })
      .limit(50);

    if (error) {
      console.error('[ReminderScheduler] Error querying due reminders:', error.message);
      return summary;
    }

    summary.checked = (candidates || []).length;

    for (const candidate of candidates || []) {
      const meta = parseDeliveryMeta(candidate.related_application_ref, candidate.status, candidate.created_at);

      // 1. Never resend if already marked sent
      if (meta.email_sent || candidate.status === 'Sent' || candidate.status === 'Completed') {
        summary.skippedDuplicate += 1;
        continue;
      }

      // 2. If status is Processing, only recover if lock is stale (> 5 minutes)
      if (candidate.status === 'Processing') {
        const lockTimeMs = meta.locked_at ? Date.parse(meta.locked_at) : 0;
        if (lockTimeMs && nowMs - lockTimeMs < STALE_LOCK_MS) {
          continue;
        }
      }

      // 3. If previous delivery attempt failed, respect retry backoff & max attempts
      if (meta.delivery_attempts >= MAX_DELIVERY_ATTEMPTS) {
        await supabaseAdmin
          .from('user_reminders')
          .update({ status: 'Failed' })
          .eq('id', candidate.id);
        continue;
      }
      if (meta.last_attempt_at) {
        const lastAttemptMs = Date.parse(meta.last_attempt_at);
        if (!Number.isNaN(lastAttemptMs) && nowMs - lastAttemptMs < RETRY_BACKOFF_MS) {
          continue;
        }
      }

      // 4. Evaluate whether the reminder's IST Date + Time is due (<= nowMs)
      const dueEpochMs = parseIstDateTimeToEpochMs(candidate.reminder_date, candidate.reminder_time);
      if (Number.isNaN(dueEpochMs) || dueEpochMs > nowMs) {
        continue;
      }

      summary.due += 1;

      // 5. ATOMIC CLAIM: transition status to 'Processing' only if status is still candidate.status
      const lockRef = `lock|${new Date(nowMs).toISOString()}`;
      const { data: claimed, error: claimError } = await supabaseAdmin
        .from('user_reminders')
        .update({
          status: 'Processing',
          related_application_ref: lockRef
        })
        .eq('id', candidate.id)
        .eq('status', candidate.status)
        .select('*')
        .maybeSingle();

      if (claimError || !claimed) {
        summary.skippedDuplicate += 1;
        continue;
      }

      summary.claimed += 1;

      // 6. Resolve trusted user email from backend user record
      const recipient = await resolveTrustedUserRecipient(claimed.user_id);
      if (!recipient || !recipient.email) {
        const attempts = (meta.delivery_attempts || 0) + 1;
        const nextStatus = attempts >= MAX_DELIVERY_ATTEMPTS ? 'Failed' : 'Scheduled';
        const failRef = `fail|${attempts}|${new Date().toISOString()}|no_recipient_email`;
        await supabaseAdmin
          .from('user_reminders')
          .update({ status: nextStatus, related_application_ref: failRef })
          .eq('id', claimed.id);
        summary.failed += 1;
        summary.results.push({ id: claimed.id, status: 'failed', reason: 'no_recipient_email' });
        continue;
      }

      // 7. Dispatch real email via Resend
      const emailResult = await sendScheduledReminderEmail({
        to: recipient.email,
        userName: recipient.name,
        reminder: claimed
      });

      if (emailResult && emailResult.success) {
        const sentAtIso = new Date().toISOString();
        const messageId = emailResult.messageId || 'delivered';
        const sentRef = `sent|${sentAtIso}|${messageId}`;

        const { data: updatedRow } = await supabaseAdmin
          .from('user_reminders')
          .update({
            status: 'Sent',
            related_application_ref: sentRef
          })
          .eq('id', claimed.id)
          .select('*')
          .maybeSingle();

        summary.sent += 1;
        summary.results.push({
          id: claimed.id,
          user_id: claimed.user_id,
          recipient: recipient.email,
          status: 'Sent',
          email_sent: true,
          sent_at: sentAtIso,
          provider_message_id: messageId,
          statusCode: emailResult.statusCode || 200,
          record: hydrateReminderRecord(updatedRow || { ...claimed, status: 'Sent', related_application_ref: sentRef })
        });
      } else {
        const attempts = (meta.delivery_attempts || 0) + 1;
        const nextStatus = attempts >= MAX_DELIVERY_ATTEMPTS ? 'Failed' : 'Scheduled';
        const failRef = `fail|${attempts}|${new Date().toISOString()}|${emailResult?.statusCode || 'send_error'}`;

        await supabaseAdmin
          .from('user_reminders')
          .update({
            status: nextStatus,
            related_application_ref: failRef
          })
          .eq('id', claimed.id);

        summary.failed += 1;
        summary.results.push({
          id: claimed.id,
          user_id: claimed.user_id,
          recipient: recipient.email,
          status: nextStatus,
          email_sent: false,
          attempts,
          error: emailResult?.error || 'Email provider error'
        });
      }
    }

    return summary;
  } finally {
    isSweepRunning = false;
  }
};

/**
 * Starts the recurring background scheduler worker that polls due reminders every 30 seconds.
 */
export const startReminderBackgroundWorker = (intervalMs = 30 * 1000) => {
  if (workerIntervalHandle) {
    return workerIntervalHandle;
  }

  console.log(`[ReminderScheduler] Initializing Due-Reminder Email Worker (polling every ${Math.round(intervalMs / 1000)}s in Asia/Kolkata IST)...`);

  // Initial sweep shortly after server startup
  setTimeout(() => {
    processDueRemindersSweep().catch((err) => {
      console.error('[ReminderScheduler] Initial sweep error:', err.message);
    });
  }, 2500);

  workerIntervalHandle = setInterval(() => {
    processDueRemindersSweep().catch((err) => {
      console.error('[ReminderScheduler] Periodic sweep error:', err.message);
    });
  }, intervalMs);

  return workerIntervalHandle;
};
