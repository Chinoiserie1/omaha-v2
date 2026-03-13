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
    /// Owner list is full (max 10).
    OwnersFull = 0x103,
    /// Owner already exists or not found.
    OwnerNotFound = 0x104,
    /// Vault account has wrong discriminator.
    InvalidDiscriminator = 0x105,
    /// Arithmetic overflow during share calculation.
    MathOverflow = 0x106,
    /// Vault has insufficient base-token balance.
    InsufficientFunds = 0x107,
    /// Duplicate owner.
    DuplicateOwner = 0x108,
    /// Pending deposit account has wrong discriminator or is invalid.
    InvalidPendingDeposit = 0x109,
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
        assert_eq!(
            ProgramError::Custom(0x100),
            ProgramError::from(VaultError::Unauthorized)
        );
        assert_eq!(
            ProgramError::Custom(0x101),
            ProgramError::from(VaultError::InvalidSharePrice)
        );
        assert_eq!(
            ProgramError::Custom(0x102),
            ProgramError::from(VaultError::InvalidAmount)
        );
        assert_eq!(
            ProgramError::Custom(0x103),
            ProgramError::from(VaultError::OwnersFull)
        );
        assert_eq!(
            ProgramError::Custom(0x104),
            ProgramError::from(VaultError::OwnerNotFound)
        );
        assert_eq!(
            ProgramError::Custom(0x105),
            ProgramError::from(VaultError::InvalidDiscriminator)
        );
        assert_eq!(
            ProgramError::Custom(0x106),
            ProgramError::from(VaultError::MathOverflow)
        );
        assert_eq!(
            ProgramError::Custom(0x107),
            ProgramError::from(VaultError::InsufficientFunds)
        );
        assert_eq!(
            ProgramError::Custom(0x108),
            ProgramError::from(VaultError::DuplicateOwner)
        );
        assert_eq!(
            ProgramError::Custom(0x109),
            ProgramError::from(VaultError::InvalidPendingDeposit)
        );
    }

    #[test]
    fn test_error_code_no_collision() {
        let codes = [
            VaultError::Unauthorized as u32,
            VaultError::InvalidSharePrice as u32,
            VaultError::InvalidAmount as u32,
            VaultError::OwnersFull as u32,
            VaultError::OwnerNotFound as u32,
            VaultError::InvalidDiscriminator as u32,
            VaultError::MathOverflow as u32,
            VaultError::InsufficientFunds as u32,
            VaultError::DuplicateOwner as u32,
            VaultError::InvalidPendingDeposit as u32,
        ];
        for i in 0..codes.len() {
            for j in (i + 1)..codes.len() {
                assert_ne!(codes[i], codes[j], "collision at index {} and {}", i, j);
            }
        }
    }

    #[test]
    fn test_error_codes_start_at_0x100() {
        assert_eq!(VaultError::Unauthorized as u32, 0x100);
        // All error codes should be >= 0x100 to avoid collision with built-in ProgramError
        assert!(VaultError::DuplicateOwner as u32 >= 0x100);
    }
}
