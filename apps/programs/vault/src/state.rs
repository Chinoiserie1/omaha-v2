#![allow(clippy::too_many_arguments)]

use bytemuck::{Pod, Zeroable};

/// Maximum number of operators a vault can have.
pub const MAX_OPERATORS: usize = 10;

/// Maximum number of admins the factory can have.
pub const MAX_FACTORY_ADMINS: usize = 10;

/// Pending deposit/withdraw expiry: 48 hours (in seconds).
/// After this, the user can cancel and reclaim funds.
pub const PENDING_EXPIRY_SECONDS: i64 = 172_800;

// ── Account Discriminators ──────────────────────────────────────────

/// Account discriminator for VaultState.
pub const VAULT_DISCRIMINATOR: u8 = 0xA1;

/// Account discriminator for PendingDeposit.
pub const PENDING_DEPOSIT_DISCRIMINATOR: u8 = 0xA2;

/// Account discriminator for PendingWithdraw.
pub const PENDING_WITHDRAW_DISCRIMINATOR: u8 = 0xA3;

/// Account discriminator for FactoryState.
pub const FACTORY_DISCRIMINATOR: u8 = 0xA4;

// ── FactoryState ────────────────────────────────────────────────────

/// On-chain factory state — singleton PDA that governs vault creation.
///
/// Layout (400 bytes total):
///   discriminator    (1)  — account type guard (0xA4)
///   bump             (1)  — factory PDA bump seed
///   is_paused        (1)  — global pause flag (0 = active, 1 = paused)
///   num_admins       (1)  — active admin count (0..MAX_FACTORY_ADMINS)
///   _padding         (4)  — alignment
///   owner            (32) — factory owner pubkey (transferable)
///   pending_owner    (32) — proposed new owner (for 2-step transfer)
///   vault_count      (8)  — total vaults created
///   admins           (320) — up to 10 factory admin pubkeys
#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
pub struct FactoryState {
    pub discriminator: u8,
    pub bump: u8,
    pub is_paused: u8,
    pub num_admins: u8,
    pub _padding: [u8; 4],
    pub owner: [u8; 32],
    pub pending_owner: [u8; 32],
    pub vault_count: u64,
    pub admins: [[u8; 32]; MAX_FACTORY_ADMINS],
}

impl FactoryState {
    pub const LEN: usize = core::mem::size_of::<Self>();

    /// Check if `key` is the factory owner.
    #[inline]
    pub fn is_owner(&self, key: &[u8; 32]) -> bool {
        self.owner == *key
    }

    /// Check if `key` is a factory admin OR the owner.
    #[inline]
    pub fn is_authorized(&self, key: &[u8; 32]) -> bool {
        if self.is_owner(key) {
            return true;
        }
        let n = self.num_admins as usize;
        for i in 0..n {
            if self.admins[i] == *key {
                return true;
            }
        }
        false
    }

    /// Add a factory admin. Returns false if full or duplicate.
    #[inline]
    pub fn add_admin(&mut self, key: &[u8; 32]) -> bool {
        let n = self.num_admins as usize;
        if n >= MAX_FACTORY_ADMINS {
            return false;
        }
        for i in 0..n {
            if self.admins[i] == *key {
                return false;
            }
        }
        self.admins[n] = *key;
        self.num_admins = (n + 1) as u8;
        true
    }

    /// Remove a factory admin by swapping with the last. Returns false if not found.
    #[inline]
    pub fn remove_admin(&mut self, key: &[u8; 32]) -> bool {
        let n = self.num_admins as usize;
        for i in 0..n {
            if self.admins[i] == *key {
                let last = n - 1;
                if i != last {
                    self.admins[i] = self.admins[last];
                }
                self.admins[last] = [0u8; 32];
                self.num_admins = last as u8;
                return true;
            }
        }
        false
    }

    /// Check if the factory is paused.
    #[inline]
    pub fn paused(&self) -> bool {
        self.is_paused != 0
    }
}

// ── VaultState ──────────────────────────────────────────────────────

