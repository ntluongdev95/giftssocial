// Kiss Chain.
//
// Each "Kiss" IS an NFT (NEP-171), not a separate thing attached to one.
// Minting a kiss creates one token, owned by the receiver, with NEAR
// tokens locked inside it and a deadline. The receiver can reciprocate
// before the deadline (the kiss "blooms") and then claim the locked
// funds; if the deadline passes unreciprocated, the kiss "wilts" and
// the sender can reclaim their funds.
//
// Phase 3 — relay + royalty: once a kiss blooms, its owner can `relay`
// it onward to up to MAX_RELAY_SLOTS new people, each becoming a child
// kiss (its own NFT, its own locked funds, its own deadline). A slice
// of every relay's attached deposit (ROYALTY_BPS) is set aside as
// royalty; when THAT child later blooms, the royalty pays straight to
// the root of the whole tree — not walked hop-by-hop up an arbitrary-
// depth ancestor chain (unbounded on-chain loops are a real gas-safety
// hazard), but O(1): `root_sender_id` is copied down from parent to
// child once, at relay time, so paying it is a single direct transfer
// regardless of how deep the tree has grown.

use near_contract_standards::non_fungible_token::metadata::{
    NFTContractMetadata, NonFungibleTokenMetadataProvider, TokenMetadata, NFT_METADATA_SPEC,
};
use near_contract_standards::non_fungible_token::{NonFungibleToken, Token, TokenId};
use near_sdk::collections::LazyOption;
use near_sdk::{
    env, near, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault, Promise,
    PromiseOrValue,
};
use near_sdk::borsh::BorshSerialize;

// 5% of every relay's attached deposit is set aside as royalty for the
// tree's root; the other 95% is the new child's own locked_amount.
const ROYALTY_BPS: u128 = 500;
// How many times a single bloomed kiss can be relayed onward. Capped
// so the tree can't fan out unboundedly from one node — depth grows
// through repeated relaying instead, which is the "lan tỏa" (spread)
// the whole design is for.
const MAX_RELAY_SLOTS: u8 = 3;

// ── Kiss-specific state ─────────────────────────────────────────────

// `serializers = [borsh, json]` — borsh is how this is stored on-chain
// (inside kiss_data), json is how it's shaped when a view function
// hands it back to a frontend. near-sdk 5's `#[near]` macro generates
// both from one derive instead of the old manual
// BorshSerialize/BorshDeserialize + separate serde derive dance.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum KissStatus {
    Pending,
    Bloomed,
    Wilted,
}

// Everything NEP-171's `Token` doesn't already track for us. Kept in a
// side map keyed by the same TokenId, rather than folded into the NFT
// metadata blob, so reading/updating a kiss's state doesn't require
// re-serializing its (user-facing) title/description/media each time.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct KissInfo {
    pub sender_id: AccountId,
    pub status: KissStatus,
    // What the receiver can `claim` once bloomed — this is the
    // deposit minus the royalty slice (see `royalty_amount`), not the
    // full attached amount, for any kiss created via `relay`. A root
    // kiss (minted via `mint_kiss`) has no royalty taken, so for those
    // locked_amount == the full attached deposit.
    pub locked_amount: NearToken,
    // The royalty slice set aside at relay time (0 for root kisses —
    // nothing to pay a root of, since they ARE the root). Paid to
    // `root_sender_id` the moment THIS kiss blooms; refunded to this
    // kiss's own sender instead if it wilts unreciprocated.
    pub royalty_amount: NearToken,
    // Nanosecond block timestamp (env::block_timestamp()) after which
    // an un-reciprocated kiss can be wilted + reclaimed by the sender.
    pub expires_at: u64,
    pub parent_token_id: Option<TokenId>,
    // Copied down from parent to child at relay time (or set to this
    // kiss's own sender if it has no parent) — who gets royalty from
    // every bloom anywhere in this tree, without needing to walk back
    // up a parent chain of unknown length to find out.
    pub root_sender_id: AccountId,
    pub depth: u32,
    // "Inventory": how many more times THIS specific kiss can still be
    // relayed onward. Starts at MAX_RELAY_SLOTS, decrements by 1 each
    // time its owner calls `relay`, floors at 0.
    pub relay_slots_remaining: u8,
}

