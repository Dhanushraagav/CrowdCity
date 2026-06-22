import { supabase, supabaseAdmin, getSupabaseClient } from '../config/supabase.js';
import logger from '../config/logger.js';

/**
 * Helper to create a notification programmatically from other controller actions
 */
export const createNotification = async (userId, title, message, type, issueId) => {
  const newNotif = {
    user_id: userId,
    title,
    message,
    type,
    issue_id: issueId,
    is_read: false
  };

  try {
    const activeClient = supabaseAdmin || supabase;
    const { data, error } = await activeClient
      .from('notifications')
      .insert(newNotif)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    logger.error('Failed to save Supabase notification: %O', err);
  }
};

/**
 * Fetch all notifications for the logged-in user
 */
export const getNotifications = async (req, res) => {
  const userId = req.user.id;

  try {
    const activeClient = getSupabaseClient(req);
    const { data, error } = await activeClient
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.status(200).json(data || []);
  } catch (err) {
    logger.error('getNotifications error: %O', err);
    return res.status(500).json({ error: 'Server error retrieving notifications' });
  }
};

/**
 * Mark a single notification as read
 */
export const markAsRead = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const activeClient = getSupabaseClient(req);
    const { data, error } = await activeClient
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return res.status(200).json({ message: 'Notification marked as read', notification: data });
  } catch (err) {
    logger.error('markAsRead error: %O', err);
    return res.status(500).json({ error: 'Server error updating notification status' });
  }
};

/**
 * Mark all notifications for the user as read
 */
export const markAllAsRead = async (req, res) => {
  const userId = req.user.id;

  try {
    const activeClient = getSupabaseClient(req);
    const { error } = await activeClient
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId);

    if (error) throw error;
    return res.status(200).json({ message: 'All notifications marked as read' });
  } catch (err) {
    logger.error('markAllAsRead error: %O', err);
    return res.status(500).json({ error: 'Server error updating notifications status' });
  }
};
