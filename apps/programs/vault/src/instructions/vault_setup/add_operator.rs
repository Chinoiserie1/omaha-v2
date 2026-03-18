use pinocchio::{
    account_info::AccountInfo,
    program_error::ProgramError,
    ProgramResult,
};

use crate::error::VaultError;
use crate::state::{VaultState, VAULT_DISCRIMINATOR, is_zero_pubkey};

/// Admin-only: add an operator to the vault.
///
/// Accounts:
///   0. `[signer]`    admin
///   1. `[writable]`  vault_state
///
/// Data:
///   [0]     discriminator (0x01)
///   [1..33] new_operator pubkey (32 bytes)
pub struct AddOperator<'a> {
    admin: &'a AccountInfo,
    vault_state: &'a AccountInfo,
    new_operator: [u8; 32],
}

impl<'a> AddOperator<'a> {
    pub const DISCRIMINATOR: u8 = 1;

    pub fn process(self) -> ProgramResult {
        let mut data = self.vault_state.try_borrow_mut_data()?;
        let state: &mut VaultState =
            bytemuck::from_bytes_mut(&mut data[..VaultState::LEN]);

        if !state.is_admin(self.admin.key()) {
            return Err(VaultError::Unauthorized.into());
        }

        if is_zero_pubkey(&self.new_operator) {
            return Err(VaultError::ZeroPubkey.into());
        }

        if !state.add_operator(&self.new_operator) {
            let n = state.num_operators as usize;
            if n >= crate::state::MAX_OPERATORS {
                return Err(VaultError::OperatorsFull.into());
            }
            return Err(VaultError::DuplicateOperator.into());
        }

        Ok(())
    }
}

impl<'a> TryFrom<(&'a [u8], &'a [AccountInfo])> for AddOperator<'a> {
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
        let mut new_operator = [0u8; 32];
        new_operator.copy_from_slice(&data[..32]);

        Ok(Self {
            admin,
            vault_state,
            new_operator,
        })
    }
}
