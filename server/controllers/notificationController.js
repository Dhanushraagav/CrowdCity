import { supabase, supabaseAdmin, getSupabaseClient } from '../config/supabase.js';
import logger from '../config/logger.js';

// Predefined mock notifications for testing
let MOCK_NOTIFICATIONS = [];

// Active Server-Sent Events (SSE) clients for mock mode
let sseClients = [];

/**
 * SSE Endpoint for realtime mock updates
 */
export const registerSseClient = (req, res) => {
  const userId = req.user.id;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send an initial heartbeat to open the connection
  res.write(': heartbeat\n\n');

  const client = { id: userId, res };
  sseClients.push(client);

  console.log(`Realtime SSE client connected for user: ${userId}. Active: ${sseClients.length}`);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c.res !== res);
    console.log(`Realtime SSE client disconnected for user: ${userId}. Active: ${sseClients.length}`);
  });
};

/**
 * Helper to broadcast a realtime notification to a connected SSE user
 */
const broadcastSseNotification = (userId, notification) => {
  sseClients.forEach(c => {
    if (c.id === userId) {
      try {
        c.res.write(`data: ${JSON.stringify(notification)}\n\n`);
      } catch (err) {
        logger.error(`Error sending SSE data to user ${userId}: %O`, err);
      }
    }
  });
};

/**
 * Helper to create a notification programmatically from other controller actions
 */
export const createNotification = async (userId, title, message, type, issueId) => {
  const isSupabaseConfigured = process.env.SUPABASE_URL && 
                               !process.env.SUPABASE_URL.includes('placeholder') &&
                               !process.env.SUPABASE_URL.includes('your-project-ref') &&
                               process.env.SUPABASE_URL !== '';
  
  const isMock = !isSupabaseConfigured || userId.startsWith('mock-');

  const newNotif = {
    user_id: userId,
    title,
    message,
    type,
    issue_id: issueId,
    is_read: false
  };

  if (!isMock) {
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
  }

  // Fallback for Mock Mode
  const mockNotif = {
    ...newNotif,
    id: `mock-n-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    created_at: new Date().toISOString()
  };

  MOCK_NOTIFICATIONS.unshift(mockNotif);
  
  // Broadcast to connected SSE clients
  broadcastSseNotification(userId, mockNotif);

  return mockNotif;
};

/**
 * Fetch all notifications for the logged-in user
 */
export const getNotifications = async (req, res) => {
  const userId = req.user.id;
  const isSupabaseConfigured = process.env.SUPABASE_URL && 
                               !process.env.SUPABASE_URL.includes('placeholder') &&
                               !process.env.SUPABASE_URL.includes('your-project-ref') &&
                               process.env.SUPABASE_URL !== '';

  const isMock = !isSupabaseConfigured || userId.startsWith('mock-');

  if (isMock) {
    const userNotifs = MOCK_NOTIFICATIONS.filter(n => n.user_id === userId);
    return res.status(200).json(userNotifs);
  }

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
  const isSupabaseConfigured = process.env.SUPABASE_URL && 
                               !process.env.SUPABASE_URL.includes('placeholder') &&
                               !process.env.SUPABASE_URL.includes('your-project-ref') &&
                               process.env.SUPABASE_URL !== '';

  const isMock = !isSupabaseConfigured || userId.startsWith('mock-');

  if (isMock) {
    const notif = MOCK_NOTIFICATIONS.find(n => n.id === id && n.user_id === userId);
    if (notif) {
      notif.is_read = true;
      return res.status(200).json({ message: 'Notification marked as read', notification: notif });
    }
    return res.status(404).json({ error: 'Notification not found' });
  }

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
  const isSupabaseConfigured = process.env.SUPABASE_URL && 
                               !process.env.SUPABASE_URL.includes('placeholder') &&
                               !process.env.SUPABASE_URL.includes('your-project-ref') &&
                               process.env.SUPABASE_URL !== '';

  const isMock = !isSupabaseConfigured || userId.startsWith('mock-');

  if (isMock) {
    MOCK_NOTIFICATIONS.forEach(n => {
      if (n.user_id === userId) {
        n.is_read = true;
      }
    });
    return res.status(200).json({ message: 'All notifications marked as read' });
  }

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
