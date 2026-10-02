# PROGRESS.md — Raksha MMR (SEVA Challenge 2026)

> Last updated: 2026-10-03T02:35 IST  
> Commit: `646c874`

## Phase 0: Regressions — ✅ DONE

| Task | Status | Verification |
|------|--------|-------------|
| Fix dHash ReferenceError in ticketService.js | ✅ | `dHash` destructured from `ticketData`, defaults to `null` |
| Fix crypto.ts decryptImagePayload officer matching | ✅ | Matches `wrappedKey` by `officerEmail`, throws clear error if no match |
| Remove fake "Forecast (ML)" from AnalyticsBoard | ✅ | Renamed to "Hourly Pattern of Critical Reports — Historical distribution, not a prediction". Removed `Math.max(5,...)` and `+0.1` |
| Remove fake Critical Risk tooltip from MapViewer | ✅ | Removed `Math.max(1, Math.floor(f.expected_incidents * 0.35))` |
| CI: remove failure-hiding | ✅ | Removed all `\|\| true` and `\|\| echo`. Node 22. `npm ci` instead of `npm install` |
| Replace Math.random in business logic | ✅ | `generateTrackingId` uses `crypto.randomInt`. Offline report IDs use `crypto.randomUUID`. Seed uses deterministic Mulberry32 PRNG |

## Phase 1: MMR Jurisdictions — ✅ DONE

| Task | Status | Verification |
|------|--------|-------------|
| config/jurisdictions.json | ✅ | 7 jurisdictions + MMR-wide bounds + shared categories + railway stations |
| useLocationSecure.ts: MMR geofence | ✅ | Replaced DELHI_BOUNDS with MMR bounds. Fixed demo point (CSMT) instead of Math.random spoofing |
| Backend: MMR jurisdiction matching | ✅ | `getJurisdictionForLocation()` from config. Out-of-region rejects with error. No silent UNASSIGNED |
| Frontend: MMR GeoJSON | ✅ | `mmr_jurisdictions.json` with 7 jurisdiction polygons. `mumbai_wards.json` no longer imported |
| Map tiles: free CARTO | ✅ | Replaced Mapbox (requires token) with `basemaps.cartocdn.com/dark_all` (free, no token) |
| Shared category list | ✅ | One list in `config/jurisdictions.json`, used by: Ticket model enum, CitizenCapture, MapViewer filters, seed |
| Seed: 420 tickets across MMR | ✅ | Deterministic PRNG (seed=42), time-consistent statuses, `isSynthetic: true`, spread across 7 jurisdictions |
| Leftover cleanup | ✅ | Zero grep hits for Delhi/DCPCR/Raipur/Nagpur/Nodal_Officer_DL in src/ and backend/ |
| Package rename | ✅ | `raksha-mmr`, PWA manifest updated, offline store key updated |
| ReportGenerator fix | ✅ | Uses real status enum values, renamed to "Raksha MMR Impact Report", SYNTHETIC banner |
| Note author from req.user | ✅ | No longer accepts author from request body |

## Build Verification (Phase 0+1)

```
npx tsc -b          → 0 errors
npm run lint         → 0 errors, 51 warnings (pre-existing React hook warnings)
npm run build        → ✓ built in 1.11s, dist/ generated
```

## Phases Remaining

- **Phase 2**: Security (auth, RBAC, audit, officer keys, DEMO_MODE)
- **Phase 3**: Honest triage rules, real analytics
- **Phase 4**: Inter-jurisdiction handoff, related cases, railway view, i18n, citizen safety
- **Phase 5**: Tests, demo script, docs

## What Still Needs Your Input

| Item | What I need |
|------|-------------|
| Google OAuth Client ID | Your `VITE_GOOGLE_CLIENT_ID` for auth |
| Twilio trial keys | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE` for SMS alerts |
| Official ward GeoJSON | MCGM/TMC boundaries (currently approximate) |
| Statistics for slides | Real numbers for the problem statement with `[ADD SOURCE]` placeholders |
| Letters of interest | From any NGO/CWC/DCPU contact |
| Legal review | DPDP Act and JJ Act identity-protection constraints |
