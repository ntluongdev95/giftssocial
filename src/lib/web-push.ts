// Web Push (RFC 8030 + RFC 8291 + RFC 8292) — minimal Workers-compatible
// implementation built on the Web Crypto API. The two npm packages people
// usually reach for (`web-push`, `web-push-node`) depend on Node's crypto
// module and DO NOT work in Cloudflare Workers — hence this vendor file.
//
// What this does:
//   1. Build a VAPID JWT (ES256) signed by the server's private key.
//   2. Derive a per-message AES-128-GCM key from ECDH(server, subscriber)
//      + HKDF(auth_secret) per RFC 8291.
//   3. Encrypt the payload, prepend the salt + record-size + server-pubkey
//      header, POST to the subscription endpoint.
//
// Most browsers (Chrome / Firefox / Edge / Safari 16+) speak `aes128gcm`.
// Older browsers used `aesgcm` — we don't support that here. If a payload
// fails delivery, the cron caller can mark the subscription stale and
// fall back to in-app notify.

import { Buffer } from 'node:buffer';

// ── Base64url helpers ────────────────────────────────────────────────────

const b64urlToBytes = (s: string): Uint8Array => {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const bytesToB64url = (bytes: Uint8Array | ArrayBuffer): string => {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.byteLength;
  }
  return out;
};

// TS lib.dom narrowed Uint8Array to be generic over its buffer kind in 5.7+.
// Web Crypto + fetch want Uint8Array<ArrayBuffer> specifically; our helpers
// thread bytes through generic Uint8Array, so cast at the boundary.
type WebCryptoBufferSource = BufferSource;
const asBuf = (u: Uint8Array): WebCryptoBufferSource => u as unknown as WebCryptoBufferSource;

const enc = new TextEncoder();

// ── HKDF (RFC 5869) using Web Crypto's HKDF algorithm ───────────────────

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey('raw', asBuf(ikm), 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: asBuf(salt), info: asBuf(info) } as HkdfParams,
    baseKey,
    length * 8,
  );
  return new Uint8Array(bits);
}

// ── VAPID JWT ────────────────────────────────────────────────────────────

export type VapidKeys = {
  /** Base64url-encoded ECDSA P-256 public key (uncompressed point, 65 bytes). */
  publicKey: string;
  /** Base64url-encoded ECDSA P-256 private key (32 bytes scalar `d`). */
  privateKey: string;
  /** Contact for push services — typically 'mailto:you@domain.com'. */
  subject: string;
};

async function importVapidPrivateKey(privateKeyB64: string, publicKeyB64: string): Promise<CryptoKey> {
  // Browsers + Workers want JWK for ECDSA private keys.
  const pub = b64urlToBytes(publicKeyB64); // 65 bytes: 0x04 || X(32) || Y(32)
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error('VAPID public key must be uncompressed P-256 (65 bytes, prefix 0x04)');
  }
  const x = bytesToB64url(pub.slice(1, 33));
  const y = bytesToB64url(pub.slice(33, 65));
  const d = privateKeyB64; // already base64url

  return crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x, y, d,
      ext: true,
      key_ops: ['sign'],
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

async function buildVapidJwt(
  audience: string,
  vapid: VapidKeys,
  ttlSeconds: number = 12 * 3600,
): Promise<string> {
  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = bytesToB64url(
    enc.encode(JSON.stringify({ aud: audience, exp, sub: vapid.subject })),
  );
  const signingInput = `${header}.${payload}`;
  const key = await importVapidPrivateKey(vapid.privateKey, vapid.publicKey);
  const sigDer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    enc.encode(signingInput),
  );
  // Web Crypto returns r||s already (IEEE P1363), which is what JWT wants.
  const sigB64 = bytesToB64url(sigDer);
  return `${signingInput}.${sigB64}`;
}

// ── Payload encryption (RFC 8291 aes128gcm) ──────────────────────────────

async function importSubscriberPublicKey(p256dhB64: string): Promise<CryptoKey> {
  const raw = b64urlToBytes(p256dhB64);
  return crypto.subtle.importKey(
    'raw',
    asBuf(raw),
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    [],
  );
}

