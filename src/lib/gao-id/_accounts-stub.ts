/**
 * Stub for `@wagmi/core/tempo`'s optional `import('accounts')`.
 *
 * wagmi v3 ships an experimental "tempo" connector framework whose
 * non-EVM (Solana/Sui/…) account adapter is loaded via dynamic
 * `import('accounts')`. The package isn't published; it's expected to
 * be aliased by integrators that opt into tempo. Gao ID is EVM-only
 * via SIWE, so we never call the tempo getAccountsModule() path —
 * but Turbopack still has to resolve the literal string at build
 * time, which fails without an alias.
 *
 * `next.config.ts` aliases the bare specifier `accounts` to this file
 * so the build resolves; the throw guarantees that any accidental
 * runtime call (none today) surfaces clearly instead of silently
 * succeeding with a broken adapter.
 */

export const Provider = {
  create(): never {
    throw new Error('gao-id: tempo `accounts` is not implemented (EVM-only via SIWE)');
  },
};

const accountsStub = { Provider };
export default accountsStub;
