use pinocchio::{
    account_info::AccountInfo,
    instruction::{Seed, Signer},
    program_error::ProgramError,
    ProgramResult,
};
use pinocchio_token::instructions::{MintTo, Transfer};

use crate::error::VaultError;
use crate::state::{VaultState, VAULT_DISCRIMINATOR};

/// Deposit base tokens into the vault and receive share tokens.
///
/// shares_to_mint = amount * 10^share_decimals / share_price
///
/// Accounts:
///   0. `[signer]`    depositor
///   1. `[writable]`  depositor_base_ata   — source of base tokens
///   2. `[writable]`  vault_base_ata       — vault's base token account
///   3. `[]`          vault_state          — PDA with vault config
///   4. `[writable]`  share_mint           — share token mint (vault_state is authority)
///   5. `[writable]`  depositor_share_ata  — destination for minted shares
///   6. `[]`          token_program
///
/// Data:
///   [0]    discriminator (0x01)
///   [1..9] amount (u64 LE) — base token amount to deposit
pub struct Deposit<'a> {
    depositor: &'a AccountInfo,
    depositor_base_ata: &'a AccountInfo,
    vault_base_ata: &'a AccountInfo,
    vault_state: &'a AccountInfo,
    share_mint: &'a AccountInfo,
    depositor_share_ata: &'a AccountInfo,
    _token_program: &'a AccountInfo,
    amount: u64,
}

impl<'a> Deposit<'a> {
    pub const DISCRIMINATOR: u8 = 1;

    pub fn process(self) -> ProgramResult {
        // Read vault state
        let data = self.vault_state.try_borrow_data()?;
        let state: &VaultState = bytemuck::from_bytes(&data[..VaultState::LEN]);

        // Verify share mint matches
        if state.share_mint != *self.share_mint.key() {
            return Err(ProgramError::InvalidAccountData);
        }

        // Calculate shares to mint: amount * 10^share_decimals / share_price
        let share_multiplier = 10u64
            .checked_pow(state.share_decimals as u32)
            .ok_or(VaultError::MathOverflow)?;
        let shares_to_mint = self
            .amount
            .checked_mul(share_multiplier)
            .ok_or(VaultError::MathOverflow)?
            .checked_div(state.share_price)
            .ok_or(VaultError::MathOverflow)?;

        if shares_to_mint == 0 {
            return Err(VaultError::InvalidAmount.into());
        }

        let vault_bump = state.bump;
        let admin_bytes = state.admin;
        let base_mint_bytes = state.base_mint;

        // Drop borrow before CPI
        drop(data);

        // Transfer base tokens: depositor → vault
        Transfer {
            from: self.depositor_base_ata,
            to: self.vault_base_ata,
            authority: self.depositor,
            amount: self.amount,
        }
        .invoke()?;

        // Mint share tokens to depositor (vault_state PDA is mint authority)
        let vault_bump_bytes = [vault_bump];
        let seeds: [Seed; 4] = [
            Seed::from(b"vault" as &[u8]),
            Seed::from(&admin_bytes),
            Seed::from(&base_mint_bytes),
            Seed::from(&vault_bump_bytes),
        ];
        let signers: [Signer; 1] = [Signer::from(&seeds)];

        MintTo {
            mint: self.share_mint,
            account: self.depositor_share_ata,
            mint_authority: self.vault_state,
            amount: shares_to_mint,
        }
        .invoke_signed(&signers)?;

        Ok(())
    }
}

impl<'a> TryFrom<(&'a [u8], &'a [AccountInfo])> for Deposit<'a> {
    type Error = ProgramError;

    fn try_from(
        (data, accounts): (&'a [u8], &'a [AccountInfo]),
    ) -> Result<Self, Self::Error> {
        let [depositor, depositor_base_ata, vault_base_ata, vault_state, share_mint, depositor_share_ata, token_program, ..] =
            accounts
        else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        if !depositor.is_signer() {
            return Err(ProgramError::MissingRequiredSignature);
        }

        // Validate vault_state
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
        let amount = u64::from_le_bytes(
            data[..8]
                .try_into()
                .map_err(|_| ProgramError::InvalidInstructionData)?,
        );
        if amount == 0 {
            return Err(VaultError::InvalidAmount.into());
        }

        Ok(Self {
            depositor,
            depositor_base_ata,
            vault_base_ata,
            vault_state,
            share_mint,
            depositor_share_ata,
            _token_program: token_program,
            amount,
        })
    }
}
