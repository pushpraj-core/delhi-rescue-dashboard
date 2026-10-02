# Data Sources

## Geographic Boundaries

| Data | Source | License | Status |
|------|--------|---------|--------|
| MMR jurisdiction boundaries | Approximate bounding boxes manually derived from OpenStreetMap | ODbL | **APPROXIMATE** — replace with official MCGM/TMC ward GeoJSON for production |
| MCGM 24 ward names | [MCGM official website](https://portal.mcgm.gov.in/) | Public information | Ward names verified; polygons are approximate |
| Railway station coordinates | OpenStreetMap / Google Maps cross-reference | Factual data | Verified to ±100m |

## Map Tiles

| Provider | URL Pattern | License | Cost |
|----------|-------------|---------|------|
| CARTO Dark | `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` | CC BY 3.0 + ODbL | Free for non-commercial / hackathon use |

## Synthetic Data

All ticket data in the database is seeded by `backend/scripts/seed.js` with `isSynthetic: true`. No real incident data exists in this prototype.

- **420 tickets** distributed across 7 MMR jurisdictions
- Categories from the shared list in `config/jurisdictions.json`
- Coordinates generated within jurisdiction bounding boxes using a deterministic seeded PRNG (Mulberry32, seed=42)
- No real personally identifiable information

## What Would Be Needed for Production

1. **Official ward boundary GeoJSON** from MCGM, TMC, NMMC, KDMC
2. **Real case data** from DCPUs / CWCs (anonymised, with consent)
3. **Childline 1098 API access** — currently NOT CONNECTED
4. **Khoya Paya / TrackChild database** — currently NOT CONNECTED
5. **CCTNS integration** — currently NOT CONNECTED
6. **Railway GRP/RPF dispatch API** — currently NOT CONNECTED

> All external integrations are adapter interfaces showing "NOT CONNECTED" in the UI and audit log.
