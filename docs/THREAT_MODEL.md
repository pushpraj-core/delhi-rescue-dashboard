# Threat Model: Raksha Mumbai

## 1. Overview
Raksha Mumbai handles extremely sensitive data regarding vulnerable children (trafficking, abuse, labor). A leak of this data could tip off traffickers, endanger the reporting citizen, or traumatize the victim. 

## 2. Adversaries
- **State-level or Organized Crime**: Trafficking rings with resources to attempt database exfiltration or intercept network traffic.
- **Insider Threat**: Corrupt officials attempting to access case files out of jurisdiction or tamper with evidence.
- **Opportunistic Attackers**: Script kiddies looking for exposed S3 buckets or unauthenticated APIs.

## 3. Threat Vectors & Mitigations

### 3.1 Vector: Device Compromise (Citizen)
*Risk*: Attacker seizes citizen's phone to find unencrypted photos of rescue targets.
*Mitigation*: 
- **Zero-Leak Processing**: TensorFlow.js (BlazeFace) runs entirely in RAM. Faces are blurred *before* the canvas is converted to a Blob. 
- **Memory Flushing**: Canvas pixels are aggressively overwritten with `#000000` and dimensions reset to `0x0` to force garbage collection of raw buffers.
- **Client-Side Encryption**: The image is encrypted using the Nodal Officer's RSA Public Key *before* it touches IndexedDB (if offline) or the network.

### 3.2 Vector: Database Exfiltration
*Risk*: Attacker dumps MongoDB.
*Mitigation*: 
- **Envelope Encryption**: Images are encrypted with AES-GCM (256-bit). The AES key is wrapped with RSA-OAEP. The DB only contains ciphertexts and wrapped keys. Without the Nodal Officer's physical private key (kept securely in their browser/hardware), the data is cryptographically useless.

### 3.3 Vector: Insider Tampering
*Risk*: A corrupt officer alters case statuses to "Closed" without action, or modifies audit logs to hide tracks.
*Mitigation*: 
- **Cryptographic Ledger**: The `AuditLog` collection uses SHA-256 chaining. `current_hash = SHA256(previous_hash + payload)`. If a DBA deletes a row, the chain breaks. The UI features a "Verify Ledger Integrity" button that recalculates the chain in real-time.
- **Strict State Machine**: Tickets can only progress through defined states (e.g. `REPORTED` -> `VERIFIED` -> `DISPATCHED`).

### 3.4 Vector: AI/Deepfake Poisoning
*Risk*: Attackers submit fake AI-generated images to exhaust police resources.
*Mitigation*: 
- **dHash (Perceptual Hashing)**: A perceptual hash is calculated on-device at the moment of capture. 
- **Confidence Scores**: The ML model scores incoming images based on metadata heuristics and facial detection confidence. Low confidence routes to a separate queue.