#[derive(BorshSerialize, BorshStorageKey)]
#[borsh(crate = "near_sdk::borsh")]
enum StorageKey {
    NonFungibleToken,
    Metadata,
    TokenMetadata,
    Enumeration,
    Approval,
    KissData,
}

// ── Contract ─────────────────────────────────────────────────────────

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    tokens: NonFungibleToken,
    metadata: LazyOption<NFTContractMetadata>,
    kiss_data: near_sdk::collections::LookupMap<TokenId, KissInfo>,
    next_id: u64,
}

#[near]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId) -> Self {
        require!(!env::state_exists(), "Already initialized");
        let metadata = NFTContractMetadata {
            spec: NFT_METADATA_SPEC.to_string(),
            name: "Kiss Chain".to_string(),
            symbol: "KISS".to_string(),
            icon: None,
            base_uri: None,
            reference: None,
            reference_hash: None,
        };
        Self {
            tokens: NonFungibleToken::new(
                StorageKey::NonFungibleToken,
                owner_id,
                Some(StorageKey::TokenMetadata),
                Some(StorageKey::Enumeration),
                Some(StorageKey::Approval),
            ),
            metadata: LazyOption::new(StorageKey::Metadata, Some(&metadata)),
            kiss_data: near_sdk::collections::LookupMap::new(StorageKey::KissData),
            next_id: 0,
        }
    }

    /// Mint a kiss to `receiver_id`. Any attached NEAR is locked inside
    /// the token until the receiver reciprocates and claims it, or the
    /// deadline passes and the sender reclaims it. `message` becomes
    /// the NFT's on-chain description (kept short — this is metadata,
    /// not a database row).
    #[payable]
    pub fn mint_kiss(
        &mut self,
        receiver_id: AccountId,
        message: String,
        expires_in_hours: u32,
    ) -> TokenId {
        require!(expires_in_hours > 0 && expires_in_hours <= 24 * 14, "expires_in_hours must be 1..=336 (14 days)");
        require!(message.len() <= 500, "message too long (max 500 chars)");

        let sender_id = env::predecessor_account_id();
        let locked_amount = env::attached_deposit();

        let token_id: TokenId = {
            let id = self.next_id;
            self.next_id += 1;
            format!("kiss-{}", id)
        };

        let token_metadata = TokenMetadata {
            title: Some(format!("Kiss from {}", sender_id)),
            description: Some(message),
            media: None,
            media_hash: None,
            copies: Some(1),
            issued_at: Some(env::block_timestamp().to_string()),
            expires_at: None,
            starts_at: None,
            updated_at: None,
            extra: None,
            reference: None,
            reference_hash: None,
        };

        self.tokens
            .internal_mint(token_id.clone(), receiver_id, Some(token_metadata));

        let expires_at = env::block_timestamp() + (expires_in_hours as u64) * 60 * 60 * 1_000_000_000;
        self.kiss_data.insert(
            &token_id,
            &KissInfo {
                sender_id: sender_id.clone(),
                status: KissStatus::Pending,
                locked_amount,
                royalty_amount: NearToken::from_yoctonear(0),
                expires_at,
                parent_token_id: None,
                root_sender_id: sender_id,
                depth: 0,
                relay_slots_remaining: MAX_RELAY_SLOTS,
            },
        );

        token_id
    }

    /// Escrow a money-carrying gift from the Gao Social app, BEFORE the
    /// receiver has any NEAR account of their own. Keyed by the app's
    /// own `gao_kiss_id` (not an auto-incrementing TokenId like
    /// `mint_kiss`/`relay` use) so the app can look the gift back up by
    /// an ID it already generated. No NFT owner exists yet — the token
    /// is minted to the CONTRACT'S OWN account as a placeholder until
    /// `claim_gift` hands it to whoever actually claims it. This is the
    /// "lazy mint" half of the app-integrated flow: minting the real,
    /// owned NFT only happens at claim time, not at send time, so a
    /// gift with no wallet-less receiver yet doesn't need one to exist
    /// in order to be sent.
    #[payable]
    pub fn lock_gift(&mut self, gao_kiss_id: String, expires_in_hours: u32) -> TokenId {
        require!(expires_in_hours > 0 && expires_in_hours <= 24 * 14, "expires_in_hours must be 1..=336 (14 days)");
        require!(!gao_kiss_id.is_empty() && gao_kiss_id.len() <= 64, "gao_kiss_id must be 1..=64 chars");
        let locked_amount = env::attached_deposit();
        require!(locked_amount.as_yoctonear() > 0, "Must attach NEAR to lock a gift");

        let token_id: TokenId = format!("gift-{}", gao_kiss_id);
        require!(self.kiss_data.get(&token_id).is_none(), "A gift was already locked for this gao_kiss_id");

        let sender_id = env::predecessor_account_id();

        let token_metadata = TokenMetadata {
            title: Some(format!("Kiss gift from {}", sender_id)),
            description: None,
            media: None,
            media_hash: None,
            copies: Some(1),
            issued_at: Some(env::block_timestamp().to_string()),
            expires_at: None,
            starts_at: None,
            updated_at: None,
            extra: None,
            reference: None,
            reference_hash: None,
        };

        // Placeholder owner: the contract itself. `claim_gift` transfers
        // real ownership once someone actually claims it.
        self.tokens
            .internal_mint(token_id.clone(), env::current_account_id(), Some(token_metadata));

        let expires_at = env::block_timestamp() + (expires_in_hours as u64) * 60 * 60 * 1_000_000_000;
        self.kiss_data.insert(
            &token_id,
            &KissInfo {
                sender_id: sender_id.clone(),
                status: KissStatus::Pending,
                locked_amount,
                royalty_amount: NearToken::from_yoctonear(0),
                expires_at,
                parent_token_id: None,
                root_sender_id: sender_id,
                depth: 0,
                relay_slots_remaining: MAX_RELAY_SLOTS,
            },
        );

        token_id
    }

    /// The real receiver, now that they have a NEAR account (created via
    /// NEAR Auth/passkey right before this call), claims a gift locked
    /// by `lock_gift`. Mints real ownership to the caller, marks the
    /// kiss Bloomed directly (claiming a gift from a named receiver IS
    /// the reciprocation — there's no separate "accept" step in this
    /// flow the way there is for the standalone mint_kiss/relay path),
    /// and pays out the locked NEAR in the same call. First caller
    /// wins: once claimed, status is no longer Pending and a second
    /// claim attempt is rejected.
    pub fn claim_gift(&mut self, gao_kiss_id: String) -> Promise {
        let token_id: TokenId = format!("gift-{}", gao_kiss_id);
        let mut info = self.kiss_data.get(&token_id).expect("Gift not found");
        require!(info.status == KissStatus::Pending, "This gift was already claimed or has wilted");
        require!(env::block_timestamp() <= info.expires_at, "This gift's claim window closed");

        let receiver_id = env::predecessor_account_id();
        self.tokens.internal_transfer_unguarded(&token_id, &env::current_account_id(), &receiver_id);

        info.status = KissStatus::Bloomed;
        let amount = info.locked_amount;
        info.locked_amount = NearToken::from_yoctonear(0);
        self.kiss_data.insert(&token_id, &info);

        Promise::new(receiver_id).transfer(amount)
    }

    /// The owner of a BLOOMED kiss relays it onward to someone new —
    /// a fresh child NFT, its own locked funds, its own deadline.
    /// `ROYALTY_BPS` of the attached deposit is set aside and paid to
    /// the tree's root the moment this new kiss blooms (see
    /// `reciprocate`); the rest becomes the child's own locked_amount.
    /// Fails once the parent's `relay_slots_remaining` hits 0.
    #[payable]
    pub fn relay(
        &mut self,
        token_id: TokenId,
        receiver_id: AccountId,
        message: String,
        expires_in_hours: u32,
    ) -> TokenId {
        require!(expires_in_hours > 0 && expires_in_hours <= 24 * 14, "expires_in_hours must be 1..=336 (14 days)");
        require!(message.len() <= 500, "message too long (max 500 chars)");

        let owner_id = self.tokens.owner_by_id.get(&token_id).expect("Kiss not found");
        require!(
            env::predecessor_account_id() == owner_id,
            "Only the kiss's current owner can relay it"
        );

        let mut parent = self.kiss_data.get(&token_id).expect("Kiss not found");
        require!(parent.status == KissStatus::Bloomed, "Can only relay a kiss that has bloomed");
        require!(parent.relay_slots_remaining > 0, "This kiss has no relay slots left");

        parent.relay_slots_remaining -= 1;
        self.kiss_data.insert(&token_id, &parent);

        let sender_id = env::predecessor_account_id();
        let deposit = env::attached_deposit();
        let royalty_amount =
            NearToken::from_yoctonear(deposit.as_yoctonear() * ROYALTY_BPS / 10_000);
        let locked_amount =
            NearToken::from_yoctonear(deposit.as_yoctonear() - royalty_amount.as_yoctonear());

        let new_token_id: TokenId = {
            let id = self.next_id;
            self.next_id += 1;
            format!("kiss-{}", id)
        };

        let token_metadata = TokenMetadata {
            title: Some(format!("Kiss relayed from {}", sender_id)),
            description: Some(message),
            media: None,
            media_hash: None,
            copies: Some(1),
            issued_at: Some(env::block_timestamp().to_string()),
            expires_at: None,
            starts_at: None,
            updated_at: None,
            extra: None,
            reference: None,
            reference_hash: None,
        };

        self.tokens
            .internal_mint(new_token_id.clone(), receiver_id, Some(token_metadata));

        let expires_at = env::block_timestamp() + (expires_in_hours as u64) * 60 * 60 * 1_000_000_000;
        self.kiss_data.insert(
            &new_token_id,
            &KissInfo {
                sender_id,
                status: KissStatus::Pending,
                locked_amount,
                royalty_amount,
                expires_at,
                parent_token_id: Some(token_id),
                root_sender_id: parent.root_sender_id,
                depth: parent.depth + 1,
                relay_slots_remaining: MAX_RELAY_SLOTS,
            },
        );

        new_token_id
    }

    /// The receiver accepts the kiss before its deadline. This flips
    /// Pending -> Bloomed and, if this kiss came from a `relay` (so it
    /// has a royalty slice set aside), pays that straight to the
    /// tree's root in the same call. Call `claim` afterward to
    /// withdraw the locked NEAR — kept separate so "we both feel this"
    /// is its own visible on-chain event, not folded into money moving.
    pub fn reciprocate(&mut self, token_id: TokenId) {
        let owner_id = self.tokens.owner_by_id.get(&token_id).expect("Kiss not found");
        require!(
            env::predecessor_account_id() == owner_id,
            "Only the kiss's current owner can reciprocate"
        );

        let mut info = self.kiss_data.get(&token_id).expect("Kiss not found");
        require!(info.status == KissStatus::Pending, "This kiss already bloomed or wilted");

        if env::block_timestamp() > info.expires_at {
            info.status = KissStatus::Wilted;
            self.kiss_data.insert(&token_id, &info);
            env::panic_str("This kiss's window closed — it wilted. Call reclaim_if_wilted (sender only).");
        }

        info.status = KissStatus::Bloomed;
        let royalty_amount = info.royalty_amount;
        info.royalty_amount = NearToken::from_yoctonear(0);
        let root_sender_id = info.root_sender_id.clone();
        self.kiss_data.insert(&token_id, &info);

        if royalty_amount.as_yoctonear() > 0 {
            let _ = Promise::new(root_sender_id).transfer(royalty_amount);
        }
    }

    /// Withdraw the NEAR locked in a bloomed kiss to its current owner.
    /// Zeroes `locked_amount` first (checks-effects-interactions) so a
    /// failed/retried transfer can't be claimed twice.
    pub fn claim(&mut self, token_id: TokenId) -> Promise {
        let owner_id = self.tokens.owner_by_id.get(&token_id).expect("Kiss not found");
        require!(
            env::predecessor_account_id() == owner_id,
            "Only the kiss's current owner can claim it"
        );

        let mut info = self.kiss_data.get(&token_id).expect("Kiss not found");
        require!(info.status == KissStatus::Bloomed, "Kiss must be bloomed before claiming");
        require!(info.locked_amount.as_yoctonear() > 0, "Nothing left to claim");

        let amount = info.locked_amount;
        info.locked_amount = NearToken::from_yoctonear(0);
        self.kiss_data.insert(&token_id, &info);

        Promise::new(owner_id).transfer(amount)
    }

    /// If the deadline passed without reciprocation, the ORIGINAL
    /// SENDER (not the receiver) can reclaim the locked NEAR. Anyone
    /// can call this to flip an overdue Pending kiss to Wilted first —
    /// NEAR has no built-in cron, so expiry is checked lazily, on
    /// whichever call touches the kiss next, rather than on a timer.
    pub fn reclaim_if_wilted(&mut self, token_id: TokenId) -> Promise {
        let mut info = self.kiss_data.get(&token_id).expect("Kiss not found");
        require!(
            env::predecessor_account_id() == info.sender_id,
            "Only the original sender can reclaim an unreciprocated kiss"
        );
        require!(info.status != KissStatus::Bloomed, "This kiss was reciprocated — nothing to reclaim");
        require!(env::block_timestamp() > info.expires_at, "This kiss's window hasn't closed yet");
        // Nothing bloomed, so no royalty is owed to the root either —
        // the sender gets BOTH the locked amount and the royalty slice
        // that would have gone to the root back.
        let amount = NearToken::from_yoctonear(
            info.locked_amount.as_yoctonear() + info.royalty_amount.as_yoctonear(),
        );
        require!(amount.as_yoctonear() > 0, "Nothing left to reclaim");

        info.status = KissStatus::Wilted;
        info.locked_amount = NearToken::from_yoctonear(0);
        info.royalty_amount = NearToken::from_yoctonear(0);
        let sender = info.sender_id.clone();
        self.kiss_data.insert(&token_id, &info);

        Promise::new(sender).transfer(amount)
    }

    // ── Views ────────────────────────────────────────────────────────

    pub fn get_kiss(&self, token_id: TokenId) -> Option<KissInfo> {
        self.kiss_data.get(&token_id)
    }

    pub fn get_kiss_token(&self, token_id: TokenId) -> Option<Token> {
        self.tokens.nft_token(token_id)
    }
}

