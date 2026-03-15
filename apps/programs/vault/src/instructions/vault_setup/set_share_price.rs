use pinocchio::{
    account_info::AccountInfo,
    program_error::ProgramError,
    ProgramResult,
};

use crate::error::VaultError;
use crate::state::{VaultState, VAULT_DISCRIMINATOR};

/// Admin-only: update the vault share price.
///
/// Accounts:
///   0. `[signer]`    admin
///   1. `[writable]`  vault_state
///
/// Data:
///   [0]    discriminator (0x03)
///   [1..9] new_share_price (u64 LE)
pub struct SetSharePrice<'a> {
    admin: &'a AccountInfo,
    vault_state: &'a AccountInfo,
    new_share_price: u64,
}

impl<'a> SetSharePrice<'a> {
    pub const DISCRIMINATOR: u8 = 3;

    pub fn process(self) -> ProgramResult {
        let mut data = self.vault_state.try_borrow_mut_data()?;
        let state: &mut VaultState =
            bytemuck::from_bytes_mut(&mut data[..VaultState::LEN]);

        if !state.is_admin(self.admin.key()) {
            return Err(VaultError::Unauthorized.into());
        }

        if state.paused() {
            return Err(VaultError::VaultPaused.into());
        }

        state.share_price = self.new_share_price;

        Ok(())
    }
}

impl<'a> TryFrom<(&'a [u8], &'a [AccountInfo])> for SetSharePrice<'a> {
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

        if data.len() < 8 {
            return Err(ProgramError::InvalidInstructionData);
        }
        let new_share_price = u64::from_le_bytes(
            data[..8]
                .try_into()
                .map_err(|_| ProgramError::InvalidInstructionData)?,
        );
        if new_share_price == 0 {
            return Err(VaultError::InvalidSharePrice.into());
        }

        Ok(Self {
            admin,
            vault_state,
            new_share_price,
        })
    }
}
