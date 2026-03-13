/// Basis points denominator: 10,000 = 100%.
pub const BPS_DENOMINATOR: u64 = 10_000;

/// Seconds per year (365.25 days).
pub const SECONDS_PER_YEAR: u64 = 31_557_600;

/// Maximum entry/exit fee: 10% (1,000 BPS).
pub const MAX_ENTRY_EXIT_FEE_BPS: u16 = 1_000;

/// Maximum management fee: 10% (1,000 BPS).
pub const MAX_MANAGEMENT_FEE_BPS: u16 = 1_000;

/// Maximum performance fee: 50% (5,000 BPS).
pub const MAX_PERFORMANCE_FEE_BPS: u16 = 5_000;

/// Split a gross amount into (net, fee) given a fee rate in BPS.
///
/// Fee is rounded DOWN (favors the user). Returns `None` on overflow.
#[inline]
pub fn apply_fee(gross: u64, fee_bps: u16) -> Option<(u64, u64)> {
    if fee_bps == 0 {
        return Some((gross, 0));
    }
    let fee = gross
        .checked_mul(fee_bps as u64)?
        .checked_div(BPS_DENOMINATOR)?;
    let net = gross.checked_sub(fee)?;
    Some((net, fee))
}

/// Calculate management fee shares to mint.
///
/// Formula: `total_supply * mgmt_bps * elapsed / (BPS * SECONDS_PER_YEAR)`
///
/// Uses u128 intermediate to prevent overflow with large supplies.
#[inline]
pub fn management_fee_shares(
    total_supply: u64,
    management_fee_bps: u16,
    elapsed_seconds: u64,
) -> Option<u64> {
    if management_fee_bps == 0 || elapsed_seconds == 0 || total_supply == 0 {
        return Some(0);
    }
    let numerator = (total_supply as u128)
        .checked_mul(management_fee_bps as u128)?
        .checked_mul(elapsed_seconds as u128)?;
    let denominator = (BPS_DENOMINATOR as u128)
        .checked_mul(SECONDS_PER_YEAR as u128)?;
    let result = numerator.checked_div(denominator)?;
    if result > u64::MAX as u128 {
        return None;
    }
    Some(result as u64)
}

/// Calculate performance fee shares to mint.
///
/// Only produces shares when `share_price > high_water_mark`.
///
/// Formula: `(price - hwm) * total_supply * perf_bps / (price * BPS)`
///
/// Uses u128 intermediate to prevent overflow.
#[inline]
pub fn performance_fee_shares(
    share_price: u64,
    high_water_mark: u64,
    total_supply: u64,
    performance_fee_bps: u16,
) -> Option<u64> {
    if performance_fee_bps == 0 || total_supply == 0 || share_price <= high_water_mark {
        return Some(0);
    }
    let price_increase = share_price.checked_sub(high_water_mark)?;
    let numerator = (price_increase as u128)
        .checked_mul(total_supply as u128)?
        .checked_mul(performance_fee_bps as u128)?;
    let denominator = (share_price as u128)
        .checked_mul(BPS_DENOMINATOR as u128)?;
    let result = numerator.checked_div(denominator)?;
    if result > u64::MAX as u128 {
        return None;
    }
    Some(result as u64)
}

