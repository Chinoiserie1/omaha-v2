use pinocchio::{
    account_info::AccountInfo,
    instruction::{Seed, Signer},
    program_error::ProgramError,
    ProgramResult,
};

use crate::error::VaultError;
use crate::state::{
    PendingWithdraw, VaultState, PENDING_EXPIRY_SECONDS, PENDING_WITHDRAW_DISCRIMINATOR,
    VAULT_DISCRIMINATOR,
};
use crate::token2022;

/// User-initiated: cancel an expired pending withdrawal and re-mint shares.
///
/// After the 48-hour expiry window, the withdrawer can cancel their pending
/// withdrawal and have their share tokens re-minted. The PendingWithdraw PDA
/// is closed and rent is refunded to the withdrawer.
///
/// Accounts:
///   0. `[signer]`    withdrawer           — must match pending.withdrawer
///   1. `[writable]`  pending_withdraw     — PDA to close
///   2. `[]`          vault_state          — read-only (for PDA signer seeds + share_mint verification)
///   3. `[writable]`  share_mint           — share token mint (Token 2022)
///   4. `[writable]`  withdrawer_share_ata — destination for re-minted shares
///   5. `[]`          token_program        — Token 2022
///   6. `[]`          clock_sysvar         — Clock sysvar
///
/// Data:
///   [0] discriminator (0x19)
pub struct CancelWithdraw<'a> {
    withdrawer: &'a AccountInfo,
    pending_withdraw: &'a AccountInfo,
    vault_state: &'a AccountInfo,
    share_mint: &'a AccountInfo,
    withdrawer_share_ata: &'a AccountInfo,
    token_program: &'a AccountInfo,
    clock_sysvar: &'a AccountInfo,
}

impl<'a> CancelWithdraw<'a> {
    pub const DISCRIMINATOR: u8 = 0x19;

    pub fn process(self) -> ProgramResult {
        // Read clock timestamp
        let current_time = crate::sysvar::read_clock_timestamp(self.clock_sysvar)?;

        // Read pending withdraw
        let pending_shares;
        let pending_withdrawer;
        let pending_vault;
        let created_at;
        {
            let pw_data = self.pending_withdraw.try_borrow_data()?;
            let pending: &PendingWithdraw =
                bytemuck::from_bytes(&pw_data[..PendingWithdraw::LEN]);

            pending_shares = pending.shares;
            pending_withdrawer = pending.withdrawer;
            pending_vault = pending.vault_state;
            created_at = pending.created_at;
        }

        // Verify withdrawer matches signer
        if *self.withdrawer.key() != pending_withdrawer {
            return Err(VaultError::Unauthorized.into());
        }

        // Verify pending withdraw belongs to this vault
        if *self.vault_state.key() != pending_vault {
            return Err(ProgramError::InvalidAccountData);
        }

        // Check expiry: must be expired before cancellation is allowed
        let expiry = created_at
            .checked_add(PENDING_EXPIRY_SECONDS)
            .ok_or(VaultError::MathOverflow)?;
        if current_time < expiry {
            return Err(VaultError::PendingNotExpired.into());
        }

        // Read VaultState to get bump, vault_name, and share_mint for PDA signing
        let vault_bump;
        let vn_len;
        let vault_name;
        let state_share_mint;
        {
            let vs_data = self.vault_state.try_borrow_data()?;
            let state: &VaultState = bytemuck::from_bytes(&vs_data[..VaultState::LEN]);

            vault_bump = state.bump;
            vn_len = state.vault_name_len as usize;
            vault_name = state.vault_name;
            state_share_mint = state.share_mint;
        }

        // Verify share_mint account matches vault state
        if *self.share_mint.key() != state_share_mint {
            return Err(ProgramError::InvalidAccountData);
        }

        // Mint shares back to withdrawer (vault PDA signs as mint authority)
        let vault_bump_bytes = [vault_bump];
        let seeds: [Seed; 3] = [
            Seed::from(b"vault" as &[u8]),
            Seed::from(&vault_name[..vn_len]),
            Seed::from(&vault_bump_bytes),
        ];
        let signers: [Signer; 1] = [Signer::from(&seeds)];

        token2022::mint_to(
            self.token_program,
            self.share_mint,
            self.withdrawer_share_ata,
            self.vault_state,
            pending_shares,
            &signers,
        )?;

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

impl<'a> TryFrom<(&'a [u8], &'a [AccountInfo])> for CancelWithdraw<'a> {
    type Error = ProgramError;

    fn try_from(
        (_data, accounts): (&'a [u8], &'a [AccountInfo]),
    ) -> Result<Self, Self::Error> {
        let [withdrawer, pending_withdraw, vault_state, share_mint, withdrawer_share_ata, token_program, clock_sysvar, ..] =
            accounts
        else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        if !withdrawer.is_signer() {
            return Err(ProgramError::MissingRequiredSignature);
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

        // Validate writable accounts
        if !share_mint.is_writable() {
            return Err(ProgramError::InvalidAccountData);
        }
        if !withdrawer_share_ata.is_writable() {
            return Err(ProgramError::InvalidAccountData);
        }
        if !withdrawer.is_writable() {
            return Err(ProgramError::InvalidAccountData);
        }

        Ok(Self {
            withdrawer,
            pending_withdraw,
            vault_state,
            share_mint,
            withdrawer_share_ata,
            token_program,
            clock_sysvar,
        })
    }
}
