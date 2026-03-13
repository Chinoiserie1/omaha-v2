// --- Setup (0–2) ---
pub mod initialize;
pub mod add_owner;
pub mod remove_owner;

// --- Admin Operations (3–4) ---
pub mod set_share_price;
pub mod execute;

// --- Fee Management (5–6) ---
pub mod update_fees;
pub mod collect_fees;

// --- Deposit Flow (7–9) ---
pub mod deposit_with_price;
pub mod request_deposit;
pub mod fulfill_deposit;

// --- Withdraw Flow (10–12) ---
pub mod withdraw_with_price;
pub mod request_withdraw;
pub mod fulfill_withdraw;

pub use initialize::Initialize;
pub use add_owner::AddOwner;
pub use remove_owner::RemoveOwner;
pub use set_share_price::SetSharePrice;
pub use execute::Execute;
pub use update_fees::UpdateFees;
pub use collect_fees::CollectFees;
pub use deposit_with_price::DepositWithPrice;
pub use request_deposit::RequestDeposit;
pub use fulfill_deposit::FulfillDeposit;
pub use withdraw_with_price::WithdrawWithPrice;
pub use request_withdraw::RequestWithdraw;
pub use fulfill_withdraw::FulfillWithdraw;
