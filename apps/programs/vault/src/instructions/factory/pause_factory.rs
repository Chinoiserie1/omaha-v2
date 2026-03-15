use pinocchio::{
    account_info::AccountInfo,
    program_error::ProgramError,
    ProgramResult,
};

use crate::error::VaultError;
use crate::state::{FactoryState, FACTORY_DISCRIMINATOR};

/// Factory owner: pause all factory-gated operations.
///
/// Accounts:
///   0. `[signer]`    owner
///   1. `[writable]`  factory_state
///
/// Data:
///   [0] discriminator (0x12)
pub struct PauseFactory<'a> {
    owner: &'a AccountInfo,
    factory_state: &'a AccountInfo,
}

impl<'a> PauseFactory<'a> {
    pub const DISCRIMINATOR: u8 = 0x12;

    pub fn process(self) -> ProgramResult {
        let mut data = self.factory_state.try_borrow_mut_data()?;
        let state: &mut FactoryState =
            bytemuck::from_bytes_mut(&mut data[..FactoryState::LEN]);

        if !state.is_owner(self.owner.key()) {
            return Err(VaultError::Unauthorized.into());
        }

        state.is_paused = 1;

        Ok(())
    }
}

impl<'a> TryFrom<(&'a [u8], &'a [AccountInfo])> for PauseFactory<'a> {
    type Error = ProgramError;

    fn try_from(
        (_data, accounts): (&'a [u8], &'a [AccountInfo]),
    ) -> Result<Self, Self::Error> {
        let [owner, factory_state, ..] = accounts else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        if !owner.is_signer() {
            return Err(ProgramError::MissingRequiredSignature);
        }
        if !factory_state.is_writable() {
            return Err(ProgramError::InvalidAccountData);
        }
        if !factory_state.is_owned_by(&crate::ID) {
            return Err(ProgramError::IllegalOwner);
        }
        {
            let fdata = factory_state.try_borrow_data()?;
            if fdata.len() < FactoryState::LEN || fdata[0] != FACTORY_DISCRIMINATOR {
                return Err(VaultError::InvalidFactory.into());
            }
        }

        Ok(Self {
            owner,
            factory_state,
        })
    }
}
