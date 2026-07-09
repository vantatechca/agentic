import { env } from "@/env";

/**
 * Stateless signed-session tokens using Web Crypto HMAC-SHA-256, so the exact
 * same verify path works in Next middleware (edge runtime) and in Node route
 * handlers / server components. Token = base64url(payload).base64url(sig).
 *
 * Payload: { uid, role, exp }. No secrets in the payload; it's signed, not
 * encrypted, so treat it as tamper-evident but readable.
 */
export const SESSION_COOKIE = "agentic_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

export type SessionPayload = { uid: number; role: "admin" | "agent"; exp: number };

function secretKeyMaterial(): string {
  return env.SESSION_SECRET || env.ADMIN_API_TOKEN || "insecure-dev-secret";
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Coerce a view to a standalone ArrayBuffer for Web Crypto (BufferSource). */
function ab(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
}

async function importKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    ab(new TextEncoder().encode(secretKeyMaterial())),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signSession(
  uid: number,
  role: "admin" | "agent",
  now: number = Date.now(),
): Promise<string> {
  const payload: SessionPayload = { uid, role, exp: Math.floor(now / 1000) + MAX_AGE_SEC };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const key = await importKey();
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, ab(payloadBytes)));
  return `${b64urlEncode(payloadBytes)}.${b64urlEncode(sig)}`;
}

export async function verifySession(
  token: string | undefined,
  now: number = Date.now(),
): Promise<SessionPayload | null> {
  if (!token) return null;
  const [p, s] = token.split(".");
  if (!p || !s) return null;
  try {
    const payloadBytes = b64urlDecode(p);
    const sig = b64urlDecode(s);
    const key = await importKey();
    const ok = await crypto.subtle.verify("HMAC", key, ab(sig), ab(payloadBytes));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as SessionPayload;
    if (!payload.exp || payload.exp * 1000 < now) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = MAX_AGE_SEC;
