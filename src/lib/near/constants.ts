// Plain constants, safe to import from both client ('use client') and
// server-only (API route) code — kept separate from wallet.ts so a
// server module never has to pull in a 'use client' file just to read
// a contract id string.

export const CONTRACT_ID = 'kiss-chain-demo-2026.testnet';
export const NETWORK = 'testnet' as const;
