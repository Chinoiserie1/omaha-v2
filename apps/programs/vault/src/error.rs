use pinocchio::program_error::ProgramError;

/// Custom error codes for the vault program.
/// Starts at 0x100 to avoid collision with built-in ProgramError variants.
#[repr(u32)]
pub enum VaultError {
    /// Signer is not the vault admin.
    Unauthorized = 0x100,
    /// Share price must be greater than zero.
    InvalidSharePrice = 0x101,
    /// Deposit or withdraw amount must be greater than zero.
    InvalidAmount = 0x102,
    /// Operator list is full (max 10).
    OperatorsFull = 0x103,
    /// Operator not found in the list.
    OperatorNotFound = 0x104,
    /// Account has wrong discriminator.
    InvalidDiscriminator = 0x105,
    /// Arithmetic overflow during share calculation.
    MathOverflow = 0x106,
    /// Vault has insufficient base-token balance.
    InsufficientFunds = 0x107,
    /// Duplicate operator.
    DuplicateOperator = 0x108,
    /// Pending deposit account has wrong discriminator or is invalid.
    InvalidPendingDeposit = 0x109,
    /// Pending withdraw account has wrong discriminator or is invalid.
    InvalidPendingWithdraw = 0x10A,
    /// Fee basis points exceed the allowed maximum.
    FeeExceedsMaximum = 0x10B,
    /// No accrued fees to collect.
    NoFeesToCollect = 0x10C,
    /// Metadata string exceeds max length.
    InvalidMetadata = 0x10D,
    /// Signer is not the program authority (cannot initialize factory).
    UnauthorizedInitializer = 0x10E,
    /// Vault name is empty or exceeds 32 bytes.
    InvalidVaultName = 0x10F,
    /// Vault is paused — operation not allowed.
    VaultPaused = 0x110,
    /// Factory is paused — operation not allowed.
    FactoryPaused = 0x111,
    /// Invalid factory account.
    InvalidFactory = 0x112,
    /// Factory admin list is full (max 10).
    FactoryAdminsFull = 0x113,
    /// Factory admin not found.
    FactoryAdminNotFound = 0x114,
    /// Duplicate factory admin.
    DuplicateFactoryAdmin = 0x115,
    /// No pending admin transfer in progress.
    NoPendingAdmin = 0x116,
    /// Signer does not match the pending admin.
    InvalidPendingAdmin = 0x117,
    /// Pending deposit/withdraw has not expired yet.
    PendingNotExpired = 0x118,
    /// Cannot use the zero pubkey.
    ZeroPubkey = 0x119,
    /// No pending owner transfer in progress.
    NoPendingOwner = 0x11A,
    /// Signer does not match the pending owner.
    InvalidPendingOwner = 0x11B,
    /// Signer is not factory owner or factory admin.
    UnauthorizedVaultCreator = 0x11C,
}

