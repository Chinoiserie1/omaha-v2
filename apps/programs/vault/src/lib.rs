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
/// Program-level authority that must co-sign Initialize instructions.
/// Only this pubkey can authorize new vault creation.
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
pub mod token2022;

use instructions::{
    AddOwner, CollectFees, DepositWithPrice, Execute, FulfillDeposit, FulfillWithdraw,
    Initialize, RemoveOwner, RequestDeposit, RequestWithdraw, SetSharePrice, UpdateFees,
    WithdrawWithPrice,
};

/// Route instructions by single-byte discriminator.
///
/// Instruction groups:
///   0–2:   Setup (Initialize, AddOwner, RemoveOwner)
///   3–4:   Admin Operations (SetSharePrice, Execute)
///   5–6:   Fee Management (UpdateFees, CollectFees)
///   7–9:   Deposit Flow (DepositWithPrice, RequestDeposit, FulfillDeposit)
///   10–12: Withdraw Flow (WithdrawWithPrice, RequestWithdraw, FulfillWithdraw)
pub fn process_instruction(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let (discriminator, data) = instruction_data
        .split_first()
        .ok_or(ProgramError::InvalidInstructionData)?;

    match discriminator {
        // Setup (0–2)
        &Initialize::DISCRIMINATOR => {
            Initialize::try_from((data, accounts))?.process()
        }
        &AddOwner::DISCRIMINATOR => {
            AddOwner::try_from((data, accounts))?.process()
        }
        &RemoveOwner::DISCRIMINATOR => {
            RemoveOwner::try_from((data, accounts))?.process()
        }
        // Admin Operations (3–4)
        &SetSharePrice::DISCRIMINATOR => {
            SetSharePrice::try_from((data, accounts))?.process()
        }
        &Execute::DISCRIMINATOR => {
            Execute::try_from((data, accounts))?.process()
        }
        // Fee Management (5–6)
        &UpdateFees::DISCRIMINATOR => {
            UpdateFees::try_from((data, accounts))?.process()
        }
        &CollectFees::DISCRIMINATOR => {
            CollectFees::try_from((data, accounts))?.process()
        }
        // Deposit Flow (7–9)
        &DepositWithPrice::DISCRIMINATOR => {
            DepositWithPrice::try_from((data, accounts))?.process()
        }
        &RequestDeposit::DISCRIMINATOR => {
            RequestDeposit::try_from((data, accounts))?.process()
        }
        &FulfillDeposit::DISCRIMINATOR => {
            FulfillDeposit::try_from((data, accounts))?.process()
        }
        // Withdraw Flow (10–12)
        &WithdrawWithPrice::DISCRIMINATOR => {
            WithdrawWithPrice::try_from((data, accounts))?.process()
        }
        &RequestWithdraw::DISCRIMINATOR => {
            RequestWithdraw::try_from((data, accounts))?.process()
        }
        &FulfillWithdraw::DISCRIMINATOR => {
            FulfillWithdraw::try_from((data, accounts))?.process()
        }
        _ => Err(ProgramError::InvalidInstructionData),
    }
}
