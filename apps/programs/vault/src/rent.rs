/// Compute minimum lamports for rent exemption.
///
/// Uses Solana's on-chain constants (unchanged since mainnet launch):
///   - lamports_per_byte_year: 3,480
///   - exemption_threshold: 2 years
///   - account_storage_overhead: 128 bytes
pub const fn minimum_balance(data_len: usize) -> u64 {
    (data_len as u64 + 128) * 3480 * 2
}