impl From<VaultError> for ProgramError {
    fn from(e: VaultError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_codes() {
        assert_eq!(ProgramError::Custom(0x100), ProgramError::from(VaultError::Unauthorized));
        assert_eq!(ProgramError::Custom(0x101), ProgramError::from(VaultError::InvalidSharePrice));
        assert_eq!(ProgramError::Custom(0x102), ProgramError::from(VaultError::InvalidAmount));
        assert_eq!(ProgramError::Custom(0x103), ProgramError::from(VaultError::OperatorsFull));
        assert_eq!(ProgramError::Custom(0x104), ProgramError::from(VaultError::OperatorNotFound));
        assert_eq!(ProgramError::Custom(0x105), ProgramError::from(VaultError::InvalidDiscriminator));
        assert_eq!(ProgramError::Custom(0x106), ProgramError::from(VaultError::MathOverflow));
        assert_eq!(ProgramError::Custom(0x107), ProgramError::from(VaultError::InsufficientFunds));
        assert_eq!(ProgramError::Custom(0x108), ProgramError::from(VaultError::DuplicateOperator));
        assert_eq!(ProgramError::Custom(0x109), ProgramError::from(VaultError::InvalidPendingDeposit));
        assert_eq!(ProgramError::Custom(0x10A), ProgramError::from(VaultError::InvalidPendingWithdraw));
        assert_eq!(ProgramError::Custom(0x10B), ProgramError::from(VaultError::FeeExceedsMaximum));
        assert_eq!(ProgramError::Custom(0x10C), ProgramError::from(VaultError::NoFeesToCollect));
        assert_eq!(ProgramError::Custom(0x10D), ProgramError::from(VaultError::InvalidMetadata));
        assert_eq!(ProgramError::Custom(0x10E), ProgramError::from(VaultError::UnauthorizedInitializer));
        assert_eq!(ProgramError::Custom(0x10F), ProgramError::from(VaultError::InvalidVaultName));
        assert_eq!(ProgramError::Custom(0x110), ProgramError::from(VaultError::VaultPaused));
        assert_eq!(ProgramError::Custom(0x111), ProgramError::from(VaultError::FactoryPaused));
        assert_eq!(ProgramError::Custom(0x112), ProgramError::from(VaultError::InvalidFactory));
        assert_eq!(ProgramError::Custom(0x113), ProgramError::from(VaultError::FactoryAdminsFull));
        assert_eq!(ProgramError::Custom(0x114), ProgramError::from(VaultError::FactoryAdminNotFound));
        assert_eq!(ProgramError::Custom(0x115), ProgramError::from(VaultError::DuplicateFactoryAdmin));
        assert_eq!(ProgramError::Custom(0x116), ProgramError::from(VaultError::NoPendingAdmin));
        assert_eq!(ProgramError::Custom(0x117), ProgramError::from(VaultError::InvalidPendingAdmin));
        assert_eq!(ProgramError::Custom(0x118), ProgramError::from(VaultError::PendingNotExpired));
        assert_eq!(ProgramError::Custom(0x119), ProgramError::from(VaultError::ZeroPubkey));
        assert_eq!(ProgramError::Custom(0x11A), ProgramError::from(VaultError::NoPendingOwner));
        assert_eq!(ProgramError::Custom(0x11B), ProgramError::from(VaultError::InvalidPendingOwner));
        assert_eq!(ProgramError::Custom(0x11C), ProgramError::from(VaultError::UnauthorizedVaultCreator));
    }

    #[test]
    fn test_error_code_no_collision() {
        let codes = [
            VaultError::Unauthorized as u32,
            VaultError::InvalidSharePrice as u32,
            VaultError::InvalidAmount as u32,
            VaultError::OperatorsFull as u32,
            VaultError::OperatorNotFound as u32,
            VaultError::InvalidDiscriminator as u32,
            VaultError::MathOverflow as u32,
            VaultError::InsufficientFunds as u32,
            VaultError::DuplicateOperator as u32,
            VaultError::InvalidPendingDeposit as u32,
            VaultError::InvalidPendingWithdraw as u32,
            VaultError::FeeExceedsMaximum as u32,
            VaultError::NoFeesToCollect as u32,
            VaultError::InvalidMetadata as u32,
            VaultError::UnauthorizedInitializer as u32,
            VaultError::InvalidVaultName as u32,
            VaultError::VaultPaused as u32,
            VaultError::FactoryPaused as u32,
            VaultError::InvalidFactory as u32,
            VaultError::FactoryAdminsFull as u32,
            VaultError::FactoryAdminNotFound as u32,
            VaultError::DuplicateFactoryAdmin as u32,
            VaultError::NoPendingAdmin as u32,
            VaultError::InvalidPendingAdmin as u32,
            VaultError::PendingNotExpired as u32,
            VaultError::ZeroPubkey as u32,
            VaultError::NoPendingOwner as u32,
            VaultError::InvalidPendingOwner as u32,
            VaultError::UnauthorizedVaultCreator as u32,
        ];
        for i in 0..codes.len() {
            for j in (i + 1)..codes.len() {
                assert_ne!(codes[i], codes[j], "collision at index {} and {}", i, j);
            }
        }
    }
}
