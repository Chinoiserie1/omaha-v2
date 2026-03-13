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