// ── NEP-171 / NEP-177 plumbing ──────────────────────────────────────
// Core transfer/approval/enumeration behavior comes straight from
// near-contract-standards — we don't hand-roll token bookkeeping, only
// the kiss-specific state layered on top above.

near_contract_standards::impl_non_fungible_token_core!(Contract, tokens);
near_contract_standards::impl_non_fungible_token_approval!(Contract, tokens);
near_contract_standards::impl_non_fungible_token_enumeration!(Contract, tokens);

#[near]
impl NonFungibleTokenMetadataProvider for Contract {
    fn nft_metadata(&self) -> NFTContractMetadata {
        self.metadata.get().unwrap()
    }
}

// ── Tests ────────────────────────────────────────────────────────────
// Compiling only proves this is valid Rust — these check the actual
// mint -> reciprocate -> claim money movement and the rejection paths
// (wrong caller, wrong state, expired) actually behave as intended.

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn alice() -> AccountId { "alice.test.near".parse().unwrap() }
    fn bob() -> AccountId { "bob.test.near".parse().unwrap() }
    fn carol() -> AccountId { "carol.test.near".parse().unwrap() }

    fn context(predecessor: AccountId, deposit: NearToken, block_timestamp: u64) -> VMContextBuilder {
        let mut b = VMContextBuilder::new();
        b.predecessor_account_id(predecessor)
            .attached_deposit(deposit)
            .block_timestamp(block_timestamp);
        b
    }

    fn setup() -> Contract {
        testing_env!(context(alice(), NearToken::from_near(0), 0).build());
        Contract::new(alice())
    }

    #[test]
    fn mint_locks_funds_in_pending_state() {
        let mut c = setup();
        testing_env!(context(alice(), NearToken::from_near(1), 0).build());
        let id = c.mint_kiss(bob(), "hi".to_string(), 48);

        let info = c.get_kiss(id.clone()).expect("kiss should exist");
        assert_eq!(info.status, KissStatus::Pending);
        assert_eq!(info.locked_amount, NearToken::from_near(1));
        assert_eq!(info.sender_id, alice());

        let token = c.get_kiss_token(id).expect("nft should exist");
        assert_eq!(token.owner_id, bob());
    }

    #[test]
    fn receiver_can_reciprocate_then_claim_full_amount() {
        let mut c = setup();
        testing_env!(context(alice(), NearToken::from_near(2), 0).build());
        let id = c.mint_kiss(bob(), "hi".to_string(), 48);

        // Bob reciprocates before the 48h deadline.
        testing_env!(context(bob(), NearToken::from_near(0), 60 * 60 * 1_000_000_000).build());
        c.reciprocate(id.clone());
        assert_eq!(c.get_kiss(id.clone()).unwrap().status, KissStatus::Bloomed);

        let _ = c.claim(id.clone());
        assert_eq!(c.get_kiss(id).unwrap().locked_amount, NearToken::from_near(0));
    }

    #[test]
    #[should_panic(expected = "Only the kiss's current owner can reciprocate")]
    fn sender_cannot_reciprocate_their_own_kiss() {
        let mut c = setup();
        testing_env!(context(alice(), NearToken::from_near(1), 0).build());
        let id = c.mint_kiss(bob(), "hi".to_string(), 48);

        // Alice (the sender, not the receiver) tries to reciprocate.
        testing_env!(context(alice(), NearToken::from_near(0), 1000).build());
        c.reciprocate(id);
    }

    #[test]
    #[should_panic(expected = "wilted")]
    fn reciprocating_after_deadline_wilts_instead() {
        let mut c = setup();
        testing_env!(context(alice(), NearToken::from_near(1), 0).build());
        let id = c.mint_kiss(bob(), "hi".to_string(), 1); // 1 hour window

        // Bob tries 2 hours later — past the deadline.
        let two_hours_ns = 2 * 60 * 60 * 1_000_000_000;
        testing_env!(context(bob(), NearToken::from_near(0), two_hours_ns).build());
        c.reciprocate(id);
    }

    #[test]
    fn sender_reclaims_funds_from_a_wilted_kiss() {
        let mut c = setup();
        testing_env!(context(alice(), NearToken::from_near(1), 0).build());
        let id = c.mint_kiss(bob(), "hi".to_string(), 1);

        // Past the deadline, nobody reciprocated. Alice reclaims.
        let two_hours_ns = 2 * 60 * 60 * 1_000_000_000;
        testing_env!(context(alice(), NearToken::from_near(0), two_hours_ns).build());
        let _ = c.reclaim_if_wilted(id.clone());

        assert_eq!(c.get_kiss(id.clone()).unwrap().status, KissStatus::Wilted);
        assert_eq!(c.get_kiss(id).unwrap().locked_amount, NearToken::from_near(0));
    }

    #[test]
    #[should_panic(expected = "Kiss must be bloomed before claiming")]
    fn cannot_claim_a_still_pending_kiss() {
        let mut c = setup();
        testing_env!(context(alice(), NearToken::from_near(1), 0).build());
        let id = c.mint_kiss(bob(), "hi".to_string(), 48);

        testing_env!(context(bob(), NearToken::from_near(0), 1000).build());
        let _ = c.claim(id); // never reciprocated
    }

    // ── Phase 3: relay + royalty ────────────────────────────────────

    #[test]
    fn relay_splits_deposit_into_royalty_and_locked() {
        let mut c = setup();
        testing_env!(context(alice(), NearToken::from_near(1), 0).build());
        let root_id = c.mint_kiss(bob(), "hi".to_string(), 48);

        testing_env!(context(bob(), NearToken::from_near(0), 1000).build());
        c.reciprocate(root_id.clone());

        // Bob relays to Carol with 1 NEAR attached: 5% (0.05) should be
        // set aside as royalty, 0.95 as Carol's own locked_amount.
        testing_env!(context(bob(), NearToken::from_near(1), 1000).build());
        let child_id = c.relay(root_id.clone(), carol(), "pass it on".to_string(), 48);

        let child = c.get_kiss(child_id).unwrap();
        assert_eq!(child.locked_amount, NearToken::from_millinear(950));
        assert_eq!(child.royalty_amount, NearToken::from_millinear(50));
        assert_eq!(child.depth, 1);
        assert_eq!(child.root_sender_id, alice()); // inherited from root, not bob
        assert_eq!(child.parent_token_id, Some(root_id.clone()));

        // Relaying decremented the parent's own inventory.
        assert_eq!(c.get_kiss(root_id).unwrap().relay_slots_remaining, MAX_RELAY_SLOTS - 1);
    }

    #[test]
    fn root_receives_royalty_the_instant_the_child_blooms() {
        let mut c = setup();
        testing_env!(context(alice(), NearToken::from_near(1), 0).build());
        let root_id = c.mint_kiss(bob(), "hi".to_string(), 48);
        testing_env!(context(bob(), NearToken::from_near(0), 1000).build());
        c.reciprocate(root_id.clone());

        testing_env!(context(bob(), NearToken::from_near(1), 1000).build());
        let child_id = c.relay(root_id, carol(), "pass it on".to_string(), 48);
        assert_eq!(c.get_kiss(child_id.clone()).unwrap().royalty_amount, NearToken::from_millinear(50));

        // Carol reciprocates — this should zero the royalty (paid out
        // to alice, the root, via a Promise we can't observe the
        // transfer of in a unit test, but we CAN confirm the
        // contract's own bookkeeping reflects it as paid).
        testing_env!(context(carol(), NearToken::from_near(0), 2000).build());
        c.reciprocate(child_id.clone());
        assert_eq!(c.get_kiss(child_id).unwrap().royalty_amount, NearToken::from_yoctonear(0));
    }

    #[test]
    #[should_panic(expected = "Can only relay a kiss that has bloomed")]
    fn cannot_relay_a_kiss_that_has_not_bloomed() {
        let mut c = setup();
        testing_env!(context(alice(), NearToken::from_near(1), 0).build());
        let id = c.mint_kiss(bob(), "hi".to_string(), 48);

        // Bob never reciprocated — tries to relay a still-pending kiss.
        testing_env!(context(bob(), NearToken::from_near(1), 1000).build());
        let _ = c.relay(id, carol(), "too soon".to_string(), 48);
    }

    #[test]
    #[should_panic(expected = "no relay slots")]
    fn relay_slots_run_out_after_max_relay_slots_uses() {
        let mut c = setup();
        testing_env!(context(alice(), NearToken::from_near(10), 0).build());
        let id = c.mint_kiss(bob(), "hi".to_string(), 48);
        testing_env!(context(bob(), NearToken::from_near(0), 1000).build());
        c.reciprocate(id.clone());

        // Exhaust all MAX_RELAY_SLOTS...
        for i in 0..MAX_RELAY_SLOTS {
            testing_env!(context(bob(), NearToken::from_near(1), 1000 + i as u64).build());
            let _ = c.relay(id.clone(), carol(), "again".to_string(), 48);
        }
        // ...the next one should fail.
        testing_env!(context(bob(), NearToken::from_near(1), 9999).build());
        let _ = c.relay(id, carol(), "one too many".to_string(), 48);
    }

    #[test]
    fn wilted_relay_refunds_both_locked_and_royalty_to_its_own_sender() {
        let mut c = setup();
        testing_env!(context(alice(), NearToken::from_near(1), 0).build());
        let root_id = c.mint_kiss(bob(), "hi".to_string(), 48);
        testing_env!(context(bob(), NearToken::from_near(0), 1000).build());
        c.reciprocate(root_id.clone());

        testing_env!(context(bob(), NearToken::from_near(1), 1000).build());
        let child_id = c.relay(root_id, carol(), "pass it on".to_string(), 1); // 1h window

        // Carol never reciprocates. Bob (the relayer/sender of this
        // child kiss) reclaims after the deadline — gets the FULL 1
        // NEAR back (locked + royalty), since nothing ever bloomed.
        let two_hours_ns = 2 * 60 * 60 * 1_000_000_000;
        testing_env!(context(bob(), NearToken::from_near(0), two_hours_ns).build());
        let _ = c.reclaim_if_wilted(child_id.clone());

        let child = c.get_kiss(child_id).unwrap();
        assert_eq!(child.status, KissStatus::Wilted);
        assert_eq!(child.locked_amount, NearToken::from_yoctonear(0));
        assert_eq!(child.royalty_amount, NearToken::from_yoctonear(0));
    }

    // ── App-integrated flow: lock_gift + claim_gift ─────────────────

    #[test]
    fn lock_gift_escrows_funds_to_contract_owned_placeholder() {
        let mut c = setup();
        testing_env!(context(alice(), NearToken::from_near(1), 0).build());
        let token_id = c.lock_gift("kiss_abc123".to_string(), 48);
        assert_eq!(token_id, "gift-kiss_abc123");

        let info = c.get_kiss(token_id.clone()).expect("gift should exist");
        assert_eq!(info.status, KissStatus::Pending);
        assert_eq!(info.locked_amount, NearToken::from_near(1));
        assert_eq!(info.sender_id, alice());

        let token = c.get_kiss_token(token_id).expect("nft should exist");
        assert_eq!(token.owner_id, near_sdk::env::current_account_id());
    }

    #[test]
    #[should_panic(expected = "Must attach NEAR to lock a gift")]
    fn lock_gift_rejects_zero_deposit() {
        let mut c = setup();
        testing_env!(context(alice(), NearToken::from_near(0), 0).build());
        let _ = c.lock_gift("kiss_nodeposit".to_string(), 48);
    }

    #[test]
    #[should_panic(expected = "already locked")]
    fn lock_gift_rejects_duplicate_gao_kiss_id() {
        let mut c = setup();
        testing_env!(context(alice(), NearToken::from_near(1), 0).build());
        let _ = c.lock_gift("kiss_dup".to_string(), 48);
        testing_env!(context(alice(), NearToken::from_near(1), 0).build());
        let _ = c.lock_gift("kiss_dup".to_string(), 48);
    }

    #[test]
    fn claim_gift_transfers_ownership_and_pays_out_in_one_call() {
        let mut c = setup();
        testing_env!(context(alice(), NearToken::from_near(2), 0).build());
        let token_id = c.lock_gift("kiss_claimme".to_string(), 48);

        // Bob claims — no prior NFT ownership required, just the right
        // gao_kiss_id and claiming before the window closes.
        testing_env!(context(bob(), NearToken::from_near(0), 1000).build());
        let _ = c.claim_gift("kiss_claimme".to_string());

        let info = c.get_kiss(token_id.clone()).unwrap();
        assert_eq!(info.status, KissStatus::Bloomed);
        assert_eq!(info.locked_amount, NearToken::from_yoctonear(0)); // paid out already

        let token = c.get_kiss_token(token_id).unwrap();
        assert_eq!(token.owner_id, bob());
    }

    #[test]
    #[should_panic(expected = "already claimed or has wilted")]
    fn claim_gift_cannot_be_claimed_twice() {
        let mut c = setup();
        testing_env!(context(alice(), NearToken::from_near(1), 0).build());
        let _ = c.lock_gift("kiss_onceonly".to_string(), 48);

        testing_env!(context(bob(), NearToken::from_near(0), 1000).build());
        let _ = c.claim_gift("kiss_onceonly".to_string());

        // Carol tries to claim the same gift after Bob already did.
        testing_env!(context(carol(), NearToken::from_near(0), 2000).build());
        let _ = c.claim_gift("kiss_onceonly".to_string());
    }

    #[test]
    #[should_panic(expected = "claim window closed")]
    fn claim_gift_rejects_claim_after_expiry() {
        let mut c = setup();
        testing_env!(context(alice(), NearToken::from_near(1), 0).build());
        let _ = c.lock_gift("kiss_toolate".to_string(), 1); // 1h window

        let two_hours_ns = 2 * 60 * 60 * 1_000_000_000;
        testing_env!(context(bob(), NearToken::from_near(0), two_hours_ns).build());
        let _ = c.claim_gift("kiss_toolate".to_string());
    }

    #[test]
    fn sender_reclaims_an_unclaimed_gift_after_expiry() {
        let mut c = setup();
        testing_env!(context(alice(), NearToken::from_near(1), 0).build());
        let token_id = c.lock_gift("kiss_unclaimed".to_string(), 1);

        let two_hours_ns = 2 * 60 * 60 * 1_000_000_000;
        testing_env!(context(alice(), NearToken::from_near(0), two_hours_ns).build());
        let _ = c.reclaim_if_wilted(token_id.clone());

        assert_eq!(c.get_kiss(token_id).unwrap().status, KissStatus::Wilted);
    }
}