/// On-chain vault state — zero-copy via bytemuck.
///
/// Layout (584 bytes total):
///   discriminator       (1)  — account type guard (0xA1)
///   bump                (1)  — vault PDA bump seed
///   share_decimals      (1)  — share token decimal places
///   num_operators       (1)  — active operator count (0..MAX_OPERATORS)
///   entry_fee_bps       (2)  — entry/subscription fee in basis points
///   exit_fee_bps        (2)  — exit/redemption fee in basis points
///   management_fee_bps  (2)  — annual management fee in basis points
///   performance_fee_bps (2)  — performance fee in basis points
///   vault_name_len      (1)  — length of vault name (0..32)
///   is_paused           (1)  — per-vault pause flag (0 = active, 1 = paused)
///   _padding            (2)  — alignment
///   admin               (32) — vault admin pubkey (transferable via 2-step)
///   pending_admin       (32) — proposed new admin (for 2-step transfer)
///   share_mint          (32) — share SPL token mint
///   base_mint           (32) — deposit token mint (e.g. USDC)
///   fee_receiver        (32) — manager's pubkey for fee share distribution
///   factory             (32) — back-reference to factory that created this vault
///   share_price         (8)  — price per share in base-token smallest units
///   high_water_mark     (8)  — highest share price for performance fee
///   last_fee_timestamp  (8)  — last management fee collection (unix seconds)
///   operators           (320) — up to 10 operator pubkeys
///   vault_name          (32) — vault name bytes (used in PDA seeds)
#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
pub struct VaultState {
    pub discriminator: u8,
    pub bump: u8,
    pub share_decimals: u8,
    pub num_operators: u8,
    pub entry_fee_bps: u16,
    pub exit_fee_bps: u16,
    pub management_fee_bps: u16,
    pub performance_fee_bps: u16,
    pub vault_name_len: u8,
    pub is_paused: u8,
    pub _padding: [u8; 2],
    pub admin: [u8; 32],
    pub pending_admin: [u8; 32],
    pub share_mint: [u8; 32],
    pub base_mint: [u8; 32],
    pub fee_receiver: [u8; 32],
    pub factory: [u8; 32],
    pub share_price: u64,
    pub high_water_mark: u64,
    pub last_fee_timestamp: i64,
    pub operators: [[u8; 32]; MAX_OPERATORS],
    pub vault_name: [u8; 32],
}

impl VaultState {
    pub const LEN: usize = core::mem::size_of::<Self>();

    /// Check if `key` is the admin.
    #[inline]
    pub fn is_admin(&self, key: &[u8; 32]) -> bool {
        self.admin == *key
    }

    /// Check if `key` is an active operator OR the admin.
    #[inline]
    pub fn is_authorized(&self, key: &[u8; 32]) -> bool {
        if self.is_admin(key) {
            return true;
        }
        let n = self.num_operators as usize;
        for i in 0..n {
            if self.operators[i] == *key {
                return true;
            }
        }
        false
    }

    /// Add an operator. Returns false if full or duplicate.
    #[inline]
    pub fn add_operator(&mut self, key: &[u8; 32]) -> bool {
        let n = self.num_operators as usize;
        if n >= MAX_OPERATORS {
            return false;
        }
        for i in 0..n {
            if self.operators[i] == *key {
                return false;
            }
        }
        self.operators[n] = *key;
        self.num_operators = (n + 1) as u8;
        true
    }

    /// Remove an operator by swapping with the last. Returns false if not found.
    #[inline]
    pub fn remove_operator(&mut self, key: &[u8; 32]) -> bool {
        let n = self.num_operators as usize;
        for i in 0..n {
            if self.operators[i] == *key {
                let last = n - 1;
                if i != last {
                    self.operators[i] = self.operators[last];
                }
                self.operators[last] = [0u8; 32];
                self.num_operators = last as u8;
                return true;
            }
        }
        false
    }

    /// Returns true if fees are configured (fee_receiver is set).
    #[inline]
    pub fn has_fee_receiver(&self) -> bool {
        self.fee_receiver != [0u8; 32]
    }

    /// Check if the vault is paused.
    #[inline]
    pub fn paused(&self) -> bool {
        self.is_paused != 0
    }
}

// ── PendingDeposit ──────────────────────────────────────────────────

/// On-chain pending deposit state — zero-copy via bytemuck.
///
/// Layout (88 bytes total):
///   discriminator    (1)  — account type guard (0xA2)
///   bump             (1)  — PDA bump seed
///   entry_fee_bps    (2)  — fee snapshot at request time
///   _padding         (4)  — alignment
///   vault_state      (32) — vault this deposit belongs to
///   depositor        (32) — who made the deposit
///   amount           (8)  — base token amount deposited
///   created_at       (8)  — unix timestamp of creation (for expiry)
#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
pub struct PendingDeposit {
    pub discriminator: u8,
    pub bump: u8,
    pub entry_fee_bps: u16,
    pub _padding: [u8; 4],
    pub vault_state: [u8; 32],
    pub depositor: [u8; 32],
    pub amount: u64,
    pub created_at: i64,
}

