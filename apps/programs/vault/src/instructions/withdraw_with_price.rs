use pinocchio::{
    account_info::AccountInfo,
    instruction::{Seed, Signer},
    program_error::ProgramError,
    ProgramResult,
};
use pinocchio_token::instructions::{Burn, Transfer};

use crate::error::VaultError;
use crate::state::{VaultState, VAULT_DISCRIMINATOR};

/// Admin-only: set share price and withdraw in a single atomic instruction.
///
/// The admin sets the new share price, then shares are burned from the
/// withdrawer and base tokens are transferred from the vault at the new
/// price. If exit fees are configured, the fee amount stays in the vault.
///
/// Accounts:
///   0. `[signer]`    admin              — must be vault admin
///   1. `[signer]`    withdrawer         — authorizes share burn
///   2. `[writable]`  withdrawer_share_ata — shares to burn
///   3. `[writable]`  share_mint         — share token mint
///   4. `[writable]`  vault_base_ata     — vault's base token account
///   5. `[writable]`  withdrawer_base_ata — receives base tokens
///   6. `[writable]`  vault_state        — PDA with vault config (price updated)
///   7. `[]`          token_program
///
/// Data:
///   [0]     discriminator (0x0A)
///   [1..9]  new_share_price (u64 LE)
///   [9..17] shares_to_burn (u64 LE)
pub struct WithdrawWithPrice<'a> {
    admin: &'a AccountInfo,
    withdrawer: &'a AccountInfo,
    withdrawer_share_ata: &'a AccountInfo,
    share_mint: &'a AccountInfo,
    vault_base_ata: &'a AccountInfo,
    withdrawer_base_ata: &'a AccountInfo,
    vault_state: &'a AccountInfo,
    _token_program: &'a AccountInfo,
    new_share_price: u64,
    shares_to_burn: u64,
}

impl<'a> WithdrawWithPrice<'a> {
    pub const DISCRIMINATOR: u8 = 0x0A;

    pub fn process(self) -> ProgramResult {
        // Borrow vault state mutably to update price and read config
        let mut data = self.vault_state.try_borrow_mut_data()?;
        let state: &mut VaultState =
            bytemuck::from_bytes_mut(&mut data[..VaultState::LEN]);

        // Verify admin
        if !state.is_admin(self.admin.key()) {
            return Err(VaultError::Unauthorized.into());
        }

        // Verify share mint matches
        if state.share_mint != *self.share_mint.key() {
            return Err(ProgramError::InvalidAccountData);
        }

        // Update share price
        state.share_price = self.new_share_price;

        // Calculate base tokens to return: shares * share_price / 10^share_decimals
        let share_multiplier = 10u64
            .checked_pow(state.share_decimals as u32)
            .ok_or(VaultError::MathOverflow)?;
        let gross_base = self
            .shares_to_burn
            .checked_mul(self.new_share_price)
            .ok_or(VaultError::MathOverflow)?
            .checked_div(share_multiplier)
            .ok_or(VaultError::MathOverflow)?;

        if gross_base == 0 {
            return Err(VaultError::InvalidAmount.into());
        }

        // Apply exit fee (fee stays in vault)
        let exit_fee_bps = state.exit_fee_bps;
        let base_to_return = if exit_fee_bps > 0 {
            let (net, _fee) = crate::fees::apply_fee(gross_base, exit_fee_bps)
                .ok_or(VaultError::MathOverflow)?;
            net
        } else {
            gross_base
        };

        if base_to_return == 0 {
            return Err(VaultError::InvalidAmount.into());
        }

        // Copy values needed for PDA signing before dropping borrow
        let vault_bump = state.bump;
        let admin_bytes = state.admin;
        let base_mint_bytes = state.base_mint;

        // Drop borrow before CPI
        drop(data);

        // Burn share tokens from withdrawer (withdrawer signs)
        Burn {
            account: self.withdrawer_share_ata,
            mint: self.share_mint,
            authority: self.withdrawer,
            amount: self.shares_to_burn,
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
            amount: base_to_return,
        }
        .invoke_signed(&signers)?;

        Ok(())
    }
}

impl<'a> TryFrom<(&'a [u8], &'a [AccountInfo])> for WithdrawWithPrice<'a> {
    type Error = ProgramError;

    fn try_from(
        (data, accounts): (&'a [u8], &'a [AccountInfo]),
    ) -> Result<Self, Self::Error> {
        let [admin, withdrawer, withdrawer_share_ata, share_mint, vault_base_ata, withdrawer_base_ata, vault_state, token_program, ..] =
            accounts
        else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        // Both admin and withdrawer must sign
        if !admin.is_signer() {
            return Err(ProgramError::MissingRequiredSignature);
        }
        if !withdrawer.is_signer() {
            return Err(ProgramError::MissingRequiredSignature);
        }

        // vault_state must be writable (price update)
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

        // Parse instruction data: [new_share_price: u64 LE] [shares_to_burn: u64 LE]
        if data.len() < 16 {
            return Err(ProgramError::InvalidInstructionData);
        }
        let new_share_price = u64::from_le_bytes(
            data[..8]
                .try_into()
                .map_err(|_| ProgramError::InvalidInstructionData)?,
        );
        let shares_to_burn = u64::from_le_bytes(
            data[8..16]
                .try_into()
                .map_err(|_| ProgramError::InvalidInstructionData)?,
        );

        if new_share_price == 0 {
            return Err(VaultError::InvalidSharePrice.into());
        }
        if shares_to_burn == 0 {
            return Err(VaultError::InvalidAmount.into());
        }

        Ok(Self {
            admin,
            withdrawer,
            withdrawer_share_ata,
            share_mint,
            vault_base_ata,
            withdrawer_base_ata,
            vault_state,
            _token_program: token_program,
            new_share_price,
            shares_to_burn,
        })
    }
}
