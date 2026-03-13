use pinocchio::{
    account_info::AccountInfo,
    program_error::ProgramError,
    ProgramResult,
};

use crate::error::VaultError;
use crate::state::{VaultState, VAULT_DISCRIMINATOR};

/// Admin-only: add an operator to the vault.
///
/// Accounts:
///   0. `[signer]`    admin
///   1. `[writable]`  vault_state
///
/// Data:
///   [0]     discriminator (0x05)
///   [1..33] new_owner pubkey (32 bytes)
pub struct AddOwner<'a> {
    admin: &'a AccountInfo,
    vault_state: &'a AccountInfo,
    new_owner: [u8; 32],
}

impl<'a> AddOwner<'a> {
    pub const DISCRIMINATOR: u8 = 5;

    pub fn process(self) -> ProgramResult {
        let mut data = self.vault_state.try_borrow_mut_data()?;
        let state: &mut VaultState =
            bytemuck::from_bytes_mut(&mut data[..VaultState::LEN]);

        if !state.is_admin(self.admin.key()) {
            return Err(VaultError::Unauthorized.into());
        }

        if !state.add_owner(&self.new_owner) {
            // add_owner returns false for full list or duplicate
            let n = state.num_owners as usize;
            if n >= crate::state::MAX_OWNERS {
                return Err(VaultError::OwnersFull.into());
            }
            return Err(VaultError::DuplicateOwner.into());
        }

        Ok(())
    }
}

impl<'a> TryFrom<(&'a [u8], &'a [AccountInfo])> for AddOwner<'a> {
    type Error = ProgramError;

    fn try_from(
        (data, accounts): (&'a [u8], &'a [AccountInfo]),
    ) -> Result<Self, Self::Error> {
        let [admin, vault_state, ..] = accounts else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        if !admin.is_signer() {
            return Err(ProgramError::MissingRequiredSignature);
        }
        if !vault_state.is_writable() {
            return Err(ProgramError::InvalidAccountData);
        }
        if !vault_state.is_owned_by(&crate::ID) {
            return Err(ProgramError::IllegalOwner);
        }
        {
            let vdata = vault_state.try_borrow_data()?;
            if vdata.len() < VaultState::LEN || vdata[0] != VAULT_DISCRIMINATOR {
                return Err(VaultError::InvalidDiscriminator.into());
            }
        }

        if data.len() < 32 {
            return Err(ProgramError::InvalidInstructionData);
        }
        let mut new_owner = [0u8; 32];
        new_owner.copy_from_slice(&data[..32]);

        Ok(Self {
            admin,
            vault_state,
            new_owner,
        })
    }
}
