use pinocchio::{
    account_info::AccountInfo,
    program_error::ProgramError,
    ProgramResult,
};

use crate::error::VaultError;
use crate::state::{is_zero_pubkey, VaultState, VAULT_DISCRIMINATOR};

/// Admin-only: initiate a 2-step vault admin transfer.
///
/// Accounts:
///   0. `[signer]`    admin
///   1. `[writable]`  vault_state
///
/// Data:
///   [0]     discriminator (0x14)
///   [1..33] new_admin pubkey (32 bytes)
pub struct TransferVaultAdmin<'a> {
    admin: &'a AccountInfo,
    vault_state: &'a AccountInfo,
    new_admin: [u8; 32],
}

impl<'a> TransferVaultAdmin<'a> {
    pub const DISCRIMINATOR: u8 = 0x14;

    pub fn process(self) -> ProgramResult {
        let mut data = self.vault_state.try_borrow_mut_data()?;
        let state: &mut VaultState =
            bytemuck::from_bytes_mut(&mut data[..VaultState::LEN]);

        if !state.is_admin(self.admin.key()) {
            return Err(VaultError::Unauthorized.into());
        }

        state.pending_admin = self.new_admin;

        Ok(())
    }
}

impl<'a> TryFrom<(&'a [u8], &'a [AccountInfo])> for TransferVaultAdmin<'a> {
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
        let mut new_admin = [0u8; 32];
        new_admin.copy_from_slice(&data[..32]);

        if is_zero_pubkey(&new_admin) {
            return Err(VaultError::ZeroPubkey.into());
        }

        Ok(Self {
            admin,
            vault_state,
            new_admin,
        })
    }
}
