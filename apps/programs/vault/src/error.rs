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
}

impl From<VaultError> for ProgramError {
    fn from(e: VaultError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