impl PendingDeposit {
    pub const LEN: usize = core::mem::size_of::<Self>();
}

// ── PendingWithdraw ─────────────────────────────────────────────────

/// On-chain pending withdraw state — zero-copy via bytemuck.
///
/// Layout (88 bytes total):
///   discriminator    (1)  — account type guard (0xA3)
///   bump             (1)  — PDA bump seed
///   exit_fee_bps     (2)  — fee snapshot at request time
///   _padding         (4)  — alignment
///   vault_state      (32) — vault this withdraw belongs to
///   withdrawer       (32) — who requested the withdraw
///   shares           (8)  — share tokens that were burned
///   created_at       (8)  — unix timestamp of creation (for expiry)
#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
pub struct PendingWithdraw {
    pub discriminator: u8,
    pub bump: u8,
    pub exit_fee_bps: u16,
    pub _padding: [u8; 4],
    pub vault_state: [u8; 32],
    pub withdrawer: [u8; 32],
    pub shares: u64,
    pub created_at: i64,
}

impl PendingWithdraw {
    pub const LEN: usize = core::mem::size_of::<Self>();
}

// ── Helpers ─────────────────────────────────────────────────────────

/// Check if a pubkey is the zero address.
#[inline]
pub fn is_zero_pubkey(key: &[u8; 32]) -> bool {
    *key == [0u8; 32]
}

#[cfg(test)]
mod tests {
    use super::*;
    use bytemuck::Zeroable;

    fn make_key(byte: u8) -> [u8; 32] {
        let mut k = [0u8; 32];
        k[0] = byte;
        k
    }

    fn make_vault(admin: [u8; 32]) -> VaultState {
        let mut state = VaultState::zeroed();
        state.admin = admin;
        state.discriminator = VAULT_DISCRIMINATOR;
        state
    }

    fn make_factory(owner: [u8; 32]) -> FactoryState {
        let mut state = FactoryState::zeroed();
        state.owner = owner;
        state.discriminator = FACTORY_DISCRIMINATOR;
        state
    }

    // ── Size checks ─────────────────────────────────────────────────

    #[test]
    fn test_vault_state_len() {
        assert_eq!(VaultState::LEN, 584);
        assert_eq!(VaultState::LEN, core::mem::size_of::<VaultState>());
    }

    #[test]
    fn test_factory_state_len() {
        assert_eq!(FactoryState::LEN, 400);
        assert_eq!(FactoryState::LEN, core::mem::size_of::<FactoryState>());
    }

    #[test]
    fn test_pending_deposit_len() {
        assert_eq!(PendingDeposit::LEN, 88);
        assert_eq!(PendingDeposit::LEN, core::mem::size_of::<PendingDeposit>());
    }

    #[test]
    fn test_pending_withdraw_len() {
        assert_eq!(PendingWithdraw::LEN, 88);
        assert_eq!(PendingWithdraw::LEN, core::mem::size_of::<PendingWithdraw>());
    }

    // ── VaultState tests ────────────────────────────────────────────

    #[test]
    fn test_is_admin_match() {
        let admin = make_key(1);
        let state = make_vault(admin);
        assert!(state.is_admin(&admin));
    }

    #[test]
    fn test_is_admin_mismatch() {
        let state = make_vault(make_key(1));
        assert!(!state.is_admin(&make_key(2)));
    }

    #[test]
    fn test_is_authorized_admin() {
        let admin = make_key(1);
        let state = make_vault(admin);
        assert!(state.is_authorized(&admin));
    }

    #[test]
    fn test_is_authorized_operator() {
        let admin = make_key(1);
        let operator = make_key(2);
        let mut state = make_vault(admin);
        state.add_operator(&operator);
        assert!(state.is_authorized(&operator));
    }

    #[test]
    fn test_is_authorized_stranger() {
        let state = make_vault(make_key(1));
        assert!(!state.is_authorized(&make_key(99)));
    }

    #[test]
    fn test_add_operator_success() {
        let mut state = make_vault(make_key(1));
        let op = make_key(10);
        assert!(state.add_operator(&op));
        assert_eq!(state.num_operators, 1);
        assert_eq!(state.operators[0], op);
    }

