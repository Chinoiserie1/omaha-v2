use pinocchio::{
    account_info::AccountInfo,
    instruction::{Seed, Signer},
    program_error::ProgramError,
    ProgramResult,
};
use pinocchio_token::instructions::Transfer;

use crate::error::VaultError;
use crate::state::{PendingWithdraw, VaultState, PENDING_WITHDRAW_DISCRIMINATOR, VAULT_DISCRIMINATOR};

/// Admin-only: fulfill a pending withdrawal by setting share price and transferring base tokens.
///
/// The admin sets the new share price, base tokens are calculated from the
/// pending withdraw shares, transferred to the withdrawer, and the
/// PendingWithdraw PDA is closed (rent refunded to withdrawer).
///
/// Accounts:
///   0. `[signer]`    admin              — must be vault admin
///   1. `[writable]`  vault_state        — PDA (price updated)
///   2. `[writable]`  pending_withdraw   — PDA to read and close
///   3. `[writable]`  vault_base_ata     — vault's base token account
///   4. `[writable]`  withdrawer_base_ata — receives base tokens
///   5. `[writable]`  withdrawer         — receives rent refund (NOT a signer)
///   6. `[]`          token_program
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
    new_share_price: u64,
}

impl<'a> FulfillWithdraw<'a> {
    pub const DISCRIMINATOR: u8 = 0x0C;

    pub fn process(self) -> ProgramResult {
        // Read pending withdraw
        let pending_shares;
        let pending_withdrawer;
        let pending_vault;
        {
            let pw_data = self.pending_withdraw.try_borrow_data()?;
            let pending: &PendingWithdraw =
                bytemuck::from_bytes(&pw_data[..PendingWithdraw::LEN]);

            pending_shares = pending.shares;
            pending_withdrawer = pending.withdrawer;
            pending_vault = pending.vault_state;
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
        let admin_bytes;
        let base_mint_bytes;
        {
            let mut vs_data = self.vault_state.try_borrow_mut_data()?;
            let state: &mut VaultState =
                bytemuck::from_bytes_mut(&mut vs_data[..VaultState::LEN]);

            // Verify admin
            if !state.is_admin(self.admin.key()) {
                return Err(VaultError::Unauthorized.into());
            }

            // Update share price
            state.share_price = self.new_share_price;

            share_decimals = state.share_decimals;
            vault_bump = state.bump;
            admin_bytes = state.admin;
            base_mint_bytes = state.base_mint;
        }

        // Calculate base tokens to return: shares * share_price / 10^share_decimals
        let share_multiplier = 10u64
            .checked_pow(share_decimals as u32)
            .ok_or(VaultError::MathOverflow)?;
        let base_to_return = pending_shares
            .checked_mul(self.new_share_price)
            .ok_or(VaultError::MathOverflow)?
            .checked_div(share_multiplier)
            .ok_or(VaultError::MathOverflow)?;

        if base_to_return == 0 {
            return Err(VaultError::InvalidAmount.into());
        }

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
        let [admin, vault_state, pending_withdraw, vault_base_ata, withdrawer_base_ata, withdrawer, token_program, ..] =
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

        Ok(Self {
            admin,
            vault_state,
            pending_withdraw,
            vault_base_ata,
            withdrawer_base_ata,
            withdrawer,
            _token_program: token_program,
            new_share_price,
        })
    }
}
