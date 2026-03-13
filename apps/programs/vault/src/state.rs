#![allow(clippy::too_many_arguments)]

use bytemuck::{Pod, Zeroable};

/// Maximum number of owners/operators a vault can have.
pub const MAX_OWNERS: usize = 10;

/// Account discriminator for VaultState.
pub const VAULT_DISCRIMINATOR: u8 = 1;

/// On-chain vault state — zero-copy via bytemuck.
///
/// Layout (464 bytes total):
///   discriminator  (1)  — account type guard
///   bump           (1)  — vault PDA bump seed
///   share_decimals (1)  — share token decimal places
///   num_owners     (1)  — active owner count (0..MAX_OWNERS)
///   _padding       (4)  — alignment
///   admin          (32) — admin pubkey
///   share_mint     (32) — share SPL token mint
///   base_mint      (32) — deposit token mint (e.g. USDC)
///   share_price    (8)  — price per share in base-token smallest units
///   owners       (320)  — up to 10 operator pubkeys
#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
pub struct VaultState {
    pub discriminator: u8,
    pub bump: u8,
    pub share_decimals: u8,
    pub num_owners: u8,
    pub _padding: [u8; 4],
    pub admin: [u8; 32],
    pub share_mint: [u8; 32],
    pub base_mint: [u8; 32],
    pub share_price: u64,
    pub owners: [[u8; 32]; MAX_OWNERS],
}

impl VaultState {
    pub const LEN: usize = core::mem::size_of::<Self>();

    /// Check if `key` is the admin.
    #[inline]
    pub fn is_admin(&self, key: &[u8; 32]) -> bool {
        self.admin == *key
    }

    /// Check if `key` is an active owner OR the admin.
    #[inline]
    pub fn is_authorized(&self, key: &[u8; 32]) -> bool {
        if self.is_admin(key) {
            return true;
        }
        let n = self.num_owners as usize;
        for i in 0..n {
            if self.owners[i] == *key {
                return true;
            }
        }
        false
    }

    /// Add an owner. Returns false if full or duplicate.
    #[inline]
    pub fn add_owner(&mut self, key: &[u8; 32]) -> bool {
        let n = self.num_owners as usize;
        if n >= MAX_OWNERS {
            return false;
        }
        // Duplicate check
        for i in 0..n {
            if self.owners[i] == *key {
                return false;
            }
        }
        self.owners[n] = *key;
        self.num_owners = (n + 1) as u8;
        true
    }

    /// Remove an owner by swapping with the last. Returns false if not found.
    #[inline]
    pub fn remove_owner(&mut self, key: &[u8; 32]) -> bool {
        let n = self.num_owners as usize;
        for i in 0..n {
            if self.owners[i] == *key {
                let last = n - 1;
                if i != last {
                    self.owners[i] = self.owners[last];
                }
                self.owners[last] = [0u8; 32];
                self.num_owners = last as u8;
                return true;
            }
        }
        false
    }
}

/// Account discriminator for PendingDeposit.
pub const PENDING_DEPOSIT_DISCRIMINATOR: u8 = 2;

/// On-chain pending deposit state — zero-copy via bytemuck.
///
/// Layout (80 bytes total):
///   discriminator  (1)  — account type guard (2)
///   bump           (1)  — PDA bump seed
///   _padding       (6)  — alignment
///   vault_state    (32) — vault this deposit belongs to
///   depositor      (32) — who made the deposit
///   amount         (8)  — base token amount deposited
#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
pub struct PendingDeposit {
    pub discriminator: u8,
    pub bump: u8,
    pub _padding: [u8; 6],
    pub vault_state: [u8; 32],
    pub depositor: [u8; 32],
    pub amount: u64,
}

impl PendingDeposit {
    pub const LEN: usize = core::mem::size_of::<Self>();
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

    fn make_state(admin: [u8; 32]) -> VaultState {
        let mut state = VaultState::zeroed();
        state.admin = admin;
        state.discriminator = VAULT_DISCRIMINATOR;
        state
    }

    #[test]
    fn test_vault_state_len() {
        // 1+1+1+1+4+32+32+32+8+320 = 432
        assert_eq!(VaultState::LEN, 432);
        assert_eq!(VaultState::LEN, core::mem::size_of::<VaultState>());
    }

