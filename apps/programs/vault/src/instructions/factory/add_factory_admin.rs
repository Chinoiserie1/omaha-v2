use pinocchio::{
    account_info::AccountInfo,
    program_error::ProgramError,
    ProgramResult,
};

use crate::error::VaultError;
use crate::state::{FactoryState, FACTORY_DISCRIMINATOR, is_zero_pubkey};

/// Factory owner: add an admin to the factory.
///
/// Accounts:
///   0. `[signer]`    owner
///   1. `[writable]`  factory_state
///
/// Data:
///   [0]     discriminator (0x0E)
///   [1..33] new_admin pubkey (32 bytes)
pub struct AddFactoryAdmin<'a> {
    owner: &'a AccountInfo,
    factory_state: &'a AccountInfo,
    new_admin: [u8; 32],
}

impl<'a> AddFactoryAdmin<'a> {
    pub const DISCRIMINATOR: u8 = 0x0E;

    pub fn process(self) -> ProgramResult {
        let mut data = self.factory_state.try_borrow_mut_data()?;
        let state: &mut FactoryState =
            bytemuck::from_bytes_mut(&mut data[..FactoryState::LEN]);

        if !state.is_owner(self.owner.key()) {
            return Err(VaultError::Unauthorized.into());
        }

        if !state.add_admin(&self.new_admin) {
            let n = state.num_admins as usize;
            if n >= crate::state::MAX_FACTORY_ADMINS {
                return Err(VaultError::FactoryAdminsFull.into());
            }
            return Err(VaultError::DuplicateFactoryAdmin.into());
        }

        Ok(())
    }
}

impl<'a> TryFrom<(&'a [u8], &'a [AccountInfo])> for AddFactoryAdmin<'a> {
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
        let mut new_admin = [0u8; 32];
        new_admin.copy_from_slice(&data[..32]);

        if is_zero_pubkey(&new_admin) {
            return Err(VaultError::ZeroPubkey.into());
        }

        Ok(Self {
            owner,
            factory_state,
            new_admin,
        })
    }
}
