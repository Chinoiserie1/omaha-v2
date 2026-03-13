/// Compute minimum lamports for rent exemption.
///
/// Uses Solana's on-chain constants (unchanged since mainnet launch):
///   - lamports_per_byte_year: 3,480
///   - exemption_threshold: 2 years
///   - account_storage_overhead: 128 bytes
pub const fn minimum_balance(data_len: usize) -> u64 {
    (data_len as u64 + 128) * 3480 * 2
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_minimum_balance_zero() {
        assert_eq!(minimum_balance(0), 128 * 3480 * 2);
        assert_eq!(minimum_balance(0), 890_880);
    }

    #[test]
    fn test_minimum_balance_vault_state() {
        // VaultState::LEN == 432
        assert_eq!(minimum_balance(432), (432 + 128) * 3480 * 2);
        assert_eq!(minimum_balance(432), 3_897_600);
    }

    #[test]
    fn test_minimum_balance_mint() {
        // SPL Mint size = 82 bytes
        assert_eq!(minimum_balance(82), (82 + 128) * 3480 * 2);
        assert_eq!(minimum_balance(82), 1_461_600);
    }

    #[test]
    fn test_minimum_balance_is_const() {
        const _ZERO: u64 = minimum_balance(0);
        const _VAULT: u64 = minimum_balance(464);
        const _MINT: u64 = minimum_balance(82);
    }
}