/// Validate that all fee BPS values are within allowed maximums.
#[inline]
pub fn validate_fee_bps(
    entry_fee_bps: u16,
    exit_fee_bps: u16,
    management_fee_bps: u16,
    performance_fee_bps: u16,
) -> bool {
    entry_fee_bps <= MAX_ENTRY_EXIT_FEE_BPS
        && exit_fee_bps <= MAX_ENTRY_EXIT_FEE_BPS
        && management_fee_bps <= MAX_MANAGEMENT_FEE_BPS
        && performance_fee_bps <= MAX_PERFORMANCE_FEE_BPS
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── apply_fee ──────────────────────────────────────────────

    #[test]
    fn test_apply_fee_zero_bps() {
        assert_eq!(apply_fee(1_000, 0), Some((1_000, 0)));
    }

    #[test]
    fn test_apply_fee_one_percent() {
        assert_eq!(apply_fee(10_000, 100), Some((9_900, 100)));
    }

    #[test]
    fn test_apply_fee_ten_percent() {
        assert_eq!(apply_fee(10_000, 1_000), Some((9_000, 1_000)));
    }

    #[test]
    fn test_apply_fee_rounds_down() {
        // 1% of 999 = 9.99 → 9
        assert_eq!(apply_fee(999, 100), Some((990, 9)));
    }

    #[test]
    fn test_apply_fee_zero_amount() {
        assert_eq!(apply_fee(0, 500), Some((0, 0)));
    }

    #[test]
    fn test_apply_fee_small_amount_rounds_to_zero() {
        // 1 * 100 / 10_000 = 0
        assert_eq!(apply_fee(1, 100), Some((1, 0)));
    }

    #[test]
    fn test_apply_fee_max_u64() {
        let result = apply_fee(u64::MAX, 1);
        assert!(result.is_some());
    }

    // ── management_fee_shares ──────────────────────────────────

    #[test]
    fn test_mgmt_fee_one_year() {
        // 2% of 1,000,000 over 1 year = 20,000
        assert_eq!(
            management_fee_shares(1_000_000, 200, SECONDS_PER_YEAR),
            Some(20_000)
        );
    }

    #[test]
    fn test_mgmt_fee_half_year() {
        // 2% of 1,000,000 over half year = 10,000
        assert_eq!(
            management_fee_shares(1_000_000, 200, SECONDS_PER_YEAR / 2),
            Some(10_000)
        );
    }

    #[test]
    fn test_mgmt_fee_zero_supply() {
        assert_eq!(management_fee_shares(0, 200, SECONDS_PER_YEAR), Some(0));
    }

    #[test]
    fn test_mgmt_fee_zero_bps() {
        assert_eq!(management_fee_shares(1_000_000, 0, SECONDS_PER_YEAR), Some(0));
    }

    #[test]
    fn test_mgmt_fee_zero_elapsed() {
        assert_eq!(management_fee_shares(1_000_000, 200, 0), Some(0));
    }

    #[test]
    fn test_mgmt_fee_large_supply() {
        let result = management_fee_shares(u64::MAX / 2, 1_000, SECONDS_PER_YEAR);
        assert!(result.is_some());
    }

    #[test]
    fn test_mgmt_fee_one_day() {
        // 10% of 1,000,000 over 1 day ≈ 273
        let one_day = 86_400u64;
        let result = management_fee_shares(1_000_000, 1_000, one_day).unwrap();
        assert_eq!(result, 1_000_000u128 as u64 * 1_000 * 86_400 / (10_000 * 31_557_600));
    }

    // ── performance_fee_shares ─────────────────────────────────

    #[test]
    fn test_perf_fee_no_profit() {
        assert_eq!(
            performance_fee_shares(1_000_000, 1_000_000, 100_000, 2_000),
            Some(0)
        );
    }

    #[test]
    fn test_perf_fee_below_hwm() {
        assert_eq!(
            performance_fee_shares(900_000, 1_000_000, 100_000, 2_000),
            Some(0)
        );
    }

    #[test]
    fn test_perf_fee_price_doubled() {
        // Price 1.0→2.0, 100 shares (6 dec), 20% perf fee
        // profit = 1M * 100M / 2M * 2000/10000 = 10M shares
        let fee = performance_fee_shares(2_000_000, 1_000_000, 100_000_000, 2_000);
        assert_eq!(fee, Some(10_000_000));
    }

    #[test]
    fn test_perf_fee_zero_supply() {
        assert_eq!(
            performance_fee_shares(2_000_000, 1_000_000, 0, 2_000),
            Some(0)
        );
    }

    #[test]
    fn test_perf_fee_zero_bps() {
        assert_eq!(
            performance_fee_shares(2_000_000, 1_000_000, 100_000, 0),
            Some(0)
        );
    }

    #[test]
    fn test_perf_fee_small_increase() {
        // Price 1,000,000 → 1,000,001 (tiny profit)
        // fee = 1 * 1_000_000 * 2000 / (1_000_001 * 10_000) = 0 (rounds down)
        let fee = performance_fee_shares(1_000_001, 1_000_000, 1_000_000, 2_000);
        assert_eq!(fee, Some(0));
    }

    // ── validate_fee_bps ───────────────────────────────────────

    #[test]
    fn test_validate_all_zero() {
        assert!(validate_fee_bps(0, 0, 0, 0));
    }

    #[test]
    fn test_validate_at_max() {
        assert!(validate_fee_bps(1_000, 1_000, 1_000, 5_000));
    }

    #[test]
    fn test_validate_entry_exceeds() {
        assert!(!validate_fee_bps(1_001, 0, 0, 0));
    }

    #[test]
    fn test_validate_exit_exceeds() {
        assert!(!validate_fee_bps(0, 1_001, 0, 0));
    }

    #[test]
    fn test_validate_mgmt_exceeds() {
        assert!(!validate_fee_bps(0, 0, 1_001, 0));
    }

    #[test]
    fn test_validate_perf_exceeds() {
        assert!(!validate_fee_bps(0, 0, 0, 5_001));
    }
}
