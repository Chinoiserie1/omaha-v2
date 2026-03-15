// --- Factory Management (0x0D–0x13) ---
pub mod factory;

// --- Vault Setup & Lifecycle (0x00–0x04, 0x14–0x17) ---
pub mod vault_setup;

// --- Deposit Flow (0x07–0x09, 0x18) ---
pub mod deposit;

// --- Withdraw Flow (0x0A–0x0C, 0x19) ---
pub mod withdraw;

// --- Fee Management (0x05–0x06) ---
pub mod fees;

// Re-export all instruction structs for backwards compatibility.
// `lib.rs` imports from `instructions::{StructName}` — these re-exports
// ensure that path continues to resolve after the subdirectory refactor.

// Factory
pub use factory::{
    AcceptFactoryOwnership, AddFactoryAdmin, InitializeFactory, PauseFactory,
    RemoveFactoryAdmin, TransferFactoryOwnership, UnpauseFactory,
};

// Vault setup
pub use vault_setup::{
    AcceptVaultAdmin, AddOperator, Execute, Initialize, PauseVault, RemoveOperator,
    SetSharePrice, TransferVaultAdmin, UnpauseVault,
};

// Deposit
pub use deposit::{CancelDeposit, DepositWithPrice, FulfillDeposit, RequestDeposit};

// Withdraw
pub use withdraw::{CancelWithdraw, FulfillWithdraw, RequestWithdraw, WithdrawWithPrice};

// Fees
pub use fees::{CollectFees, UpdateFees};
