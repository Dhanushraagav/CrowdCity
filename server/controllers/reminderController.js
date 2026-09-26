import {
  listUserReminders,
  createUserReminder,
  updateUserReminder,
  deleteUserReminder,
  processDueRemindersSweep
} from '../services/reminderService.js';

/**
 * GET /api/reminders
 * Returns all reminders strictly belonging to the authenticated user (req.user.id).
 */
export const getReminders = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Trigger due-reminder sweep before listing so any newly due reminder reflects its updated Sent status
    await processDueRemindersSweep();

    const reminders = await listUserReminders(userId);
    return res.status(200).json({
      success: true,
      count: reminders.length,
      activeCount: reminders.filter((r) => ['Scheduled', 'Upcoming', 'Today'].includes(r.status)).length,
      reminders
    });
  } catch (err) {
    console.error('[ReminderController] getReminders error:', err.message);
    return res.status(err.statusCode || 500).json({
      error: err.message || 'Failed to load reminders'
    });
  }
};

/**
 * POST /api/reminders
 * Creates a new reminder bound strictly to req.user.id (ignores any client-supplied user_id).
 */
export const createReminder = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const created = await createUserReminder(userId, req.body);

    // Trigger non-blocking sweep in case reminder is scheduled for the current minute
    processDueRemindersSweep().catch((sweepErr) => {
      console.warn('[ReminderController] Background sweep warning:', sweepErr.message);
    });

    return res.status(201).json({
      success: true,
      reminder: created
    });
  } catch (err) {
    console.error('[ReminderController] createReminder error:', err.message);
    return res.status(err.statusCode || 500).json({
      error: err.message || 'Failed to create reminder'
    });
  }
};

/**
 * PATCH /api/reminders/:id
 * Updates a reminder ONLY if owned by req.user.id.
 */
export const updateReminder = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const reminderId = req.params.id;
    const updated = await updateUserReminder(userId, reminderId, req.body || {});

    return res.status(200).json({
      success: true,
      reminder: updated
    });
  } catch (err) {
    console.error('[ReminderController] updateReminder error:', err.message);
    return res.status(err.statusCode || 500).json({
      error: err.message || 'Failed to update reminder'
    });
  }
};

/**
 * DELETE /api/reminders/:id
 * Deletes a reminder ONLY if owned by req.user.id.
 */
export const deleteReminder = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const reminderId = req.params.id;
    const result = await deleteUserReminder(userId, reminderId);

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error('[ReminderController] deleteReminder error:', err.message);
    return res.status(err.statusCode || 500).json({
      error: err.message || 'Failed to delete reminder'
    });
  }
};
