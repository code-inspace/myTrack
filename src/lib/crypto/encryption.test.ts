import { describe, it, expect } from "vitest";
import { encryptText, decryptText, isEncrypted } from "./encryption";

describe("Encryption Module (AES-256-GCM Envelope Encryption)", () => {
  it("encrypts and decrypts strings accurately", async () => {
    const original = "Faire 50 pompes et réviser mon cours d'anglais 🚀";
    const encrypted = await encryptText(original);

    expect(encrypted).not.toBe(original);
    expect(isEncrypted(encrypted)).toBe(true);
    expect(encrypted.startsWith("enc:v1:")).toBe(true);

    const decrypted = await decryptText(encrypted);
    expect(decrypted).toBe(original);
  });

  it("handles multi-line and special UTF-8 characters", async () => {
    const specialText = `Ligne 1: Accentuation é, è, à, ç, œ, €\nLigne 2: Emoji 🔥 🧘 🎯 🏋️\nLigne 3: Quotes " ' \` <script>alert(1)</script>`;
    const encrypted = await encryptText(specialText);
    const decrypted = await decryptText(encrypted);

    expect(decrypted).toBe(specialText);
  });

  it("is idempotent on encrypting already encrypted strings", async () => {
    const original = "Tâche confidentielle";
    const encryptedOnce = await encryptText(original);
    const encryptedTwice = await encryptText(encryptedOnce);

    expect(encryptedTwice).toBe(encryptedOnce);
    const decrypted = await decryptText(encryptedTwice);
    expect(decrypted).toBe(original);
  });

  it("handles backward compatibility for legacy non-encrypted plain text", async () => {
    const legacyPlainText = "Ancienne tâche créée avant le chiffrement";
    expect(isEncrypted(legacyPlainText)).toBe(false);

    const result = await decryptText(legacyPlainText);
    expect(result).toBe(legacyPlainText);
  });

  it("supports custom keys for multi-user project sharing", async () => {
    const projectSecretKey = "project_secret_key_abc_123";
    const content = "Plan stratégique du projet partagé";

    const encryptedWithProjectKey = await encryptText(content, projectSecretKey);
    const decryptedWithProjectKey = await decryptText(encryptedWithProjectKey, projectSecretKey);

    expect(decryptedWithProjectKey).toBe(content);

    // Decrypting with wrong key fails gracefully and returns ciphertext safely
    const wrongKeyDecryption = await decryptText(encryptedWithProjectKey, "wrong_key_xyz");
    expect(wrongKeyDecryption).toBe(encryptedWithProjectKey);
  });

  it("safely handles null and undefined inputs", async () => {
    expect(await encryptText(null)).toBe("");
    expect(await encryptText(undefined)).toBe("");
    expect(await decryptText(null)).toBe("");
    expect(await decryptText(undefined)).toBe("");
  });
});
