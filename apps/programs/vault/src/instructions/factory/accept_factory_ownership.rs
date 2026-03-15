use pinocchio::{
    account_info::AccountInfo,
    program_error::ProgramError,
    ProgramResult,
};

use crate::error::VaultError;
use crate::state::{FactoryState, FACTORY_DISCRIMINATOR};

/// Pending owner: accept ownership of the factory (2-step transfer).
///
/// Accounts:
///   0. `[signer]`    new_owner — must match factory_state.pending_owner
///   1. `[writable]`  factory_state
///
/// Data:
///   [0] discriminator (0x11)
pub struct AcceptFactoryOwnership<'a> {
    new_owner: &'a AccountInfo,
    factory_state: &'a AccountInfo,
}

impl<'a> AcceptFactoryOwnership<'a> {
    pub const DISCRIMINATOR: u8 = 0x11;

    pub fn process(self) -> ProgramResult {
        let mut data = self.factory_state.try_borrow_mut_data()?;
        let state: &mut FactoryState =
            bytemuck::from_bytes_mut(&mut data[..FactoryState::LEN]);

        if state.pending_owner == [0u8; 32] {
            return Err(VaultError::NoPendingOwner.into());
        }

        if state.pending_owner != *self.new_owner.key() {
            return Err(VaultError::InvalidPendingOwner.into());
        }

        state.owner = state.pending_owner;
        state.pending_owner = [0u8; 32];

        Ok(())
    }
}

impl<'a> TryFrom<(&'a [u8], &'a [AccountInfo])> for AcceptFactoryOwnership<'a> {
    type Error = ProgramError;

    fn try_from(
        (_data, accounts): (&'a [u8], &'a [AccountInfo]),
    ) -> Result<Self, Self::Error> {
        let [new_owner, factory_state, ..] = accounts else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        if !new_owner.is_signer() {
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
            new_owner,
            factory_state,
        })
    }
}
