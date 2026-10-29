# Kiss Chain — Phase 1

Each "Kiss" is an NFT (NEP-171). Minting one locks NEAR inside it and
starts a countdown; the receiver reciprocates before the deadline (the
kiss "blooms") and claims the locked funds, or the deadline passes and
it "wilts" — the original sender reclaims their NEAR instead.

## What's built (Phase 1 — core)

- `mint_kiss(receiver_id, message, expires_in_hours)` — payable, mints an NFT to the receiver, locks the attached NEAR
- `reciprocate(token_id)` — receiver-only, before the deadline, Pending → Bloomed
- `claim(token_id)` — receiver-only, withdraws the locked NEAR once bloomed
- `reclaim_if_wilted(token_id)` — sender-only, after the deadline, gets their NEAR back
- `get_kiss(token_id)` / `get_kiss_token(token_id)` — view functions for the frontend
- Full NEP-171 (core transfer/approval/enumeration) via `near-contract-standards`

Not built yet (later phases, see the plan from the chat): `relay()`
(multi-level forwarding), NEP-199 royalty payouts, the reward tree.

## Verified so far

- `cargo build --release --target wasm32-unknown-unknown` — compiles clean to a 281KB `.wasm`
- `cargo test` — 6 unit tests passing, covering: funds actually lock on mint, reciprocate+claim moves the right amount, the sender can't reciprocate their own kiss, reciprocating past the deadline wilts instead of blooming, the sender can reclaim a wilted kiss's funds, and a still-pending kiss can't be claimed

Not yet done: an actual testnet deploy + a real transaction from a real
wallet. Everything above has only run in-process via `near-sdk`'s test
harness, not against a live NEAR node.

## Local setup notes (this machine)

- Needed `rustup update stable` — the system Rust (1.78.0) was too old for a transitive dependency requiring Rust 2024 edition support
- Needed Xcode Command Line Tools installed (`xcode-select --install`) for the native linker
- `rustup target add wasm32-unknown-unknown` for the actual contract target

## Next steps to deploy on testnet

1. Install NEAR CLI: `npm install -g near-cli-rs` (or follow near.org's current install instructions — this wasn't set up in this session)
2. Create/fund a testnet account at <https://near-wallet.testnet> or via `near account create-account`
3. Deploy: `near contract deploy <your-account>.testnet use-file target/wasm32-unknown-unknown/release/kiss_chain.wasm with-init-call new json-args '{"owner_id": "<your-account>.testnet"}' network-config testnet sign-with-keychain send`
4. Try a real mint from the CLI before wiring up any frontend:
   `near contract call-function as-transaction <your-account>.testnet mint_kiss json-args '{"receiver_id": "<other-account>.testnet", "message": "hi", "expires_in_hours": 48}' prepaid-gas '30 TGas' attached-deposit '1 NEAR' sign-as <your-account>.testnet network-config testnet sign-with-keychain send`

## Known tech debt

`impl_non_fungible_token_core!` / `_approval!` / `_enumeration!` are
deprecated in `near-contract-standards` 5.30 in favor of implementing
those traits by hand. They still compile and work (all tests pass) —
left as-is for Phase 1 speed. Worth revisiting if there's time before
the deadline, since a judge who reads the code will see the deprecation
warnings.
