use pinocchio::{
    account_info::AccountInfo,
    program_error::ProgramError,
    ProgramResult,
};

use crate::error::VaultError;
use crate::state::{FactoryState, FACTORY_DISCRIMINATOR};

/// Factory owner: remove an admin from the factory.
///
/// Accounts:
///   0. `[signer]`    owner
///   1. `[writable]`  factory_state
///
/// Data:
///   [0]     discriminator (0x0F)
///   [1..33] admin_to_remove pubkey (32 bytes)
pub struct RemoveFactoryAdmin<'a> {
    owner: &'a AccountInfo,
    factory_state: &'a AccountInfo,
    admin_to_remove: [u8; 32],
}

impl<'a> RemoveFactoryAdmin<'a> {
    pub const DISCRIMINATOR: u8 = 0x0F;

    pub fn process(self) -> ProgramResult {
        let mut data = self.factory_state.try_borrow_mut_data()?;
        let state: &mut FactoryState =
            bytemuck::from_bytes_mut(&mut data[..FactoryState::LEN]);

        if !state.is_owner(self.owner.key()) {
            return Err(VaultError::Unauthorized.into());
        }

        if !state.remove_admin(&self.admin_to_remove) {
            return Err(VaultError::FactoryAdminNotFound.into());
        }

        Ok(())
    }
}

impl<'a> TryFrom<(&'a [u8], &'a [AccountInfo])> for RemoveFactoryAdmin<'a> {
    type Error = ProgramError;

    fn try_from(
        (data, accounts): (&'a [u8], &'a [AccountInfo]),
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

        if data.len() < 32 {
            return Err(ProgramError::InvalidInstructionData);
        }
        let mut admin_to_remove = [0u8; 32];
        admin_to_remove.copy_from_slice(&data[..32]);

        Ok(Self {
            owner,
            factory_state,
            admin_to_remove,
        })
    }
}
