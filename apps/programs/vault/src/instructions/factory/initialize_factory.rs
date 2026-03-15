use pinocchio::{
    account_info::AccountInfo,
    instruction::{Seed, Signer},
    program_error::ProgramError,
    ProgramResult,
};
use pinocchio::pubkey::find_program_address;
use pinocchio_system::instructions::CreateAccount;

use crate::error::VaultError;
use crate::state::{FactoryState, FACTORY_DISCRIMINATOR};

/// Initialize the singleton factory state account.
///
/// Accounts:
///   0. `[signer]`           program_authority — must match PROGRAM_AUTHORITY constant
///   1. `[signer, writable]` owner — pays for account creation, becomes factory owner
///   2. `[writable]`         factory_state — PDA: ["factory"]
///   3. `[]`                 system_program
///
/// Data:
///   [0] discriminator (0x0D)
pub struct InitializeFactory<'a> {
    _program_authority: &'a AccountInfo,
    owner: &'a AccountInfo,
    factory_state: &'a AccountInfo,
    _system_program: &'a AccountInfo,
}

impl<'a> InitializeFactory<'a> {
    pub const DISCRIMINATOR: u8 = 0x0D;

    pub fn process(self) -> ProgramResult {
        // Derive factory PDA: seeds = ["factory"]
        let (expected_factory, factory_bump) = find_program_address(
            &[b"factory"],
            &crate::ID,
        );
        if self.factory_state.key() != &expected_factory {
            return Err(ProgramError::InvalidSeeds);
        }

        // Create factory state account (owner pays rent)
        let factory_bump_bytes = [factory_bump];
        let factory_seeds: [Seed; 2] = [
            Seed::from(b"factory" as &[u8]),
            Seed::from(&factory_bump_bytes),
        ];
        let factory_signers: [Signer; 1] = [Signer::from(&factory_seeds)];

        CreateAccount {
            from: self.owner,
            to: self.factory_state,
            lamports: crate::rent::minimum_balance(FactoryState::LEN),
            space: FactoryState::LEN as u64,
            owner: &crate::ID,
        }
        .invoke_signed(&factory_signers)?;

        // Write FactoryState
        let mut data = self.factory_state.try_borrow_mut_data()?;
        let state: &mut FactoryState =
            bytemuck::from_bytes_mut(&mut data[..FactoryState::LEN]);

        state.discriminator = FACTORY_DISCRIMINATOR;
        state.bump = factory_bump;
        state.is_paused = 0;
        state.num_admins = 0;
        state.owner = *self.owner.key();
        // pending_owner = [0; 32] (zeroed by CreateAccount)
        state.vault_count = 0;

        Ok(())
    }
}

impl<'a> TryFrom<(&'a [u8], &'a [AccountInfo])> for InitializeFactory<'a> {
    type Error = ProgramError;

    fn try_from(
        (_data, accounts): (&'a [u8], &'a [AccountInfo]),
    ) -> Result<Self, Self::Error> {
        let [program_authority, owner, factory_state, system_program, ..] = accounts else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        // Verify program authority is a signer and matches the hardcoded constant
        if !program_authority.is_signer() {
            return Err(ProgramError::MissingRequiredSignature);
        }
        if program_authority.key().as_ref() != &crate::PROGRAM_AUTHORITY {
            return Err(VaultError::UnauthorizedInitializer.into());
        }

        if !owner.is_signer() {
            return Err(ProgramError::MissingRequiredSignature);
        }
        if !owner.is_writable() || !factory_state.is_writable() {
            return Err(ProgramError::InvalidAccountData);
        }

        Ok(Self {
            _program_authority: program_authority,
            owner,
            factory_state,
            _system_program: system_program,
        })
    }
}
