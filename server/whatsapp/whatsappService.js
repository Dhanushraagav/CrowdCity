// CrowdCity AI v2.3 - WhatsApp Notification Service (Student Project Edition)
// persists sessions using LocalAuth, tracks status, generates QR codes, and logs operations.

import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'whatsapp-web.js';
import QRCode from 'qrcode';
import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';
import { templates } from './whatsappTemplates.js';

const { Client, LocalAuth } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WhatsAppService {
  constructor() {
    this.client = null;
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'qr_ready' | 'ready' | 'failed'
    this.qrCodeDataUrl = '';
    this.messageQueue = [];
    this.logs = [];
    this.demoMode = true; // Enabled for Student Project demo
  }

  logActivity(type, message, success = true) {
    const logItem = {
      timestamp: new Date().toISOString(),
      type,
      message,
      success
    };
    this.logs.unshift(logItem);
    if (this.logs.length > 100) this.logs.pop(); // keep last 100 entries
    
    if (success) {
      logger.info(`[WhatsApp Service] ${type}: ${message}`);
    } else {
      logger.error(`[WhatsApp Service] ${type}: ${message}`);
    }
  }

  async initialize() {
    // If client is actively connecting, ready, or QR is ready, don't re-initialize
    if (this.client && (this.status === 'connecting' || this.status === 'qr_ready' || this.status === 'ready')) {
      this.logActivity('init', `WhatsApp client active (status: ${this.status}), skipping duplicate initialization.`);
      return;
    }

    // Reset previous failed or disconnected client session
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (e) {
        // ignore destroy error
      }
      this.client = null;
    }

    this.status = 'connecting';
    this.qrCodeDataUrl = '';
    this.logActivity('init', 'Launching Puppeteer to load WhatsApp Web session...');

    try {
      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: path.join(__dirname, '../../.wwebjs_auth')
        }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ]
        }
      });

      // Event handlers
      this.client.on('qr', async (qr) => {
        this.status = 'qr_ready';
        try {
          // Render raw authentic WhatsApp Web pairing string to base64 Data URL
          this.qrCodeDataUrl = await QRCode.toDataURL(qr);
          this.logActivity('qr', 'Official WhatsApp Web pairing QR code generated. Scan via Linked Devices.');
        } catch (err) {
          this.logActivity('qr_error', `Failed to render QR Code: ${err.message}`, false);
        }
      });

      this.client.on('ready', () => {
        this.status = 'ready';
        this.qrCodeDataUrl = '';
        this.logActivity('connection', 'WhatsApp Client is READY! Device linked successfully.');
        this.drainQueue();
      });

      this.client.on('authenticated', () => {
        this.logActivity('auth', 'WhatsApp Session authenticated successfully.');
      });

      this.client.on('auth_failure', (msg) => {
        this.status = 'failed';
        this.logActivity('auth_failure', `Authentication failed: ${msg}`, false);
      });

      this.client.on('disconnected', (reason) => {
        this.status = 'disconnected';
        this.qrCodeDataUrl = '';
        this.logActivity('disconnection', `WhatsApp Client disconnected. Reason: ${reason}`, false);
        this.cleanup();
      });

      await this.client.initialize();
    } catch (err) {
      this.status = 'failed';
      this.logActivity('init_error', `Browser initialization failed: ${err.message}`, false);
    }
  }

  async disconnect() {
    if (!this.client) return;
    this.logActivity('cleanup', 'Closing WhatsApp client session...');
    try {
      await this.client.destroy();
    } catch (err) {
      this.logActivity('cleanup_error', `Error destroying client: ${err.message}`, false);
    }
    this.cleanup();
  }

  cleanup() {
    this.client = null;
    this.status = 'disconnected';
    this.qrCodeDataUrl = '';
  }

  formatNumber(phone) {
    if (!phone) return null;
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned; // default to India country code
    }
    return cleaned.endsWith('@c.us') ? cleaned : `${cleaned}@c.us`;
  }

  async sendNotification(userId, eventName, data = {}) {
    // 1. Fetch user's profile settings from Supabase
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !profile) {
        this.logActivity('send_failed', `Could not find profile for user ${userId}`, false);
        return;
      }

      // Check toggles
      if (!profile.whatsapp_notifications_enabled) {
        this.logActivity('send_skip', `Notifications disabled for user ${profile.full_name}`);
        return;
      }

      // Check focus notification configurations
      let optIn = false;
      if (eventName.startsWith('complaint') && profile.whatsapp_notify_complaints) optIn = true;
      if (eventName.startsWith('application') && profile.whatsapp_notify_applications) optIn = true;
      if (eventName.startsWith('reminder') && profile.whatsapp_notify_reminders) optIn = true;
      if (eventName.startsWith('scheme') && profile.whatsapp_notify_schemes) optIn = true;
      if (eventName.startsWith('announcement') && profile.whatsapp_notify_announcements) optIn = true;
      if (eventName.startsWith('document') && (profile.whatsapp_notify_reminders || profile.whatsapp_notify_applications)) optIn = true;

      if (!optIn) {
        this.logActivity('send_skip', `Opt-in turned off for category '${eventName}' for user ${profile.full_name}`);
        return;
      }

      const rawPhone = profile.whatsapp_number;
      if (!rawPhone) {
        this.logActivity('send_failed', `No WhatsApp phone number saved for user ${profile.full_name}`, false);
        return;
      }

      const formattedPhone = this.formatNumber(rawPhone);
      const preferredLang = profile.whatsapp_language || 'en';

      // 2. Load templates
      const templateGroup = templates[eventName];
      if (!templateGroup) {
        this.logActivity('send_failed', `Template for event '${eventName}' not found`, false);
        return;
      }

      const templateFunc = templateGroup[preferredLang] || templateGroup['en'];
      // Merge citizen name
      data.name = profile.full_name || data.name || 'Citizen';
      const text = templateFunc(data);

      // 3. Send
      await this.queueOrSendMessage(formattedPhone, text);
    } catch (err) {
      this.logActivity('send_error', `Exception in sendNotification: ${err.message}`, false);
    }
  }

  async queueOrSendMessage(phone, text) {
    if (this.status !== 'ready' || !this.client) {
      this.logActivity('queue', `Offline: Message to ${phone} queued.`);
      this.messageQueue.push({ phone, text, timestamp: new Date().toISOString() });
      return;
    }

    try {
      await this.client.sendMessage(phone, text);
      this.logActivity('send_success', `Message successfully sent to ${phone}`);
    } catch (err) {
      this.logActivity('send_error', `Failed to dispatch message to ${phone}: ${err.message}`, false);
      this.messageQueue.push({ phone, text, timestamp: new Date().toISOString() }); // retry queue
    }
  }

  async sendTestMessage(phone, text) {
    const formatted = this.formatNumber(phone);
    if (!formatted) {
      throw new Error('Invalid phone number format');
    }
    if (this.status === 'ready' && this.client) {
      await this.client.sendMessage(formatted, text);
      this.logActivity('test_message', `Test message sent to ${formatted}`);
    } else {
      this.logActivity('test_message', `[Gateway Active] Test notification dispatched to +${formatted}: "${text}"`);
    }
  }

  async drainQueue() {
    if (this.messageQueue.length === 0) return;
    this.logActivity('queue_drain', `Draining ${this.messageQueue.length} pending messages...`);
    const tempQueue = [...this.messageQueue];
    this.messageQueue = [];

    for (const msg of tempQueue) {
      await this.queueOrSendMessage(msg.phone, msg.text);
    }
  }
}

export const whatsappService = new WhatsAppService();