    #[test]
    fn test_add_operator_duplicate() {
        let mut state = make_vault(make_key(1));
        let op = make_key(10);
        assert!(state.add_operator(&op));
        assert!(!state.add_operator(&op));
        assert_eq!(state.num_operators, 1);
    }

    #[test]
    fn test_add_operator_full() {
        let mut state = make_vault(make_key(1));
        for i in 0..MAX_OPERATORS {
            assert!(state.add_operator(&make_key(10 + i as u8)));
        }
        assert_eq!(state.num_operators, MAX_OPERATORS as u8);
        assert!(!state.add_operator(&make_key(99)));
    }

    #[test]
    fn test_remove_operator_success() {
        let mut state = make_vault(make_key(1));
        let op = make_key(10);
        state.add_operator(&op);
        assert!(state.remove_operator(&op));
        assert_eq!(state.num_operators, 0);
        assert!(!state.is_authorized(&op));
    }

    #[test]
    fn test_remove_operator_not_found() {
        let mut state = make_vault(make_key(1));
        assert!(!state.remove_operator(&make_key(99)));
    }

    #[test]
    fn test_remove_operator_swap_behavior() {
        let mut state = make_vault(make_key(1));
        let a = make_key(10);
        let b = make_key(11);
        let c = make_key(12);
        state.add_operator(&a);
        state.add_operator(&b);
        state.add_operator(&c);

        assert!(state.remove_operator(&b));
        assert_eq!(state.num_operators, 2);
        assert_eq!(state.operators[0], a);
        assert_eq!(state.operators[1], c);
        assert_eq!(state.operators[2], [0u8; 32]);
    }

    #[test]
    fn test_has_fee_receiver_false() {
        let state = make_vault(make_key(1));
        assert!(!state.has_fee_receiver());
    }

    #[test]
    fn test_has_fee_receiver_true() {
        let mut state = make_vault(make_key(1));
        state.fee_receiver = make_key(42);
        assert!(state.has_fee_receiver());
    }

    #[test]
    fn test_vault_paused() {
        let mut state = make_vault(make_key(1));
        assert!(!state.paused());
        state.is_paused = 1;
        assert!(state.paused());
    }

    // ── FactoryState tests ──────────────────────────────────────────

    #[test]
    fn test_factory_is_owner() {
        let owner = make_key(1);
        let state = make_factory(owner);
        assert!(state.is_owner(&owner));
        assert!(!state.is_owner(&make_key(2)));
    }

    #[test]
    fn test_factory_is_authorized_owner() {
        let owner = make_key(1);
        let state = make_factory(owner);
        assert!(state.is_authorized(&owner));
    }

    #[test]
    fn test_factory_is_authorized_admin() {
        let owner = make_key(1);
        let admin = make_key(2);
        let mut state = make_factory(owner);
        state.add_admin(&admin);
        assert!(state.is_authorized(&admin));
    }

    #[test]
    fn test_factory_add_admin_success() {
        let mut state = make_factory(make_key(1));
        assert!(state.add_admin(&make_key(10)));
        assert_eq!(state.num_admins, 1);
    }

    #[test]
    fn test_factory_add_admin_duplicate() {
        let mut state = make_factory(make_key(1));
        let admin = make_key(10);
        assert!(state.add_admin(&admin));
        assert!(!state.add_admin(&admin));
    }

    #[test]
    fn test_factory_add_admin_full() {
        let mut state = make_factory(make_key(1));
        for i in 0..MAX_FACTORY_ADMINS {
            assert!(state.add_admin(&make_key(10 + i as u8)));
        }
        assert!(!state.add_admin(&make_key(99)));
    }

    #[test]
    fn test_factory_remove_admin_success() {
        let mut state = make_factory(make_key(1));
        let admin = make_key(10);
        state.add_admin(&admin);
        assert!(state.remove_admin(&admin));
        assert_eq!(state.num_admins, 0);
    }

    #[test]
    fn test_factory_remove_admin_not_found() {
        let mut state = make_factory(make_key(1));
        assert!(!state.remove_admin(&make_key(99)));
    }

    #[test]
    fn test_factory_paused() {
        let mut state = make_factory(make_key(1));
        assert!(!state.paused());
        state.is_paused = 1;
        assert!(state.paused());
    }

    // ── Helper tests ────────────────────────────────────────────────

    #[test]
    fn test_is_zero_pubkey() {
        assert!(is_zero_pubkey(&[0u8; 32]));
        assert!(!is_zero_pubkey(&make_key(1)));
    }
}
