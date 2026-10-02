const AuditLog = require('../models/AuditLog');

const logAction = (action) => {
  return async (req, res, next) => {
    try {
      const ticketId = req.params.id || (req.body && req.body.ticketId);
      // Derive actor identity from verified JWT
      const actorId = req.user ? req.user.email : 'system';
      const actorRole = req.user ? req.user.role : 'system';
      
      const crypto = require('crypto');
      const lastLog = await AuditLog.findOne().sort({ _id: -1 }).select('hash');
      const previousHash = lastLog ? lastLog.hash : '0000000000000000000000000000000000000000000000000000000000000000';

      const dataToHash = `${action}|${ticketId}|${actorId}|${actorRole}|${previousHash}|${Date.now()}`;
      const hash = crypto.createHash('sha256').update(dataToHash).digest('hex');

      const logEntry = new AuditLog({
        action,
        ticketId,
        actorId,
        actorRole,
        details: {
          ip: req.ip,
          method: req.method,
          path: req.originalUrl,
          body: req.body
        },
        previousHash,
        hash
      });

      await logEntry.save();
    } catch (err) {
      console.error('[Audit Log Error] Failed to write audit log:', err.message);
      // We don't fail the request if audit logging fails for MVP, but in production we might.
    }
    next();
  };
};

module.exports = { logAction };
