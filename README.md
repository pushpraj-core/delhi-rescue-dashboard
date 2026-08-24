# Raksha: Secure Child Rescue & Tracking System

## Overview
Raksha is an end-to-end encrypted, AI-powered platform designed to assist the Delhi Government and allied child protection agencies in identifying, tracking, and rescuing children subjected to hazardous labor, trafficking, and public begging. 

The system aligns with the Juvenile Justice (JJ) Act and recent Delhi state schemes targeting the rehabilitation of child beggars by providing a secure bridge between anonymous citizen reporting and official government dispatch workflows.

## Problem Statement
Despite dedicated government schemes, authorities struggle to efficiently locate and rescue victims at traffic intersections and public spaces. Citizens frequently witness these situations but hesitate to report them due to privacy concerns and the lack of a secure platform. Furthermore, when reports are made, agencies lack a centralized, automated system to verify evidence, triage emergencies, and quickly dispatch field rescue teams while maintaining a legal audit trail.

## Key Innovations

*   **Zero-Knowledge Architecture (E2EE):** To protect the identities of vulnerable minors, the platform utilizes Web Crypto API (RSA-OAEP & AES-GCM). Photographic evidence is encrypted on the citizen's device before transmission. The backend server acts only as a blind relay; decryption occurs exclusively on the authorized officer's local machine via their private key.
*   **On-Device Edge AI:** Integrated TensorFlow.js (BlazeFace model) runs directly in the citizen's browser. It acts as a primary filter to ensure a human face is present in the captured media before a report is permitted, significantly reducing spam and false positives without compromising privacy.
*   **Immutable Audit Logging:** Every action taken by a government official (e.g., updating case status, assigning teams, adding internal notes) is permanently logged to ensure a strict legal chain of custody and accountability in accordance with child protection policies.
*   **Khoya Paya Integration:** The dashboard features an automated cross-referencing system to match incoming reports against existing missing child databases.
*   **Automated PDF Generation:** Generates real-time, downloadable statistical reports for administrative review and record-keeping.

## Technical Stack

**Frontend**
*   React (Vite)
*   Tailwind CSS
*   TensorFlow.js (BlazeFace)
*   Leaflet & React-Leaflet
*   React-PDF

**Backend & Database**
*   Node.js & Express.js
*   MongoDB & Mongoose
*   JSON Web Tokens (JWT) & Google Auth Library
*   Turf.js (Geospatial Analysis)

**Infrastructure**
*   Docker & Docker Compose
*   Nginx

## Getting Started

### Prerequisites
*   Node.js (v18 or higher)
*   MongoDB (Local or Atlas URL)
*   Docker Desktop (Optional, for containerized deployment)

### Containerized Deployment (Recommended)
The application is fully containerized and production-ready via Docker Compose.

1. Ensure Docker Desktop is running.
2. Execute the build command from the root directory:
   ```bash
   docker-compose up -d --build
   ```
3. The application will be accessible at `http://localhost`.

### Local Development Setup
If you prefer to run the development servers directly:

1. **Install Dependencies:**
   ```bash
   # Install frontend dependencies
   npm install
   
   # Install backend dependencies
   cd backend && npm install
   ```

2. **Start the Development Servers:**
   ```bash
   # Start backend (from the /backend directory)
   npm run dev

   # Start frontend (from the root directory)
   npm run dev
   ```
3. Access the frontend at `http://localhost:5173`.

## Architecture Note
For demonstration and local development purposes, the RSA Private Key required for decryption is pre-filled in the Authority Login interface. In a production government deployment, this key would be physically distributed to nodal officers (e.g., via hardware security keys) or securely cached within the browser's IndexedDB.
