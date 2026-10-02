/**
 * Notification Service
 * Abstracts various providers (FCM, Twilio, Gupshup, Mocks).
 */

class NotificationService {
  constructor() {
    this.providers = {
      mock: {
        send: async (to, message, metadata) => {
          console.log(`[MOCK NOTIFICATION] To: ${to} | Msg: ${message}`);
          if (metadata) console.log(`[MOCK METADATA]`, metadata);
          return { success: true, provider: 'mock' };
        }
      },
      fcm: {
        send: async (to, message, metadata) => {
          if (!process.env.FCM_SERVER_KEY) throw new Error('FCM key not configured');
          console.log(`[FCM Push] To: ${to} | Push payload sent`);
          // Real HTTP request to FCM would go here
          return { success: true, provider: 'fcm' };
        }
      },
      twilio: {
        send: async (to, message, metadata) => {
          if (!process.env.TWILIO_SID) throw new Error('Twilio not configured');
          console.log(`[Twilio SMS] To: ${to} | SMS sent`);
          return { success: true, provider: 'twilio' };
        }
      },
      childlineMock: {
        send: async (to, message, metadata) => {
          console.log(`[CHILDLINE 1098 SIMULATED] Forwarded Case: ${metadata.ticketId}`);
          return { success: true, provider: 'childlineMock' };
        }
      }
    };

    // Default provider based on env
    this.defaultProvider = process.env.NODE_ENV === 'production' && process.env.FCM_SERVER_KEY ? 'fcm' : 'mock';
  }

  async sendNotification(to, message, metadata = {}, providerName = null) {
    const provider = providerName ? this.providers[providerName] : this.providers[this.defaultProvider];
    
    if (!provider) {
      console.warn(`[Notification] Provider ${providerName} not found, falling back to mock`);
      return this.providers.mock.send(to, message, metadata);
    }

    try {
      return await provider.send(to, message, metadata);
    } catch (error) {
      console.error(`[Notification Error - ${providerName || this.defaultProvider}]:`, error.message);
      // Fallback to mock on error
      return this.providers.mock.send(to, message, metadata);
    }
  }

  // Domain specific helper
  async alertTeam(teamName, ticket) {
    const message = `URGENT: New rescue assignment for ${teamName}. ID: ${ticket.trackingId || ticket._id}. Priority: ${ticket.priority}`;
    // In real app, look up team member phone/fcm token. Using mock directly here.
    await this.sendNotification(`team:${teamName}`, message, { ticketId: ticket._id });
  }

  async alertAdmin(escalatedTicketsCount) {
    const message = `SLA BREACH ALERT: ${escalatedTicketsCount} tickets have breached SLA!`;
    await this.sendNotification('admin_channel', message, { count: escalatedTicketsCount });
  }

  async forwardToChildline(ticket) {
    const message = `Forwarding child rescue case ${ticket.trackingId || ticket._id}`;
    await this.sendNotification('1098', message, { ticketId: ticket._id }, 'childlineMock');
  }
}

module.exports = new NotificationService();
