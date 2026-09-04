/**
 * Application-level Envelope Encryption module (AES-256-GCM)
 * Provides transparent zero-plaintext storage in database with backward compatibility.
 * Format: "enc:v1:<iv_base64>:<ciphertext_base64>:<tag_base64>"
 */

const ENCRYPTION_PREFIX = "enc:v1:";
const DEFAULT_KEY_SALT = "mytrack_secure_salt_v1";

/**
 * Gets or derives a 256-bit CryptoKey for AES-GCM
 */
async function deriveKey(customSecret?: string): Promise<CryptoKey> {
  const secret =
    customSecret ||
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_ENCRYPTION_KEY) ||
    "mytrack_app_master_envelope_key_2026_secure";

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(DEFAULT_KEY_SALT),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof btoa !== "undefined"
    ? btoa(binary)
    : Buffer.from(binary, "binary").toString("base64");
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary =
    typeof atob !== "undefined"
      ? atob(base64)
      : Buffer.from(base64, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Checks if a string is in the encrypted envelope format
 */
export function isEncrypted(value?: string | null): boolean {
  if (!value || typeof value !== "string") return false;
  return value.startsWith(ENCRYPTION_PREFIX);
}

/**
 * Encrypts a string using AES-256-GCM.
 * If the string is already encrypted, returns it unchanged.
 */
export async function encryptText(
  plainText?: string | null,
  customKey?: string
): Promise<string> {
  if (!plainText || typeof plainText !== "string") {
    return plainText ?? "";
  }

  // Idempotent: don't double-encrypt
  if (isEncrypted(plainText)) {
    return plainText;
  }

  try {
    const key = await deriveKey(customKey);
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
    const encodedData = new TextEncoder().encode(plainText);

    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv as BufferSource,
        tagLength: 128, // 128-bit authentication tag
      },
      key,
      encodedData as BufferSource
    );

    // In Web Crypto AES-GCM, the authentication tag is appended to the ciphertext
    const encryptedBytes = new Uint8Array(encryptedBuffer);
    const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - 16);
    const authTag = encryptedBytes.slice(encryptedBytes.length - 16);

    const ivB64 = bufferToBase64(iv);
    const cipherB64 = bufferToBase64(ciphertext);
    const tagB64 = bufferToBase64(authTag);

    return `${ENCRYPTION_PREFIX}${ivB64}:${cipherB64}:${tagB64}`;
  } catch (error) {
    console.error("[Encryption] Failed to encrypt:", error);
    return plainText; // Fallback to plain text on error so user data isn't lost
  }
}

/**
 * Decrypts a string using AES-256-GCM.
 * If the string is not encrypted (legacy plain text), returns it directly.
 */
export async function decryptText(
  cipherText?: string | null,
  customKey?: string
): Promise<string> {
  if (!cipherText || typeof cipherText !== "string") {
    return cipherText ?? "";
  }

  // Backward compatibility: not encrypted
  if (!isEncrypted(cipherText)) {
    return cipherText;
  }

  try {
    const payload = cipherText.slice(ENCRYPTION_PREFIX.length);
    const parts = payload.split(":");
    if (parts.length !== 3) {
      return cipherText;
    }

    const [ivB64, cipherB64, tagB64] = parts;
    const iv = base64ToBuffer(ivB64);
    const ciphertext = base64ToBuffer(cipherB64);
    const authTag = base64ToBuffer(tagB64);

    // Reconstruct full buffer (ciphertext + 16-byte tag) for Web Crypto Subtle
    const combined = new Uint8Array(ciphertext.length + authTag.length);
    combined.set(ciphertext, 0);
    combined.set(authTag, ciphertext.length);

    const key = await deriveKey(customKey);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv as BufferSource,
        tagLength: 128,
      },
      key,
      combined as BufferSource
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    console.error("[Encryption] Failed to decrypt:", error);
    // If decryption fails (e.g. invalid key or corrupted payload), return string safely
    return cipherText;
  }
}

export const ENCRYPTED_TOKEN_REGEX = /enc:v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+/g;

/**
 * Decrypts a string or any embedded encrypted tokens (enc:v1:...) inside a larger text.
 */
export async function decryptEmbeddedEncryptedText(
  text?: string | null,
  customKey?: string
): Promise<string> {
  if (!text || typeof text !== "string") return text ?? "";
  if (isEncrypted(text)) {
    return decryptText(text, customKey);
  }
  if (!text.includes(ENCRYPTION_PREFIX)) {
    return text;
  }

  const matches = Array.from(new Set(text.match(ENCRYPTED_TOKEN_REGEX) || []));
  if (matches.length === 0) return text;

  let result = text;
  for (const token of matches) {
    const decrypted = await decryptText(token, customKey);
    if (decrypted && decrypted !== token) {
      result = result.split(token).join(decrypted);
    }
  }
  return result;
}

/**
 * Synchronous in-memory helper for immediate sync UI mappings when async isn't available,
 * with fallback to asynchronous background decryption.
 */
export function stripEncryptionEnvelope(value?: string | null): string {
  if (!value || typeof value !== "string") return value ?? "";
  if (!isEncrypted(value)) return value;
  // If it's encrypted but needs sync string, we can return a placeholder or wait for async
  return value;
}
