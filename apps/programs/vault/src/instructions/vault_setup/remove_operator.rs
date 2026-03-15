use pinocchio::{
    account_info::AccountInfo,
    program_error::ProgramError,
    ProgramResult,
};

use crate::error::VaultError;
use crate::state::{VaultState, VAULT_DISCRIMINATOR};

/// Admin-only: remove an operator from the vault.
///
/// Accounts:
///   0. `[signer]`    admin
///   1. `[writable]`  vault_state
///
/// Data:
///   [0]     discriminator (0x02)
///   [1..33] operator_to_remove pubkey (32 bytes)
pub struct RemoveOperator<'a> {
    admin: &'a AccountInfo,
    vault_state: &'a AccountInfo,
    operator_to_remove: [u8; 32],
}

impl<'a> RemoveOperator<'a> {
    pub const DISCRIMINATOR: u8 = 2;

    pub fn process(self) -> ProgramResult {
        let mut data = self.vault_state.try_borrow_mut_data()?;
        let state: &mut VaultState =
            bytemuck::from_bytes_mut(&mut data[..VaultState::LEN]);

        if state.paused() {
            return Err(VaultError::VaultPaused.into());
        }

        if !state.is_admin(self.admin.key()) {
            return Err(VaultError::Unauthorized.into());
        }

        if !state.remove_operator(&self.operator_to_remove) {
            return Err(VaultError::OperatorNotFound.into());
        }

        Ok(())
    }
}

impl<'a> TryFrom<(&'a [u8], &'a [AccountInfo])> for RemoveOperator<'a> {
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
        let mut operator_to_remove = [0u8; 32];
        operator_to_remove.copy_from_slice(&data[..32]);

        Ok(Self {
            admin,
            vault_state,
            operator_to_remove,
        })
    }
}
