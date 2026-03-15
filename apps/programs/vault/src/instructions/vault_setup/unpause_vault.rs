use pinocchio::{
    account_info::AccountInfo,
    program_error::ProgramError,
    ProgramResult,
};

use crate::error::VaultError;
use crate::state::{FactoryState, VaultState, FACTORY_DISCRIMINATOR, VAULT_DISCRIMINATOR};

/// Unpause the vault. Authorized by either the vault admin or the factory owner.
///
/// Accounts:
///   0. `[signer]`    authority (vault admin OR factory owner)
///   1. `[writable]`  vault_state
///   2. `[]`          factory_state (optional — required when authority is factory owner)
///
/// Data:
///   [0] discriminator (0x17)
pub struct UnpauseVault<'a> {
    authority: &'a AccountInfo,
    vault_state: &'a AccountInfo,
    factory_state: Option<&'a AccountInfo>,
}

impl<'a> UnpauseVault<'a> {
    pub const DISCRIMINATOR: u8 = 0x17;

    pub fn process(self) -> ProgramResult {
        let mut data = self.vault_state.try_borrow_mut_data()?;
        let state: &mut VaultState =
            bytemuck::from_bytes_mut(&mut data[..VaultState::LEN]);

        if !state.is_admin(self.authority.key()) {
            match self.factory_state {
                Some(factory_account) => {
                    let fdata = factory_account.try_borrow_data()?;
                    let factory: &FactoryState =
                        bytemuck::from_bytes(&fdata[..FactoryState::LEN]);
                    if !factory.is_owner(self.authority.key()) {
                        return Err(VaultError::Unauthorized.into());
                    }
                }
                None => {
                    return Err(VaultError::Unauthorized.into());
                }
            }
        }

        state.is_paused = 0;

        Ok(())
    }
}

impl<'a> TryFrom<(&'a [u8], &'a [AccountInfo])> for UnpauseVault<'a> {
    type Error = ProgramError;

    fn try_from(
        (_data, accounts): (&'a [u8], &'a [AccountInfo]),
    ) -> Result<Self, Self::Error> {
        let [authority, vault_state, ..] = accounts else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        if !authority.is_signer() {
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

        let factory_state = match accounts.get(2) {
            Some(factory_account) => {
                if !factory_account.is_owned_by(&crate::ID) {
                    return Err(VaultError::InvalidFactory.into());
                }
                {
                    let fdata = factory_account.try_borrow_data()?;
                    if fdata.len() < FactoryState::LEN || fdata[0] != FACTORY_DISCRIMINATOR {
                        return Err(VaultError::InvalidDiscriminator.into());
                    }
                }
                Some(factory_account)
            }
            None => None,
        };

        Ok(Self {
            authority,
            vault_state,
            factory_state,
        })
    }
}
