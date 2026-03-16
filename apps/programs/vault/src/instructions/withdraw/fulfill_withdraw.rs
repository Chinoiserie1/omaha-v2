use pinocchio::{
    account_info::AccountInfo,
    instruction::{Seed, Signer},
    program_error::ProgramError,
    ProgramResult,
};
use pinocchio_token::instructions::Transfer;

use crate::error::VaultError;
use crate::state::{PendingWithdraw, VaultState, PENDING_WITHDRAW_DISCRIMINATOR, VAULT_DISCRIMINATOR};
use crate::token2022;

/// Admin-only: fulfill a pending withdrawal by burning escrowed shares,
/// setting share price, and transferring base tokens.
///
/// The admin sets the new share price. Escrowed share tokens are burned from
/// the vault's share ATA, base tokens are calculated and transferred to the
/// withdrawer, and the PendingWithdraw PDA is closed (rent refunded).
/// Exit fees are applied if configured (fee stays in vault).
///
/// Accounts:
///   0. `[signer]`    admin              — must be vault admin
///   1. `[writable]`  vault_state        — PDA (price updated)
///   2. `[writable]`  pending_withdraw   — PDA to read and close
///   3. `[writable]`  vault_base_ata     — vault's base token account
///   4. `[writable]`  withdrawer_base_ata — receives base tokens
///   5. `[writable]`  withdrawer         — receives rent refund (NOT a signer)
///   6. `[]`          token_program      — legacy SPL Token (for base transfer)
///   7. `[writable]`  vault_share_ata    — escrow holding share tokens
///   8. `[writable]`  share_mint         — share token mint (Token 2022)
///   9. `[]`          share_token_program — Token 2022
///
/// Data:
///   [0]    discriminator (0x0C)
///   [1..9] new_share_price (u64 LE)
pub struct FulfillWithdraw<'a> {
    admin: &'a AccountInfo,
    vault_state: &'a AccountInfo,
    pending_withdraw: &'a AccountInfo,
    vault_base_ata: &'a AccountInfo,
    withdrawer_base_ata: &'a AccountInfo,
    withdrawer: &'a AccountInfo,
    _token_program: &'a AccountInfo,
    vault_share_ata: &'a AccountInfo,
    share_mint: &'a AccountInfo,
    share_token_program: &'a AccountInfo,
    new_share_price: u64,
}

impl<'a> FulfillWithdraw<'a> {
    pub const DISCRIMINATOR: u8 = 0x0C;

