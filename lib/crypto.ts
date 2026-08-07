/**
 * Field-level encryption for bank details (S1-1): encrypted at rest, masked
 * in all list views. AES-256-GCM with the key derived from SESSION_SECRET's
 * sibling env var; rotate by re-encrypting.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

function key(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET must be set for encryption.");
  return createHash("sha256").update(`field-encryption:${secret}`).digest();
}

export function encryptField(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptField(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/** Mask for list views: last 4 characters visible, rest hidden. */
export function maskBankDetails(iban: string): string {
  if (iban.length <= 4) return "••••";
  return `••••${iban.slice(-4)}`;
}
