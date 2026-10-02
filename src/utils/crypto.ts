/**
 * Secure E2EE Cryptography Utilities
 * Uses Web Crypto API for Hybrid Encryption (AES-GCM + RSA-OAEP).
 */

export interface EncryptedPayload {
  wrappedKeys: { officerEmail: string; wrappedKey: string }[];
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
  publicKeys: { email: string; publicKeyJwk: JsonWebKey }[]
): Promise<any> {
  const aesKey = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const imageBuffer = await blob.arrayBuffer();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedImageBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    imageBuffer
  );

  const exportedAesKey = await window.crypto.subtle.exportKey('raw', aesKey);
  const wrappedKeys = [];
  
  for (const officer of publicKeys) {
    if (!officer.publicKeyJwk) continue;
    try {
      const rsaPubKey = await window.crypto.subtle.importKey(
        'jwk',
        officer.publicKeyJwk,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        ['encrypt']
      );
      const encryptedAesKeyBuffer = await window.crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        rsaPubKey,
        exportedAesKey
      );
      wrappedKeys.push({
        officerEmail: officer.email,
        wrappedKey: arrayBufferToBase64(encryptedAesKeyBuffer)
      });
    } catch (e) {
      console.error('Failed to wrap key for', officer.email);
    }
  }

  return {
    wrappedKeys,
    iv: arrayBufferToBase64(iv.buffer),
    encryptedData: arrayBufferToBase64(encryptedImageBuffer)
  };
}

/**
 * Decrypts an EncryptedPayload back into a Blob URL for safe viewing.
 * 1. Finds the wrappedKey matching the logged-in officer's email.
 * 2. Decrypts AES key using RSA Private Key.
 * 3. Decrypts Image Data using AES key.
 */
export async function decryptImagePayload(
  payload: EncryptedPayload,
  privateKeyJwk: JsonWebKey,
  officerEmail: string
): Promise<string> {
  // 1. Import RSA Private Key
  const rsaPrivKey = await window.crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['decrypt']
  );

  // 2. Find the wrappedKey for this officer
  let wrappedKeyStr: string | undefined;
  
  if (payload.wrappedKeys && payload.wrappedKeys.length > 0) {
    // Try exact email match first
    const match = payload.wrappedKeys.find(wk => wk.officerEmail === officerEmail);
    if (match) {
      wrappedKeyStr = match.wrappedKey;
    } else {
      // No match for this officer — do NOT silently fall back to another officer's key
      const availableEmails = payload.wrappedKeys.map(wk => wk.officerEmail).join(', ');
      throw new Error(
        `No decryption key found for officer "${officerEmail}". ` +
        `This evidence was encrypted for: [${availableEmails}]. ` +
        `Request a case transfer to gain access.`
      );
    }
  } else if ((payload as any).encryptedAesKey) {
    // Legacy single-key format (pre-multi-officer)
    wrappedKeyStr = (payload as any).encryptedAesKey;
  }
    
  if (!wrappedKeyStr) throw new Error('No wrapped key found in payload');

  const encryptedAesKeyBuffer = base64ToArrayBuffer(wrappedKeyStr);
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

import { get, set } from 'idb-keyval';

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

export async function getOrCreateOfficerKeys(): Promise<{ publicKey: JsonWebKey, privateKey: JsonWebKey }> {
  let keys = await get('officer_keys');
  if (!keys) {
    keys = await generateDemoKeypair();
    await set('officer_keys', keys);
  }
  return keys;
}
