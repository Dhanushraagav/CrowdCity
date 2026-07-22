// CrowdCity AI v2.3 - WhatsApp Integration Management Controller
// Binds admin dashboard operations and status requests.

import { whatsappService } from './whatsappService.js';

export const getStatus = async (req, res, next) => {
  try {
    const hasSession = !!whatsappService.client;
    res.status(200).json({
      success: true,
      status: whatsappService.status,
      hasSession,
      qrCode: whatsappService.qrCodeDataUrl,
      queueCount: whatsappService.messageQueue.length
    });
  } catch (err) {
    next(err);
  }
};

export const triggerReconnect = async (req, res, next) => {
  try {
    // Fire-and-forget init, runs in background to prevent request timeouts
    whatsappService.initialize();
    res.status(200).json({
      success: true,
      message: 'WhatsApp connection initialization process triggered successfully.'
    });
  } catch (err) {
    next(err);
  }
};

export const triggerDisconnect = async (req, res, next) => {
  try {
    await whatsappService.disconnect();
    res.status(200).json({
      success: true,
      message: 'WhatsApp client disconnected and resources cleaned up.'
    });
  } catch (err) {
    next(err);
  }
};

export const sendTestMessage = async (req, res, next) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: 'Parameters phone and message are required.' });
  }

  try {
    await whatsappService.sendTestMessage(phone, message);
    res.status(200).json({
      success: true,
      message: `Test message dispatched successfully to ${phone}.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const triggerNotification = async (req, res, next) => {
  const { eventName, data } = req.body;
  const userId = req.user?.id || req.body.userId;

  if (!eventName) {
    return res.status(400).json({ error: 'Parameter eventName is required.' });
  }
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required to identify notification preferences.' });
  }

  try {
    await whatsappService.sendNotification(userId, eventName, data);
    res.status(200).json({
      success: true,
      message: `Notification dispatch triggered for event '${eventName}'.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getLogs = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      logs: whatsappService.logs
    });
  } catch (err) {
    next(err);
  }
};

export const getQueue = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      queue: whatsappService.messageQueue
    });
  } catch (err) {
    next(err);
  }
};
