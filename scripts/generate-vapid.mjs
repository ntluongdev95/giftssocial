#!/usr/bin/env node
// One-time VAPID keypair generator. Run once, paste the output into
// .env.local (and Cloudflare env for prod). Keys are P-256 ECDSA in
// base64url format — exactly what RFC 8292 + Web Push expect.
//
// Usage:
//   node scripts/generate-vapid.mjs
//
// Or:
//   npm run vapid:gen   (if you add it to package.json scripts)

import { webcrypto } from 'node:crypto';

const b64url = (buf) =>
  Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const { publicKey, privateKey } = await webcrypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify'],
);

const pubRaw = await webcrypto.subtle.exportKey('raw', publicKey);
const privJwk = await webcrypto.subtle.exportKey('jwk', privateKey);

console.log('# Add these to .env.local (and your prod env / wrangler secrets):');
console.log(`VAPID_PUBLIC_KEY=${b64url(pubRaw)}`);
console.log(`VAPID_PRIVATE_KEY=${privJwk.d}`);
console.log(`VAPID_SUBJECT=mailto:you@gao.social`);
