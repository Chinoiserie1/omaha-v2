use pinocchio::{
    account_info::AccountInfo,
    instruction::{Seed, Signer},
    program_error::ProgramError,
    ProgramResult,
};
use pinocchio_token::instructions::Transfer;

use crate::error::VaultError;
use crate::state::{
    PendingDeposit, VaultState, PENDING_DEPOSIT_DISCRIMINATOR, PENDING_EXPIRY_SECONDS,
    VAULT_DISCRIMINATOR,
};

/// User-initiated: cancel an expired pending deposit and reclaim base tokens.
///
/// After the 48-hour expiry window, the depositor can cancel their pending
/// deposit and reclaim their base tokens. The PendingDeposit PDA is closed
/// and rent is refunded to the depositor.
///
/// Accounts:
///   0. `[signer]`    depositor          — must match pending.depositor
///   1. `[writable]`  pending_deposit    — PDA to close
///   2. `[]`          vault_state        — read-only (for PDA signer seeds)
///   3. `[writable]`  vault_base_ata     — source of base tokens
///   4. `[writable]`  depositor_base_ata — destination for refunded tokens
///   5. `[]`          token_program      — legacy SPL Token
///   6. `[]`          clock_sysvar       — Clock sysvar
///
/// Data:
///   [0] discriminator (0x18)
pub struct CancelDeposit<'a> {
    depositor: &'a AccountInfo,
    pending_deposit: &'a AccountInfo,
    vault_state: &'a AccountInfo,
    vault_base_ata: &'a AccountInfo,
    depositor_base_ata: &'a AccountInfo,
    _token_program: &'a AccountInfo,
    clock_sysvar: &'a AccountInfo,
}

impl<'a> CancelDeposit<'a> {
    pub const DISCRIMINATOR: u8 = 0x18;

    pub fn process(self) -> ProgramResult {
        // Read clock timestamp
        let current_time = crate::sysvar::read_clock_timestamp(self.clock_sysvar)?;

        // Read pending deposit
        let deposit_amount;
        let pending_depositor;
        let pending_vault;
        let created_at;
        {
            let pd_data = self.pending_deposit.try_borrow_data()?;
            let pending: &PendingDeposit =
                bytemuck::from_bytes(&pd_data[..PendingDeposit::LEN]);

            deposit_amount = pending.amount;
            pending_depositor = pending.depositor;
            pending_vault = pending.vault_state;
            created_at = pending.created_at;
        }

        // Verify depositor matches signer
        if *self.depositor.key() != pending_depositor {
            return Err(VaultError::Unauthorized.into());
        }

        // Verify pending deposit belongs to this vault
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

        // Read VaultState to get bump and vault_name for PDA signing
        let vault_bump;
        let vn_len;
        let vault_name;
        {
            let vs_data = self.vault_state.try_borrow_data()?;
            let state: &VaultState = bytemuck::from_bytes(&vs_data[..VaultState::LEN]);

            vault_bump = state.bump;
            vn_len = state.vault_name_len as usize;
            vault_name = state.vault_name;
        }

        // Transfer base tokens: vault_base_ata → depositor_base_ata (vault PDA signs)
        let vault_bump_bytes = [vault_bump];
        let seeds: [Seed; 3] = [
            Seed::from(b"vault" as &[u8]),
            Seed::from(&vault_name[..vn_len]),
            Seed::from(&vault_bump_bytes),
        ];
        let signers: [Signer; 1] = [Signer::from(&seeds)];

        Transfer {
            from: self.vault_base_ata,
            to: self.depositor_base_ata,
            authority: self.vault_state,
            amount: deposit_amount,
        }
        .invoke_signed(&signers)?;

        // Close pending_deposit: refund rent lamports to depositor
        {
            let rent_lamports = self.pending_deposit.lamports();
            let mut dest_lamports = self.depositor.try_borrow_mut_lamports()?;
            *dest_lamports = (*dest_lamports)
                .checked_add(rent_lamports)
                .ok_or(VaultError::MathOverflow)?;
        }
        self.pending_deposit.close()?;

        Ok(())
    }
}

impl<'a> TryFrom<(&'a [u8], &'a [AccountInfo])> for CancelDeposit<'a> {
    type Error = ProgramError;

    fn try_from(
        (_data, accounts): (&'a [u8], &'a [AccountInfo]),
    ) -> Result<Self, Self::Error> {
        let [depositor, pending_deposit, vault_state, vault_base_ata, depositor_base_ata, token_program, clock_sysvar, ..] =
            accounts
        else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        if !depositor.is_signer() {
            return Err(ProgramError::MissingRequiredSignature);
        }

        // Validate pending_deposit
        if !pending_deposit.is_writable() {
            return Err(ProgramError::InvalidAccountData);
        }
        if !pending_deposit.is_owned_by(&crate::ID) {
            return Err(ProgramError::IllegalOwner);
        }
        {
            let pd_data = pending_deposit.try_borrow_data()?;
            if pd_data.len() < PendingDeposit::LEN
                || pd_data[0] != PENDING_DEPOSIT_DISCRIMINATOR
            {
                return Err(VaultError::InvalidPendingDeposit.into());
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
        if !vault_base_ata.is_writable() {
            return Err(ProgramError::InvalidAccountData);
        }
        if !depositor_base_ata.is_writable() {
            return Err(ProgramError::InvalidAccountData);
        }
        if !depositor.is_writable() {
            return Err(ProgramError::InvalidAccountData);
        }

        Ok(Self {
            depositor,
            pending_deposit,
            vault_state,
            vault_base_ata,
            depositor_base_ata,
            _token_program: token_program,
            clock_sysvar,
        })
    }
}
