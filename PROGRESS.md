# Mumbai Upgrade Progress

## Tier 1: Security Foundation (mandatory)
- [x] T1.1 Fix known bugs: remove 30-day TTL on tickets, fix docker-compose env var name mismatch, port mismatch, Mongo auth and no public port, raise express.json limit to 8mb with validation, fail startup in production if JWT_SECRET or ALLOWED_DOMAINS is missing, fix /hotspots, re-enable duplicate detection.
- [x] T1.2 Auth and RBAC: User model, requireAuth and requireRole, helmet, CORS allowlist, express-rate-limit, centralized error handler, Tracking ID 10+ chars, safe alphabet. Frontend apiClient.ts, DEV_AUTH_BYPASS mode.
- [x] T1.3 Real key management: delete src/utils/demoKeys.ts, RSA-OAEP keypair in browser, Envelope encryption (AES-GCM), key rotation/revocation, strip EXIF/GPS, AES-GCM additional authenticated data.
- [x] T1.4 Tamper-evident audit log: seq, action, ticketId, actorId, actorRole, details, timestamp, prevHash, hash. Written only after action succeeds, append-only. GET /api/audit/verify returns {valid, brokenAtSeq}. Dashboard badge.
- [x] T1.5 Tests for Tier 1: Auth/RBAC matrix, key wrap/unwrap round trip, duplicate merge, audit chain and tamper detection. Make npm test real.

## Tier 2: Workflow and Mumbai Operations (mandatory)
- [x] T2.1 State machine: REPORTED -> VERIFIED -> DISPATCHED -> RESCUED -> CWC_PRODUCED -> REHAB_FOLLOWUP -> CLOSED, REJECTED, DUPLICATE. Enforce server-side, audit each.
- [x] T2.2 Mumbai ward assignment: Team model, suggest nearest available team, officer confirms. Add railwayJurisdiction flag.
- [x] T2.3 SLA timers per priority with countdowns, breach flags, escalation to admin.
- [x] T2.4 Socket.io with JWT-authenticated sockets.
- [ ] T2.5 Notification service behind provider interface: console/mock default, FCM, Twilio/Gupshup (untested without keys). SIMULATED Childline/Khoya Paya mocks.
- [ ] T2.6 Seed script: npm run seed for demo officers, 24 teams, 400+ synthetic tickets.
- [ ] T2.7 Tests for workflow, SLA, ward assignment, seed idempotency.

## Tier 3: ML Pipeline (mandatory)
- [ ] Create /ml (Python, FastAPI, scikit-learn, LightGBM, h3, shap, pandas).
- [ ] T3.1 ml/data/generate.py: Mumbai synthetic generator using config.
- [ ] T3.2 Triage model: LightGBM predicting urgency 1-5. Save precision/recall/F1, confusion matrix, feature-importance chart.
- [ ] T3.3 Hotspot forecast: H3 res 8/9 bins, expected incidents, report MAE and top-k hit rate. Endpoint GET /api/analytics/hotspot-forecast.
- [ ] T3.4 FastAPI service: /triage/predict, /hotspots/forecast, /health; save model files, ml/model_card.md. Backend client with timeout and automatic fallback.
- [ ] T3.5 make ml (or npm run ml:train): generates data, trains, evaluates, writes reports. pytest checks metrics exceed sane thresholds.

## Tier 4: Citizen PWA + Dashboard Polish (if time allows)
- [ ] T4.1 Dashboard: split AuthorityDashboard.tsx, Analytics (hotspot heatmap, SLA stats, rescue funnel, ward comparison, category breakdown, triage reasons, audit badge).
- [ ] T4.2 Citizen app: composite on-device quality score, retry-capture UX, on-device dHash, explicit plain-language consent step.
- [ ] T4.3 Offline queue hardening: exponential backoff, max retries, idempotency key, real PWA.
- [ ] T4.4 i18n with react-i18next: Marathi, Hindi, English.
- [ ] T4.5 Field-team mobile view and PDF/CSV export with audit hash footer.
- [ ] T4.6 GitHub Actions CI: lint, typecheck, tests, build, npm audit, gitleaks.

## Documentation
- [ ] README.md rewrite
- [ ] docs/ARCHITECTURE.md, docs/THREAT_MODEL.md
- [ ] docs/DECISIONS.md, docs/DEMO_SCRIPT.md, ml/model_card.md
- [ ] docs/SETUP_LATER.md, .env.example
