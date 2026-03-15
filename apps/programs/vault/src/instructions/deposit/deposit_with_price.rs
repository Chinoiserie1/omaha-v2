use pinocchio::{
    account_info::AccountInfo,
    instruction::{Seed, Signer},
    program_error::ProgramError,
    ProgramResult,
};
use pinocchio_token::instructions::Transfer;

use crate::error::VaultError;
use crate::state::{VaultState, VAULT_DISCRIMINATOR};
use crate::token2022;

/// Admin-only: set share price and deposit in a single atomic instruction.
///
/// The admin sets the new share price, then base tokens are transferred
/// from the depositor and shares are minted at the new price. If entry fees
/// are configured, fee shares are minted to the fee receiver.
///
/// Accounts:
///   0. `[signer]`    admin              — must be vault admin
///   1. `[signer]`    depositor          — authorizes base token transfer
///   2. `[writable]`  depositor_base_ata — source of base tokens
///   3. `[writable]`  vault_base_ata     — vault's base token account
///   4. `[writable]`  vault_state        — PDA with vault config (price updated)
///   5. `[writable]`  share_mint         — share token mint (Token 2022)
///   6. `[writable]`  depositor_share_ata — destination for minted shares
///   7. `[]`          token_program      — legacy SPL Token (for base token transfer)
///   8. `[]`          share_token_program — Token 2022 (for share mint/burn)
///   9. `[writable]`  fee_receiver_ata   — (optional) destination for fee shares
///
/// Data:
///   [0]     discriminator (0x07)
///   [1..9]  new_share_price (u64 LE)
///   [9..17] deposit_amount (u64 LE)
pub struct DepositWithPrice<'a> {
    admin: &'a AccountInfo,
    depositor: &'a AccountInfo,
    depositor_base_ata: &'a AccountInfo,
    vault_base_ata: &'a AccountInfo,
    vault_state: &'a AccountInfo,
    share_mint: &'a AccountInfo,
    depositor_share_ata: &'a AccountInfo,
    _token_program: &'a AccountInfo,
    share_token_program: &'a AccountInfo,
    fee_receiver_ata: Option<&'a AccountInfo>,
    new_share_price: u64,
    deposit_amount: u64,
}

impl<'a> DepositWithPrice<'a> {
    pub const DISCRIMINATOR: u8 = 7;

    pub fn process(self) -> ProgramResult {
        // Borrow vault state mutably to update price and read config
        let mut data = self.vault_state.try_borrow_mut_data()?;
        let state: &mut VaultState =
            bytemuck::from_bytes_mut(&mut data[..VaultState::LEN]);

        // Verify admin
        if !state.is_admin(self.admin.key()) {
            return Err(VaultError::Unauthorized.into());
        }

        // Check pause state
        if state.paused() {
            return Err(VaultError::VaultPaused.into());
        }

        // Verify share mint matches
        if state.share_mint != *self.share_mint.key() {
            return Err(ProgramError::InvalidAccountData);
        }

        // Update share price
        state.share_price = self.new_share_price;

        // Calculate shares to mint: amount * 10^share_decimals / share_price
        let share_multiplier = 10u64
            .checked_pow(state.share_decimals as u32)
            .ok_or(VaultError::MathOverflow)?;
        let gross_shares = self
            .deposit_amount
            .checked_mul(share_multiplier)
            .ok_or(VaultError::MathOverflow)?
            .checked_div(self.new_share_price)
            .ok_or(VaultError::MathOverflow)?;

        if gross_shares == 0 {
            return Err(VaultError::InvalidAmount.into());
        }

        // Apply entry fee
        let entry_fee_bps = state.entry_fee_bps;
        let has_fee_receiver = state.has_fee_receiver();
        let (user_shares, fee_shares) = if entry_fee_bps > 0 && has_fee_receiver {
            crate::fees::apply_fee(gross_shares, entry_fee_bps)
                .ok_or(VaultError::MathOverflow)?
        } else {
            (gross_shares, 0u64)
        };

        // Copy values needed for PDA signing before dropping borrow
        let vault_bump = state.bump;
        let vn_len = state.vault_name_len as usize;
        let vault_name = state.vault_name;

        // Drop borrow before CPI
        drop(data);

        // Transfer base tokens: depositor → vault (legacy SPL Token)
        Transfer {
            from: self.depositor_base_ata,
            to: self.vault_base_ata,
            authority: self.depositor,
            amount: self.deposit_amount,
        }
        .invoke()?;

        // Mint share tokens to depositor via Token 2022 (vault_state PDA is mint authority)
        let vault_bump_bytes = [vault_bump];
        let seeds: [Seed; 3] = [
            Seed::from(b"vault" as &[u8]),
            Seed::from(&vault_name[..vn_len]),
            Seed::from(&vault_bump_bytes),
        ];
        let signers: [Signer; 1] = [Signer::from(&seeds)];

        token2022::mint_to(
            self.share_token_program,
            self.share_mint,
            self.depositor_share_ata,
            self.vault_state,
            user_shares,
            &signers,
        )?;

        // Mint fee shares to fee receiver
        if fee_shares > 0 {
            let fee_ata = self
                .fee_receiver_ata
                .ok_or(ProgramError::NotEnoughAccountKeys)?;
            token2022::mint_to(
                self.share_token_program,
                self.share_mint,
                fee_ata,
                self.vault_state,
                fee_shares,
                &signers,
            )?;
        }

        Ok(())
    }
}

impl<'a> TryFrom<(&'a [u8], &'a [AccountInfo])> for DepositWithPrice<'a> {
    type Error = ProgramError;

    fn try_from(
        (data, accounts): (&'a [u8], &'a [AccountInfo]),
    ) -> Result<Self, Self::Error> {
        let [admin, depositor, depositor_base_ata, vault_base_ata, vault_state, share_mint, depositor_share_ata, token_program, share_token_program, ..] =
            accounts
        else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        // Both admin and depositor must sign
        if !admin.is_signer() {
            return Err(ProgramError::MissingRequiredSignature);
        }
        if !depositor.is_signer() {
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

        // Optional fee_receiver_ata (10th account, index 9)
        let fee_receiver_ata = accounts.get(9);

        // Parse instruction data: [new_share_price: u64 LE] [deposit_amount: u64 LE]
        if data.len() < 16 {
            return Err(ProgramError::InvalidInstructionData);
        }
        let new_share_price = u64::from_le_bytes(
            data[..8]
                .try_into()
                .map_err(|_| ProgramError::InvalidInstructionData)?,
        );
        let deposit_amount = u64::from_le_bytes(
            data[8..16]
                .try_into()
                .map_err(|_| ProgramError::InvalidInstructionData)?,
        );

        if new_share_price == 0 {
            return Err(VaultError::InvalidSharePrice.into());
        }
        if deposit_amount == 0 {
            return Err(VaultError::InvalidAmount.into());
        }

        Ok(Self {
            admin,
            depositor,
            depositor_base_ata,
            vault_base_ata,
            vault_state,
            share_mint,
            depositor_share_ata,
            _token_program: token_program,
            share_token_program,
            fee_receiver_ata,
            new_share_price,
            deposit_amount,
        })
    }
}
