use pinocchio::{
    account_info::AccountInfo,
    program_error::ProgramError,
    ProgramResult,
};

use crate::error::VaultError;
use crate::state::{VaultState, VAULT_DISCRIMINATOR};

/// Accept a pending vault admin transfer (2-step admin handover).
///
/// Accounts:
///   0. `[signer]`    new_admin (the pending admin accepting ownership)
///   1. `[writable]`  vault_state
///
/// Data:
///   [0] discriminator (0x15)
pub struct AcceptVaultAdmin<'a> {
    new_admin: &'a AccountInfo,
    vault_state: &'a AccountInfo,
}

impl<'a> AcceptVaultAdmin<'a> {
    pub const DISCRIMINATOR: u8 = 0x15;

    pub fn process(self) -> ProgramResult {
        let mut data = self.vault_state.try_borrow_mut_data()?;
        let state: &mut VaultState =
            bytemuck::from_bytes_mut(&mut data[..VaultState::LEN]);

        if state.pending_admin == [0u8; 32] {
            return Err(VaultError::NoPendingAdmin.into());
        }

        if state.pending_admin != *self.new_admin.key() {
            return Err(VaultError::InvalidPendingAdmin.into());
        }

        state.admin = state.pending_admin;
        state.pending_admin = [0u8; 32];

        Ok(())
    }
}

impl<'a> TryFrom<(&'a [u8], &'a [AccountInfo])> for AcceptVaultAdmin<'a> {
    type Error = ProgramError;

    fn try_from(
        (_data, accounts): (&'a [u8], &'a [AccountInfo]),
    ) -> Result<Self, Self::Error> {
        let [new_admin, vault_state, ..] = accounts else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        if !new_admin.is_signer() {
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

        Ok(Self {
            new_admin,
            vault_state,
        })
    }
}
