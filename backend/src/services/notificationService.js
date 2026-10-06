/**
 * Notification Service — Honest provider abstraction.
 * 
 * Providers report NOT_SENT when unconfigured.
 * Only Twilio SMS is implemented as a real provider.
 * Childline 1098, CCTNS, and FCM are adapter stubs showing NOT CONNECTED.
 */

class NotificationService {
  constructor() {
    this._twilioClient = null;
  }

  /**
   * Lazily initialise Twilio client only when credentials exist.
   */
  _getTwilioClient() {
    if (this._twilioClient) return this._twilioClient;

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;

    if (!sid || !token) return null;

    try {
      const twilio = require('twilio');
      this._twilioClient = twilio(sid, token);
      return this._twilioClient;
    } catch (err) {
      console.warn('[Notification] Twilio SDK not installed or failed to init:', err.message);
      return null;
    }
  }

  /**
   * Send an SMS via Twilio. Returns success status honestly.
   */
  async sendSms(to, message) {
    const client = this._getTwilioClient();
    const from = process.env.TWILIO_PHONE;

    if (!client || !from) {
      const result = {
        sent: false,
        provider: 'twilio',
        status: 'NOT_SENT',
        reason: 'Twilio provider not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE.'
      };
      console.warn(`[Notification] ${result.reason}`);
      return result;
    }

    try {
      const msg = await client.messages.create({ body: message, from, to });
      return {
        sent: true,
        provider: 'twilio',
        status: 'SENT',
        sid: msg.sid
      };
    } catch (err) {
      return {
        sent: false,
        provider: 'twilio',
        status: 'FAILED',
        reason: err.message
      };
    }
  }

  /**
   * Send a test SMS (admin action).
   */
  async sendTestSms(to) {
    return this.sendSms(to, '[Raksha MMR] Test notification from admin panel. If you received this, SMS alerts are working.');
  }

  /**
   * Alert a rescue team about a new dispatch.
   */
  async alertTeam(teamName, ticket) {
    const message = `[Raksha MMR] DISPATCH: Case ${ticket.trackingId || ticket._id}. Priority: ${ticket.priority}. Team: ${teamName}.`;

    // Try SMS to team members (would look up phone numbers from User model in production)
    const User = require('../models/User');
    const officers = await User.find({
      role: { $in: ['officer', 'field_team'] },
      phone: { $ne: null },
      active: true
    }).select('phone').lean();

    const results = [];
    for (const officer of officers) {
      const result = await this.sendSms(officer.phone, message);
      results.push(result);
    }

    // If no officers have phone numbers or Twilio not configured, log honestly
    if (results.length === 0) {
      console.warn(`[Notification] alertTeam: No officers with phone numbers found. SMS not sent.`);
      return { sent: false, status: 'NOT_SENT', reason: 'No officers with phone numbers configured' };
    }

    return { sent: results.some(r => r.sent), results };
  }

  /**
   * Alert admin about SLA breaches.
   */
  async alertSLABreach(escalatedCount) {
    const message = `[Raksha MMR] SLA ALERT: ${escalatedCount} case(s) have breached their SLA deadline.`;
    // This would SMS admins; for now just log
    console.warn(`[Notification] SLA Breach Alert: ${escalatedCount} cases.`);
    return { sent: false, status: 'NOT_SENT', reason: 'Admin phone not configured' };
  }

  /**
   * Adapter: Childline 1098 — NOT CONNECTED.
   */
  async forwardToChildline(ticket) {
    const result = {
      sent: false,
      provider: 'childline_1098',
      status: 'NOT_CONNECTED',
      reason: 'Childline 1098 API requires MoU with MWCD. Integration architecture ready, awaiting credentials.'
    };
    console.warn(`[Notification] Childline 1098: ${result.reason}`);
    return result;
  }

  /**
   * Adapter: CCTNS (Police) — NOT CONNECTED.
   */
  async forwardToCCTNS(ticket) {
    const result = {
      sent: false,
      provider: 'cctns',
      status: 'NOT_CONNECTED',
      reason: 'CCTNS integration requires government VPN access. Adapter interface ready.'
    };
    console.warn(`[Notification] CCTNS: ${result.reason}`);
    return result;
  }

  /**
   * Adapter: TrackChild / Khoya Paya — NOT CONNECTED.
   */
  async forwardToTrackChild(ticket) {
    const result = {
      sent: false,
      provider: 'trackchild',
      status: 'NOT_CONNECTED',
      reason: 'TrackChild/Khoya Paya API requires MWCD authorisation. Adapter interface ready.'
    };
    console.warn(`[Notification] TrackChild: ${result.reason}`);
    return result;
  }
}

module.exports = new NotificationService();
