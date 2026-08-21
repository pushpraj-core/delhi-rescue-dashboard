/**
 * Secure E2EE Cryptography Utilities
 * Uses Web Crypto API for Hybrid Encryption (AES-GCM + RSA-OAEP).
 */

export interface EncryptedPayload {
  encryptedAesKey: string; // Base64
  iv: string;              // Base64
  encryptedData: string;   // Base64
}

// Helpers for Base64 conversion
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Encrypts a Blob (Image) using Hybrid Encryption.
 * 1. Generates ephemeral AES-GCM key.
 * 2. Encrypts Blob with AES key.
 * 3. Encrypts AES key with provided RSA Public Key.
 */
export async function encryptImagePayload(
  blob: Blob, 
  publicKeyJwk: JsonWebKey
): Promise<EncryptedPayload> {
  // 1. Import the RSA Public Key
  const rsaPubKey = await window.crypto.subtle.importKey(
    'jwk',
    publicKeyJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['encrypt']
  );

  // 2. Generate Ephemeral AES-GCM Key
  const aesKey = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  // 3. Encrypt the Image Blob with AES-GCM
  const imageBuffer = await blob.arrayBuffer();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedImageBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    imageBuffer
  );

  // 4. Encrypt the AES Key with RSA Public Key
  const exportedAesKey = await window.crypto.subtle.exportKey('raw', aesKey);
  const encryptedAesKeyBuffer = await window.crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    rsaPubKey,
    exportedAesKey
  );

  // 5. Convert everything to Base64 for database storage
  return {
    encryptedAesKey: arrayBufferToBase64(encryptedAesKeyBuffer),
    iv: arrayBufferToBase64(iv.buffer),
    encryptedData: arrayBufferToBase64(encryptedImageBuffer)
  };
}

/**
 * Decrypts an EncryptedPayload back into a Blob URL for safe viewing.
 * 1. Decrypts AES key using RSA Private Key.
 * 2. Decrypts Image Data using AES key.
 */
export async function decryptImagePayload(
  payload: EncryptedPayload,
  privateKeyJwk: JsonWebKey
): Promise<string> {
  // 1. Import RSA Private Key
  const rsaPrivKey = await window.crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['decrypt']
  );

  // 2. Decrypt the AES Key
  const encryptedAesKeyBuffer = base64ToArrayBuffer(payload.encryptedAesKey);
  const decryptedAesKeyRaw = await window.crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    rsaPrivKey,
    encryptedAesKeyBuffer
  );

  // 3. Import the decrypted AES Key
  const aesKey = await window.crypto.subtle.importKey(
    'raw',
    decryptedAesKeyRaw,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // 4. Decrypt the Image Data
  const encryptedImageBuffer = base64ToArrayBuffer(payload.encryptedData);
  const iv = base64ToArrayBuffer(payload.iv);
  
  const decryptedImageBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    aesKey,
    encryptedImageBuffer
  );

  // 5. Convert back to Blob URL securely in memory
  const blob = new Blob([decryptedImageBuffer], { type: 'image/jpeg' });
  return URL.createObjectURL(blob);
}

/**
 * Generates an RSA Keypair for demonstration purposes.
 * Returns JWK formatted keys so they can be easily stored as JSON.
 */
export async function generateDemoKeypair(): Promise<{ publicKey: JsonWebKey, privateKey: JsonWebKey }> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );

  const publicKey = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateKey = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);

  return { publicKey, privateKey };
}
