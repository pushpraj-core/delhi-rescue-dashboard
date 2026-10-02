# Raksha Mumbai 🛡️
**Juvenile Justice Act Compliant Child Rescue Platform**

A secure, offline-first Progressive Web App (PWA) and ML-powered Nodal Dispatch system designed to protect vulnerable children. Built specifically to handle sensitive rescue operations in Mumbai without compromising privacy or leaking critical data.

## Key Features

1. **Zero-Leak Citizen App (PWA)**:
   - Client-side TensorFlow.js automatically blurs children's faces *before* the image is saved or transmitted.
   - Works fully offline using IndexedDB with exponential backoff syncing.
   - Tamper-evident perceptual hashes (dHash) prevent deepfakes.

2. **Military-Grade Security (Tier 1)**:
   - **Envelope Encryption**: AES-GCM payloads wrapped in RSA-OAEP keys. Data cannot be read if the database is breached.
   - **Immutable Audit Log**: Cryptographically chained SHA-256 ledger tracks every single view, action, and decryption. 

3. **Intelligent Dispatch (Tier 2 & 3)**:
   - **ML Triage**: LightGBM model predicts case urgency (Critical 1 to Low 5) to auto-prioritize dispatch.
   - **Hotspot Forecasting**: Uses H3 geographic hexagons and historical rolling means to predict high-risk areas 24h in advance.
   - **Strict SLAs**: Automated timers (1h, 4h, 12h, 24h) escalate breached cases to administrators.
   - **Real-time**: Socket.io ensures the Authority board updates instantly without polling.

4. **Multi-lingual Support (Tier 4)**:
   - Full i18n support for English, Hindi, and Marathi in the citizen capture app.

## Tech Stack
- **Frontend**: React, Vite, TailwindCSS, TensorFlow.js (BlazeFace), i18next
- **Backend**: Node.js, Express, MongoDB (Mongoose), Socket.io, WebCrypto API
- **Machine Learning**: Python, FastAPI, LightGBM, scikit-learn, Uber H3
- **DevOps**: Docker, GitHub Actions CI

## Architecture & Threat Model
Please see the `/docs` directory for deep-dives into our design philosophy:
- `ARCHITECTURE.md`
- `THREAT_MODEL.md`
- `DECISIONS.md`

## Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   cd backend && npm install
   cd ../ml && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt
   ```

2. **Generate Mumbai Synthetic Data & Train ML**:
   ```bash
   npm run ml:train
   ```

3. **Start the Dev Servers**:
   ```bash
   npm run dev
   npm run ml:serve
   ```
