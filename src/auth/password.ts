import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Password hashing with Node's built-in scrypt (no external dependency).
 * Stored form: "<saltHex>:<hashHex>". Verification is constant-time.
 * Used only in Node route handlers (login / create-user), never on the edge.
 */
const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}
