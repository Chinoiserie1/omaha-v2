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

// For no_std: use program_entrypoint + nostd_panic_handler (not entrypoint! which needs std)
#[cfg(feature = "bpf-entrypoint")]
pinocchio::program_entrypoint!(process_instruction);
#[cfg(feature = "bpf-entrypoint")]
pinocchio::default_allocator!();
pinocchio::nostd_panic_handler!();

pub mod error;
pub mod instructions;
pub mod rent;
pub mod state;

use instructions::{
    AddOwner, Deposit, Execute, Initialize, RemoveOwner, SetSharePrice, Withdraw,
};

/// Route instructions by single-byte discriminator.
pub fn process_instruction(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let (discriminator, data) = instruction_data
        .split_first()
        .ok_or(ProgramError::InvalidInstructionData)?;

    match discriminator {
        &Initialize::DISCRIMINATOR => {
            Initialize::try_from((data, accounts))?.process()
        }
        &Deposit::DISCRIMINATOR => {
            Deposit::try_from((data, accounts))?.process()
        }
        &Withdraw::DISCRIMINATOR => {
            Withdraw::try_from((data, accounts))?.process()
        }
        &SetSharePrice::DISCRIMINATOR => {
            SetSharePrice::try_from((data, accounts))?.process()
        }
        &Execute::DISCRIMINATOR => {
            Execute::try_from((data, accounts))?.process()
        }
        &AddOwner::DISCRIMINATOR => {
            AddOwner::try_from((data, accounts))?.process()
        }
        &RemoveOwner::DISCRIMINATOR => {
            RemoveOwner::try_from((data, accounts))?.process()
        }
        _ => Err(ProgramError::InvalidInstructionData),
    }
}
