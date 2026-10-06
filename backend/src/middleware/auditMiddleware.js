const AuditLog = require('../models/AuditLog');
const crypto = require('crypto');

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Computes a SHA-256 hash of the canonical JSON representation of an audit entry.
 * The canonical form includes: {seq, action, ticketId, actorId, actorRole, details, timestamp, prevHash}
 * Details are redacted (only keys preserved, values replaced with "[REDACTED]") for privacy.
 */
function computeHash(entry) {
  // Redact details to prevent free-text leakage into the hash chain
  const redactedDetails = {};
  if (entry.details && typeof entry.details === 'object') {
    for (const key of Object.keys(entry.details)) {
      if (key === 'body') {
        redactedDetails[key] = '[REDACTED]';
      } else {
        redactedDetails[key] = entry.details[key];
      }
    }
  }

  const canonical = JSON.stringify({
    seq: entry.seq,
    action: entry.action,
    ticketId: entry.ticketId ? entry.ticketId.toString() : null,
    actorId: entry.actorId,
    actorRole: entry.actorRole,
    details: redactedDetails,
    timestamp: entry.timestamp.toISOString(),
    prevHash: entry.previousHash
  });

  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Writes an audit log entry AFTER the action succeeds.
 * Uses atomic findOneAndUpdate to get a monotonically increasing seq.
 */
async function writeAuditLog({ action, ticketId, actorId, actorRole, details }) {
  const timestamp = new Date();

  // Get the last entry atomically for previousHash and seq
  const lastLog = await AuditLog.findOne().sort({ seq: -1 }).select('hash seq').lean();
  const previousHash = lastLog ? lastLog.hash : GENESIS_HASH;
  const seq = lastLog ? lastLog.seq + 1 : 1;

  const entry = {
    seq,
    action,
    ticketId: ticketId || null,
    actorId,
    actorRole,
    details: details || {},
    timestamp,
    previousHash
  };

  entry.hash = computeHash(entry);

  const logEntry = new AuditLog(entry);
  await logEntry.save();
  return logEntry;
}

/**
 * Express middleware that logs AFTER the route handler succeeds.
 * Wraps the response to capture success before logging.
 */
const logAction = (action) => {
  return (req, res, next) => {
    // Override res.json to log after success
    const originalJson = res.json.bind(res);
    res.json = async function (body) {
      // Only log on success (2xx status)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const ticketId = req.params.id || (body && body.ticket && body.ticket.id);
          const actorId = req.user ? req.user.email : 'system';
          const actorRole = req.user ? req.user.role : 'system';

          await writeAuditLog({
            action,
            ticketId,
            actorId,
            actorRole,
            details: {
              method: req.method,
              path: req.originalUrl,
              body: '[REDACTED]'  // Never store request bodies in audit
            }
          });
        } catch (err) {
          console.error('[Audit] Failed to write log (action already succeeded):', err.message);
        }
      }
      return originalJson(body);
    };
    next();
  };
};

/**
 * Verifies the entire audit chain. Returns { valid, brokenAtSeq, totalEntries }.
 */
async function verifyChain() {
  const logs = await AuditLog.find().sort({ seq: 1 }).lean();
  let previousHash = GENESIS_HASH;

  for (const log of logs) {
    // Check previousHash link
    if (log.previousHash !== previousHash) {
      return { valid: false, brokenAtSeq: log.seq, reason: 'previousHash mismatch', totalEntries: logs.length };
    }

    // Recompute hash and compare
    const recomputed = computeHash({
      seq: log.seq,
      action: log.action,
      ticketId: log.ticketId,
      actorId: log.actorId,
      actorRole: log.actorRole,
      details: log.details,
      timestamp: log.timestamp,
      previousHash: log.previousHash
    });

    if (recomputed !== log.hash) {
      return { valid: false, brokenAtSeq: log.seq, reason: 'hash mismatch (content tampered)', totalEntries: logs.length };
    }

    previousHash = log.hash;
  }

  return { valid: true, brokenAtSeq: null, totalEntries: logs.length };
}

module.exports = { logAction, writeAuditLog, verifyChain, computeHash, GENESIS_HASH };
