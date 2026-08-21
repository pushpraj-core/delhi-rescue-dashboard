const AuditLog = require('../models/AuditLog');

const logAction = (action) => {
  return async (req, res, next) => {
    try {
      const ticketId = req.params.id || req.body.ticketId;
      const officerId = req.body.officerId || req.headers['x-officer-id'] || 'Nodal_Officer_DL_01';
      
      const logEntry = new AuditLog({
        action,
        ticketId,
        officerId,
        details: {
          ip: req.ip,
          method: req.method,
          path: req.originalUrl,
          body: req.body
        }
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