    #[test]
    fn test_pending_deposit_len() {
        // 1+1+6+32+32+8 = 80
        assert_eq!(PendingDeposit::LEN, 80);
        assert_eq!(PendingDeposit::LEN, core::mem::size_of::<PendingDeposit>());
    }

    #[test]
    fn test_is_admin_match() {
        let admin = make_key(1);
        let state = make_state(admin);
        assert!(state.is_admin(&admin));
    }

    #[test]
    fn test_is_admin_mismatch() {
        let state = make_state(make_key(1));
        assert!(!state.is_admin(&make_key(2)));
    }

    #[test]
    fn test_is_authorized_admin() {
        let admin = make_key(1);
        let state = make_state(admin);
        assert!(state.is_authorized(&admin));
    }

    #[test]
    fn test_is_authorized_owner() {
        let admin = make_key(1);
        let owner = make_key(2);
        let mut state = make_state(admin);
        state.add_owner(&owner);
        assert!(state.is_authorized(&owner));
    }

    #[test]
    fn test_is_authorized_stranger() {
        let state = make_state(make_key(1));
        assert!(!state.is_authorized(&make_key(99)));
    }

    #[test]
    fn test_add_owner_success() {
        let mut state = make_state(make_key(1));
        let owner = make_key(10);
        assert!(state.add_owner(&owner));
        assert_eq!(state.num_owners, 1);
        assert_eq!(state.owners[0], owner);
    }

    #[test]
    fn test_add_owner_duplicate() {
        let mut state = make_state(make_key(1));
        let owner = make_key(10);
        assert!(state.add_owner(&owner));
        assert!(!state.add_owner(&owner));
        assert_eq!(state.num_owners, 1);
    }

    #[test]
    fn test_add_owner_full() {
        let mut state = make_state(make_key(1));
        for i in 0..MAX_OWNERS {
            assert!(state.add_owner(&make_key(10 + i as u8)));
        }
        assert_eq!(state.num_owners, MAX_OWNERS as u8);
        assert!(!state.add_owner(&make_key(99)));
    }

    #[test]
    fn test_add_multiple_owners() {
        let mut state = make_state(make_key(1));
        for i in 0..MAX_OWNERS {
            let key = make_key(10 + i as u8);
            assert!(state.add_owner(&key));
            assert!(state.is_authorized(&key));
        }
        assert_eq!(state.num_owners, MAX_OWNERS as u8);
    }

    #[test]
    fn test_remove_owner_success() {
        let mut state = make_state(make_key(1));
        let owner = make_key(10);
        state.add_owner(&owner);
        assert!(state.remove_owner(&owner));
        assert_eq!(state.num_owners, 0);
        assert!(!state.is_authorized(&owner));
    }

    #[test]
    fn test_remove_owner_not_found() {
        let mut state = make_state(make_key(1));
        assert!(!state.remove_owner(&make_key(99)));
    }

    #[test]
    fn test_remove_owner_swap_behavior() {
        let mut state = make_state(make_key(1));
        let a = make_key(10);
        let b = make_key(11);
        let c = make_key(12);
        state.add_owner(&a);
        state.add_owner(&b);
        state.add_owner(&c);

        // Remove middle owner (b) — last owner (c) should swap into slot 1
        assert!(state.remove_owner(&b));
        assert_eq!(state.num_owners, 2);
        assert_eq!(state.owners[0], a);
        assert_eq!(state.owners[1], c);
        assert_eq!(state.owners[2], [0u8; 32]);
    }

    #[test]
    fn test_remove_last_owner() {
        let mut state = make_state(make_key(1));
        let owner = make_key(10);
        state.add_owner(&owner);
        assert!(state.remove_owner(&owner));
        assert_eq!(state.num_owners, 0);
        assert_eq!(state.owners[0], [0u8; 32]);
    }

    #[test]
    fn test_add_remove_add_cycle() {
        let mut state = make_state(make_key(1));
        let owner = make_key(10);
        assert!(state.add_owner(&owner));
        assert!(state.remove_owner(&owner));
        assert!(state.add_owner(&owner));
        assert_eq!(state.num_owners, 1);
        assert!(state.is_authorized(&owner));
    }
}
