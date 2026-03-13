use pinocchio::{
    account_info::AccountInfo,
    instruction::{Seed, Signer},
    program_error::ProgramError,
    ProgramResult,
};
use pinocchio_token::instructions::{Burn, Transfer};

use crate::error::VaultError;
use crate::state::{VaultState, VAULT_DISCRIMINATOR};

/// Withdraw base tokens from the vault by burning share tokens.
///
/// base_to_return = shares_to_burn * share_price / 10^share_decimals
///
/// Accounts:
///   0. `[signer]`    withdrawer
///   1. `[writable]`  withdrawer_share_ata — shares to burn
///   2. `[writable]`  share_mint           — share token mint
///   3. `[writable]`  vault_base_ata       — vault's base token account
///   4. `[writable]`  withdrawer_base_ata  — receives base tokens
///   5. `[]`          vault_state          — PDA with vault config
///   6. `[]`          token_program
///
/// Data:
///   [0]    discriminator (0x02)
///   [1..9] shares (u64 LE) — share tokens to burn
pub struct Withdraw<'a> {
    withdrawer: &'a AccountInfo,
    withdrawer_share_ata: &'a AccountInfo,
    share_mint: &'a AccountInfo,
    vault_base_ata: &'a AccountInfo,
    withdrawer_base_ata: &'a AccountInfo,
    vault_state: &'a AccountInfo,
    _token_program: &'a AccountInfo,
    shares: u64,
}

impl<'a> Withdraw<'a> {
    pub const DISCRIMINATOR: u8 = 2;

    pub fn process(self) -> ProgramResult {
        // Read vault state
        let data = self.vault_state.try_borrow_data()?;
        let state: &VaultState = bytemuck::from_bytes(&data[..VaultState::LEN]);

        if state.share_mint != *self.share_mint.key() {
            return Err(ProgramError::InvalidAccountData);
        }

        // Calculate base tokens to return: shares * share_price / 10^share_decimals
        let share_multiplier = 10u64
            .checked_pow(state.share_decimals as u32)
            .ok_or(VaultError::MathOverflow)?;
        let base_amount = self
            .shares
            .checked_mul(state.share_price)
            .ok_or(VaultError::MathOverflow)?
            .checked_div(share_multiplier)
            .ok_or(VaultError::MathOverflow)?;

        if base_amount == 0 {
            return Err(VaultError::InvalidAmount.into());
        }

        let vault_bump = state.bump;
        let admin_bytes = state.admin;
        let base_mint_bytes = state.base_mint;

        // Drop borrow before CPI
        drop(data);

        // Burn share tokens from withdrawer
        Burn {
            account: self.withdrawer_share_ata,
            mint: self.share_mint,
            authority: self.withdrawer,
            amount: self.shares,
        }
        .invoke()?;

        // Transfer base tokens: vault → withdrawer (vault_state PDA signs)
        let vault_bump_bytes = [vault_bump];
        let seeds: [Seed; 4] = [
            Seed::from(b"vault" as &[u8]),
            Seed::from(&admin_bytes),
            Seed::from(&base_mint_bytes),
            Seed::from(&vault_bump_bytes),
        ];
        let signers: [Signer; 1] = [Signer::from(&seeds)];

        Transfer {
            from: self.vault_base_ata,
            to: self.withdrawer_base_ata,
            authority: self.vault_state,
            amount: base_amount,
        }
        .invoke_signed(&signers)?;

        Ok(())
    }
}

impl<'a> TryFrom<(&'a [u8], &'a [AccountInfo])> for Withdraw<'a> {
    type Error = ProgramError;

    fn try_from(
        (data, accounts): (&'a [u8], &'a [AccountInfo]),
    ) -> Result<Self, Self::Error> {
        let [withdrawer, withdrawer_share_ata, share_mint, vault_base_ata, withdrawer_base_ata, vault_state, token_program, ..] =
            accounts
        else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        if !withdrawer.is_signer() {
            return Err(ProgramError::MissingRequiredSignature);
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
        let shares = u64::from_le_bytes(
            data[..8]
                .try_into()
                .map_err(|_| ProgramError::InvalidInstructionData)?,
        );
        if shares == 0 {
            return Err(VaultError::InvalidAmount.into());
        }

        Ok(Self {
            withdrawer,
            withdrawer_share_ata,
            share_mint,
            vault_base_ata,
            withdrawer_base_ata,
            vault_state,
            _token_program: token_program,
            shares,
        })
    }
}
