#![no_std]

use pinocchio::{
    account_info::AccountInfo,
    program_error::ProgramError,
    pubkey::Pubkey,
    ProgramResult,
};
use pinocchio_pubkey::declare_id;

// TODO: Replace with actual deployed program address
declare_id!("5yY17NisfXbyjanUEBxrdKsSCuRiWcjzEt6LXGZqDiVR");

// TODO: Replace with actual program authority keypair before mainnet deploy
/// Program-level authority that must co-sign InitializeFactory.
/// Only this pubkey can create the factory. After factory creation,
/// vault creation is gated by factory admins/owner instead.
pub const PROGRAM_AUTHORITY: [u8; 32] = [
    0x81, 0x32, 0xa0, 0xfa, 0xd9, 0xdd, 0x12, 0xed,
    0x58, 0x50, 0xf2, 0xc2, 0x29, 0x0b, 0x7d, 0x5f,
    0xd8, 0x10, 0x99, 0xd7, 0x81, 0x1d, 0x44, 0xd7,
    0x0b, 0x67, 0x32, 0xc5, 0xce, 0x52, 0xf7, 0x16,
]; // 9hLNRfyFw32aU6xyKZHSUSJt3N2QC9oen8HDqPyJ3Ryf

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
