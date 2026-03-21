#![no_std]

use pinocchio::{
    account_info::AccountInfo,
    program_error::ProgramError,
    pubkey::Pubkey,
    ProgramResult,
};
use pinocchio_pubkey::declare_id;

declare_id!("2jPr4HDqnzyHdEvwxJxq7NAmt67mEnmHyxhHtV1Cwz8C");

/// Program-level authority that must co-sign InitializeFactory.
/// Only this pubkey can create the factory. After factory creation,
/// vault creation is gated by factory admins/owner instead.
pub const PROGRAM_AUTHORITY: [u8; 32] = [
    0xd8, 0x5f, 0x49, 0xed, 0x0b, 0x7c, 0xd7, 0x5a,
    0xf9, 0xd8, 0xf9, 0x4b, 0xd4, 0xf4, 0x9f, 0xa6,
    0x9a, 0x31, 0xa1, 0xdb, 0xcd, 0x4b, 0x7a, 0x88,
    0x1d, 0xc0, 0xb1, 0xfd, 0x4f, 0x61, 0xfe, 0x1a,
]; // FZdLXHrkoFVyLcsmQ88TS3w9XKqkku1jFhpMaLkrNCqw

// For no_std: use program_entrypoint + nostd_panic_handler (not entrypoint! which needs std)
#[cfg(feature = "bpf-entrypoint")]
pinocchio::program_entrypoint!(process_instruction);
#[cfg(feature = "bpf-entrypoint")]
pinocchio::default_allocator!();
pinocchio::nostd_panic_handler!();

pub mod error;
pub mod fees;
pub mod instructions;
pub mod rent;
pub mod state;
pub mod sysvar;
pub mod token2022;

use instructions::{
    AcceptFactoryOwnership, AcceptVaultAdmin, AddFactoryAdmin, AddOperator,
    CancelDeposit, CancelWithdraw, CollectFees, DepositWithPrice, Execute,
    FulfillDeposit, FulfillWithdraw, Initialize, InitializeFactory,
    PauseFactory, PauseVault, RemoveFactoryAdmin, RemoveOperator,
    RequestDeposit, RequestWithdraw, SetSharePrice, TransferFactoryOwnership,
    TransferVaultAdmin, UnpauseFactory, UnpauseVault, UpdateFees,
    WithdrawWithPrice,
};

/// Route instructions by single-byte discriminator.
///
/// Instruction groups:
///   0x00–0x02: Setup (Initialize, AddOperator, RemoveOperator)
///   0x03–0x04: Admin Operations (SetSharePrice, Execute)
///   0x05–0x06: Fee Management (UpdateFees, CollectFees)
///   0x07–0x09: Deposit Flow (DepositWithPrice, RequestDeposit, FulfillDeposit)
///   0x0A–0x0C: Withdraw Flow (WithdrawWithPrice, RequestWithdraw, FulfillWithdraw)
///   0x0D–0x13: Factory Management
///   0x14–0x17: Vault Admin Transfer & Pause
///   0x18–0x19: Cancel (expired pending deposits/withdrawals)
pub fn process_instruction(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let (discriminator, data) = instruction_data
        .split_first()
        .ok_or(ProgramError::InvalidInstructionData)?;

    match discriminator {
        // Setup (0x00–0x02)
        &Initialize::DISCRIMINATOR => {
            Initialize::try_from((data, accounts))?.process()
        }
        &AddOperator::DISCRIMINATOR => {
            AddOperator::try_from((data, accounts))?.process()
        }
        &RemoveOperator::DISCRIMINATOR => {
            RemoveOperator::try_from((data, accounts))?.process()
        }
        // Admin Operations (0x03–0x04)
        &SetSharePrice::DISCRIMINATOR => {
            SetSharePrice::try_from((data, accounts))?.process()
        }
        &Execute::DISCRIMINATOR => {
            Execute::try_from((data, accounts))?.process()
        }
        // Fee Management (0x05–0x06)
        &UpdateFees::DISCRIMINATOR => {
            UpdateFees::try_from((data, accounts))?.process()
        }
        &CollectFees::DISCRIMINATOR => {
            CollectFees::try_from((data, accounts))?.process()
        }
        // Deposit Flow (0x07–0x09)
        &DepositWithPrice::DISCRIMINATOR => {
            DepositWithPrice::try_from((data, accounts))?.process()
        }
        &RequestDeposit::DISCRIMINATOR => {
            RequestDeposit::try_from((data, accounts))?.process()
        }
        &FulfillDeposit::DISCRIMINATOR => {
            FulfillDeposit::try_from((data, accounts))?.process()
        }
        // Withdraw Flow (0x0A–0x0C)
        &WithdrawWithPrice::DISCRIMINATOR => {
            WithdrawWithPrice::try_from((data, accounts))?.process()
        }
        &RequestWithdraw::DISCRIMINATOR => {
            RequestWithdraw::try_from((data, accounts))?.process()
        }
        &FulfillWithdraw::DISCRIMINATOR => {
            FulfillWithdraw::try_from((data, accounts))?.process()
        }
        // Factory Management (0x0D–0x13)
        &InitializeFactory::DISCRIMINATOR => {
            InitializeFactory::try_from((data, accounts))?.process()
        }
        &AddFactoryAdmin::DISCRIMINATOR => {
            AddFactoryAdmin::try_from((data, accounts))?.process()
        }
        &RemoveFactoryAdmin::DISCRIMINATOR => {
            RemoveFactoryAdmin::try_from((data, accounts))?.process()
        }
        &TransferFactoryOwnership::DISCRIMINATOR => {
            TransferFactoryOwnership::try_from((data, accounts))?.process()
        }
        &AcceptFactoryOwnership::DISCRIMINATOR => {
            AcceptFactoryOwnership::try_from((data, accounts))?.process()
        }
        &PauseFactory::DISCRIMINATOR => {
            PauseFactory::try_from((data, accounts))?.process()
        }
        &UnpauseFactory::DISCRIMINATOR => {
            UnpauseFactory::try_from((data, accounts))?.process()
        }
        // Vault Admin Transfer & Pause (0x14–0x17)
        &TransferVaultAdmin::DISCRIMINATOR => {
            TransferVaultAdmin::try_from((data, accounts))?.process()
        }
        &AcceptVaultAdmin::DISCRIMINATOR => {
            AcceptVaultAdmin::try_from((data, accounts))?.process()
        }
        &PauseVault::DISCRIMINATOR => {
            PauseVault::try_from((data, accounts))?.process()
        }
        &UnpauseVault::DISCRIMINATOR => {
            UnpauseVault::try_from((data, accounts))?.process()
        }
        // Cancel (0x18–0x19)
        &CancelDeposit::DISCRIMINATOR => {
            CancelDeposit::try_from((data, accounts))?.process()
        }
        &CancelWithdraw::DISCRIMINATOR => {
            CancelWithdraw::try_from((data, accounts))?.process()
        }
        _ => Err(ProgramError::InvalidInstructionData),
    }
}