    pub fn process(self) -> ProgramResult {
        // Read pending withdraw
        let pending_shares;
        let pending_withdrawer;
        let pending_vault;
        let pending_exit_fee_bps;
        {
            let pw_data = self.pending_withdraw.try_borrow_data()?;
            let pending: &PendingWithdraw =
                bytemuck::from_bytes(&pw_data[..PendingWithdraw::LEN]);

            pending_shares = pending.shares;
            pending_withdrawer = pending.withdrawer;
            pending_vault = pending.vault_state;
            pending_exit_fee_bps = pending.exit_fee_bps;
        }

        // Verify withdrawer account matches pending withdraw
        if *self.withdrawer.key() != pending_withdrawer {
            return Err(ProgramError::InvalidAccountData);
        }

        // Verify pending withdraw belongs to this vault
        if *self.vault_state.key() != pending_vault {
            return Err(ProgramError::InvalidAccountData);
        }

        // Borrow vault state mutably to update price and read config
        let share_decimals;
        let vault_bump;
        let vn_len;
        let vault_name;
        let exit_fee_bps;
        {
            let mut vs_data = self.vault_state.try_borrow_mut_data()?;
            let state: &mut VaultState =
                bytemuck::from_bytes_mut(&mut vs_data[..VaultState::LEN]);

            // Verify admin
            if !state.is_admin(self.admin.key()) {
                return Err(VaultError::Unauthorized.into());
            }

            // Check pause state
            if state.paused() {
                return Err(VaultError::VaultPaused.into());
            }

            // Update share price
            state.share_price = self.new_share_price;

            share_decimals = state.share_decimals;
            vault_bump = state.bump;
            vn_len = state.vault_name_len as usize;
            vault_name = state.vault_name;
            exit_fee_bps = pending_exit_fee_bps;
        }

        // Calculate base tokens to return: shares * share_price / 10^share_decimals
        let share_multiplier = 10u64
            .checked_pow(share_decimals as u32)
            .ok_or(VaultError::MathOverflow)?;
        let gross_base = pending_shares
            .checked_mul(self.new_share_price)
            .ok_or(VaultError::MathOverflow)?
            .checked_div(share_multiplier)
            .ok_or(VaultError::MathOverflow)?;

        if gross_base == 0 {
            return Err(VaultError::InvalidAmount.into());
        }

        // Apply exit fee (fee stays in vault)
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

        // Pre-flight: verify vault has enough base tokens before any CPI
        {
            let ata_data = self.vault_base_ata.try_borrow_data()?;
            let vault_balance =
                u64::from_le_bytes(ata_data[64..72].try_into().map_err(|_| ProgramError::InvalidAccountData)?);
            if base_to_return > vault_balance {
                return Err(VaultError::InsufficientFunds.into());
            }
        }

        // Vault PDA signer seeds (used for both burn and transfer)
        let vault_bump_bytes = [vault_bump];
        let seeds: [Seed; 3] = [
            Seed::from(b"vault" as &[u8]),
            Seed::from(&vault_name[..vn_len]),
            Seed::from(&vault_bump_bytes),
        ];
        let signers: [Signer; 1] = [Signer::from(&seeds)];

        // Burn escrowed share tokens (vault PDA signs as authority over escrow)
        token2022::burn(
            self.share_token_program,
            self.vault_share_ata,
            self.share_mint,
            self.vault_state,
            pending_shares,
            &signers,
        )?;

        // Transfer base tokens: vault → withdrawer (vault_state PDA signs)
        Transfer {
            from: self.vault_base_ata,
            to: self.withdrawer_base_ata,
            authority: self.vault_state,
            amount: base_to_return,
        }
        .invoke_signed(&signers)?;

        // Close pending_withdraw: refund rent lamports to withdrawer
        {
            let rent_lamports = self.pending_withdraw.lamports();
            let mut dest_lamports = self.withdrawer.try_borrow_mut_lamports()?;
            *dest_lamports = (*dest_lamports)
                .checked_add(rent_lamports)
                .ok_or(VaultError::MathOverflow)?;
        }
        self.pending_withdraw.close()?;

        Ok(())
    }
}

impl<'a> TryFrom<(&'a [u8], &'a [AccountInfo])> for FulfillWithdraw<'a> {
    type Error = ProgramError;

    fn try_from(
        (data, accounts): (&'a [u8], &'a [AccountInfo]),
    ) -> Result<Self, Self::Error> {
        let [admin, vault_state, pending_withdraw, vault_base_ata, withdrawer_base_ata, withdrawer, token_program, vault_share_ata, share_mint, share_token_program, ..] =
            accounts
        else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        if !admin.is_signer() {
            return Err(ProgramError::MissingRequiredSignature);
        }

        // Validate vault_state
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

        // Validate pending_withdraw
        if !pending_withdraw.is_writable() {
            return Err(ProgramError::InvalidAccountData);
        }
        if !pending_withdraw.is_owned_by(&crate::ID) {
            return Err(ProgramError::IllegalOwner);
        }
        {
            let pw_data = pending_withdraw.try_borrow_data()?;
            if pw_data.len() < PendingWithdraw::LEN
                || pw_data[0] != PENDING_WITHDRAW_DISCRIMINATOR
            {
                return Err(VaultError::InvalidPendingWithdraw.into());
            }
        }

        // Validate withdrawer is writable (receives rent refund)
        if !withdrawer.is_writable() {
            return Err(ProgramError::InvalidAccountData);
        }

        // Parse instruction data: [new_share_price: u64 LE]
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

        // Validate new writable accounts
        if !vault_share_ata.is_writable() {
            return Err(ProgramError::InvalidAccountData);
        }
        if !share_mint.is_writable() {
            return Err(ProgramError::InvalidAccountData);
        }

        Ok(Self {
            admin,
            vault_state,
            pending_withdraw,
            vault_base_ata,
            withdrawer_base_ata,
            withdrawer,
            _token_program: token_program,
            vault_share_ata,
            share_mint,
            share_token_program,
            new_share_price,
        })
    }
}