async function exportRawPublicKey(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey('raw', key));
}

async function encryptPayload(
  payload: Uint8Array,
  subscriberPubB64: string,
  authSecretB64: string,
): Promise<{ body: Uint8Array }> {
  // 1. Generate ephemeral ECDH P-256 key pair on the server.
  const ephemeral = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  );

  // 2. Derive shared secret with subscriber's public key.
  const subscriberPub = await importSubscriberPublicKey(subscriberPubB64);
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: subscriberPub },
      ephemeral.privateKey,
      256,
    ),
  );

  const auth = b64urlToBytes(authSecretB64);
  const ephemeralPubRaw = await exportRawPublicKey(ephemeral.publicKey);
  const subscriberPubRaw = b64urlToBytes(subscriberPubB64);

  // 3. RFC 8291: PRK_key = HKDF(salt=auth, ikm=shared,
  //                              info="WebPush: info\0" || ua_pub || as_pub, 32)
  const keyInfo = concat(
    enc.encode('WebPush: info\0'),
    subscriberPubRaw,
    ephemeralPubRaw,
  );
  const ikm = await hkdf(auth, shared, keyInfo, 32);

  // 4. 16-byte random salt for the content-encoding layer.
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 5. Derive CEK + nonce from IKM + salt.
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  // 6. AES-128-GCM. Payload must be padded by RFC 8188: append 0x02 + zeros.
  const padded = concat(payload, new Uint8Array([0x02]));
  const aesKey = await crypto.subtle.importKey('raw', asBuf(cek), { name: 'AES-GCM' }, false, ['encrypt']);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: asBuf(nonce) }, aesKey, asBuf(padded)),
  );

  // 7. aes128gcm header: salt(16) || rs(4 BE) || idlen(1) || keyid(idlen).
  // For Web Push, keyid is the ephemeral server pubkey (65 bytes raw).
  const recordSize = new Uint8Array(4);
  // rs = padded.length + 16 (GCM tag) — must be >= rs; we set rs = 4096 fixed.
  new DataView(recordSize.buffer).setUint32(0, 4096, false);
  const header = concat(
    salt,
    recordSize,
    new Uint8Array([ephemeralPubRaw.length]),
    ephemeralPubRaw,
  );

  return { body: concat(header, cipher) };
}

// ── Public API ───────────────────────────────────────────────────────────

export type WebPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type WebPushResult =
  | { ok: true; status: number }
  | { ok: false; status: number; expired?: boolean; error?: string };

/** Send a Web Push notification. Returns { expired: true } if the push
 *  service says the subscription is gone (HTTP 404/410) — callers should
 *  delete it from `push_subscriptions`. */
export async function sendWebPush(
  subscription: WebPushSubscription,
  payload: Record<string, unknown> | string,
  vapid: VapidKeys,
  ttlSeconds: number = 60,
): Promise<WebPushResult> {
  try {
    const audience = new URL(subscription.endpoint).origin;
    const jwt = await buildVapidJwt(audience, vapid);
    const payloadBytes = enc.encode(
      typeof payload === 'string' ? payload : JSON.stringify(payload),
    );
    const { body } = await encryptPayload(payloadBytes, subscription.p256dh, subscription.auth);

    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(ttlSeconds),
        Urgency: 'normal',
      },
      body: asBuf(body) as BodyInit,
    });
    if (res.status === 404 || res.status === 410) {
      return { ok: false, status: res.status, expired: true };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: text.slice(0, 200) };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Read VAPID keys from env. Throws if either is missing — callers should
 *  catch and fall back to in-app notify only. */
export function getVapidKeysFromEnv(env: Record<string, unknown>): VapidKeys | null {
  const publicKey = (env.VAPID_PUBLIC_KEY as string | undefined)?.trim();
  const privateKey = (env.VAPID_PRIVATE_KEY as string | undefined)?.trim();
  const subject = ((env.VAPID_SUBJECT as string | undefined)?.trim()) || 'mailto:noreply@gao.social';
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}
