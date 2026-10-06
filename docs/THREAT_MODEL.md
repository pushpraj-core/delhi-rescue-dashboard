# Threat Model — Raksha MMR

## Architecture Overview

```
Citizen (PWA) → [HTTPS] → Express API → MongoDB
                           ↓ JWT Auth
Officer (Dashboard) → [HTTPS + WSS] → Express API
                                       ↓ proxy
                               ML Service (FastAPI)
```

## Implemented Security Controls

### Authentication & Authorization
| Control | Status | Implementation |
|---------|--------|---------------|
| Google OAuth 2.0 | ✅ Implemented | `google-auth-library` verifies ID tokens server-side |
| JWT session tokens | ✅ Implemented | 8-hour expiry, signed with `JWT_SECRET` env var |
| No fallback secret | ✅ Fixed | Server refuses to start without `JWT_SECRET` (except in `NODE_ENV=test`) |
| Pending user approval | ✅ Implemented | New Google users get `role: pending`, cannot access any protected route |
| Domain whitelisting | ✅ Implemented | Users signing in with `@iiitnr.edu.in` bypass pending status and become admins automatically |
| Role-based access (RBAC) | ✅ Implemented | `requireRole(['admin', 'officer'])` middleware on all sensitive routes |
| Jurisdiction scoping | ✅ Implemented | Officers only see tickets from their assigned jurisdiction |

### Data Protection
| Control | Status | Implementation |
|---------|--------|---------------|
| E2EE (AES-256-GCM + RSA-OAEP) | ✅ Implemented | Evidence encrypted on citizen's device; only matched officer can decrypt |
| Officer key matching | ✅ Fixed | `decryptImagePayload` matches `wrappedKey` by `officerEmail`, never index [0] |
| On-device face blur | ✅ Implemented | Pixelation with 30% padding before encryption |
| No plaintext evidence stored | ✅ Implemented | MongoDB stores only ciphertext + wrapped AES keys |
| Idempotency | ✅ Implemented | `Idempotency-Key` header prevents duplicate submissions |

### Audit Trail
| Control | Status | Implementation |
|---------|--------|---------------|
| Tamper-evident hash chain | ✅ Implemented | SHA-256 of canonical JSON `{seq, action, ticketId, actorId, actorRole, details, timestamp, prevHash}` |
| Monotonic sequence numbers | ✅ Implemented | Atomic `seq` field, no gaps |
| Verify endpoint | ✅ Implemented | `GET /api/tickets/audit/verify` recomputes all hashes, returns `{valid, brokenAtSeq}` |
| Redacted request bodies | ✅ Implemented | `body: '[REDACTED]'` in audit details, never raw free text |
| Post-success logging | ✅ Implemented | Audit entry written AFTER the action succeeds |

### Network & Transport
| Control | Status | Implementation |
|---------|--------|---------------|
| HTTPS (TLS) | ⚠️ Deployment-dependent | Handled by Vercel/Render reverse proxy |
| Socket.io JWT auth | ✅ Implemented | Connection requires valid JWT; emits `{id, status}` only, never encrypted payloads |
| CORS | ⚠️ Default Express | Should be restricted to specific origins in production |
| Rate limiting | ❌ Not implemented | Should add `express-rate-limit` for production |

## Known Limitations

### Browser-Held Keys
- **Risk**: Officer private keys are stored in the browser's IndexedDB, protected only by PBKDF2-derived AES-GCM encryption with a user-chosen passphrase.
- **Mitigation**: Passphrase-protected backup download and import. In production, integrate with an HSM or browser-based FIDO2/WebAuthn key store.
- **Impact**: If the browser storage is cleared or the device is compromised, the officer loses access to evidence they haven't yet decrypted.

### No HSM Integration
- **Risk**: AES and RSA keys are generated in software, not in hardware security modules.
- **Mitigation**: Acceptable for a hackathon prototype. Production deployment for a government agency MUST use HSM-backed key management (e.g., AWS CloudHSM, Azure Key Vault).

### Synthetic Data
- **Risk**: All ticket data in the prototype is synthetic. No real-world validation of the system's behaviour under actual operational conditions.
- **Mitigation**: Clearly labelled `isSynthetic: true` in the database and `SYNTHETIC DEMO DATA` banners in the UI.

### In-Memory Idempotency Store
- **Risk**: Idempotency keys are stored in process memory, lost on restart.
- **Mitigation**: Use Redis in production. Current implementation is sufficient for single-instance demo.

### Single MongoDB Instance
- **Risk**: No replication or backup.
- **Mitigation**: Use MongoDB Atlas with automatic backups for production.

### No Certificate Pinning
- **Risk**: Man-in-the-middle attacks possible if TLS is misconfigured.
- **Mitigation**: The PWA runs over HTTPS. Certificate pinning is not supported in standard web browsers.

## Threat Scenarios

| Threat | Mitigation | Residual Risk |
|--------|-----------|---------------|
| Unauthorized officer views evidence | E2EE with per-officer key wrapping; role/jurisdiction checks | Key compromise if browser is hacked |
| Tampered audit trail | SHA-256 hash chain with verify endpoint | Could be circumvented with direct DB access |
| Fake report spam | Idempotency-Key, geofence validation, duplicate detection | No CAPTCHA on citizen endpoint |
| Officer impersonation | Google OAuth + admin approval flow | Compromised Google account |
| Data exfiltration via Socket.io | JWT-authenticated; emits only `{id, status}`, never payloads | N/A |
| ML model manipulation | ML behind `ML_TRIAGE_ENABLED` flag, not used in live triage | N/A (rule-based triage is deterministic) |

## Regulatory Compliance Notes

| Regulation | Status |
|-----------|--------|
| JJ Act (identity protection of children) | ✅ Face blur, E2EE, officer-only decryption, no public photos |
| DPDP Act (data protection) | ⚠️ Needs legal review for consent flow and data retention policy |
| IT Act 2000 (electronic records) | ✅ Audit trail with hash chain qualifies as tamper-evident electronic record |
