use pinocchio::{
    account_info::AccountInfo,
    instruction::{Seed, Signer},
    program_error::ProgramError,
    pubkey::find_program_address,
    ProgramResult,
};
use pinocchio_system::instructions::CreateAccount;
use pinocchio_token::instructions::Transfer;

use crate::error::VaultError;
use crate::state::{PendingDeposit, VaultState, PENDING_DEPOSIT_DISCRIMINATOR, VAULT_DISCRIMINATOR};

/// Request a deposit into the vault (async flow — step 1 of 2).
///
/// The depositor transfers base tokens to the vault and a PendingDeposit
/// PDA is created to record the request. The admin later fulfills the
/// deposit by setting the share price and minting shares.
///
/// Accounts:
///   0. `[signer, writable]` depositor          — pays rent + signs token transfer
///   1. `[writable]`         depositor_base_ata — source of base tokens
///   2. `[writable]`         vault_base_ata     — vault's base token account
///   3. `[]`                 vault_state        — PDA (read-only, for validation)
///   4. `[writable]`         pending_deposit    — PDA to create
///   5. `[]`                 system_program
///   6. `[]`                 token_program
///   7. `[]`                 clock_sysvar
///
/// Data:
///   [0]    discriminator (0x08)
///   [1..9] amount (u64 LE) — base token amount to deposit
pub struct RequestDeposit<'a> {
    depositor: &'a AccountInfo,
    depositor_base_ata: &'a AccountInfo,
    vault_base_ata: &'a AccountInfo,
    vault_state: &'a AccountInfo,
    pending_deposit: &'a AccountInfo,
    _system_program: &'a AccountInfo,
    _token_program: &'a AccountInfo,
    clock_sysvar: &'a AccountInfo,
    amount: u64,
}

impl<'a> RequestDeposit<'a> {
    pub const DISCRIMINATOR: u8 = 8;

    pub fn process(self) -> ProgramResult {
        let current_timestamp = crate::sysvar::read_clock_timestamp(self.clock_sysvar)?;

        let entry_fee_bps = {
            let vdata = self.vault_state.try_borrow_data()?;
            let vs: &VaultState = bytemuck::from_bytes(&vdata[..VaultState::LEN]);
            if vs.paused() {
                return Err(VaultError::VaultPaused.into());
            }
            vs.entry_fee_bps
        };

        let vault_state_key = self.vault_state.key();
        let depositor_key = self.depositor.key();

        // Derive and verify pending deposit PDA
        let (expected_pda, pending_bump) = find_program_address(
            &[b"pending_deposit", vault_state_key.as_ref(), depositor_key.as_ref()],
            &crate::ID,
        );
        if self.pending_deposit.key() != &expected_pda {
            return Err(ProgramError::InvalidSeeds);
        }

        // Create PendingDeposit account (PDA signs)
        let pending_bump_bytes = [pending_bump];
        let pending_seeds: [Seed; 4] = [
            Seed::from(b"pending_deposit" as &[u8]),
            Seed::from(vault_state_key.as_ref()),
            Seed::from(depositor_key.as_ref()),
            Seed::from(&pending_bump_bytes),
        ];
        let pending_signers: [Signer; 1] = [Signer::from(&pending_seeds)];

        CreateAccount {
            from: self.depositor,
            to: self.pending_deposit,
            lamports: crate::rent::minimum_balance(PendingDeposit::LEN),
            space: PendingDeposit::LEN as u64,
            owner: &crate::ID,
        }
        .invoke_signed(&pending_signers)?;

        // Write pending deposit state
        {
            let mut data = self.pending_deposit.try_borrow_mut_data()?;
            let state: &mut PendingDeposit =
                bytemuck::from_bytes_mut(&mut data[..PendingDeposit::LEN]);

            state.discriminator = PENDING_DEPOSIT_DISCRIMINATOR;
            state.bump = pending_bump;
            state.entry_fee_bps = entry_fee_bps;
            state.vault_state = *vault_state_key;
            state.depositor = *depositor_key;
            state.amount = self.amount;
            state.created_at = current_timestamp;
        }

        // Transfer base tokens: depositor → vault
        Transfer {
            from: self.depositor_base_ata,
            to: self.vault_base_ata,
            authority: self.depositor,
            amount: self.amount,
        }
        .invoke()?;

        Ok(())
    }
}

impl<'a> TryFrom<(&'a [u8], &'a [AccountInfo])> for RequestDeposit<'a> {
    type Error = ProgramError;

    fn try_from(
        (data, accounts): (&'a [u8], &'a [AccountInfo]),
    ) -> Result<Self, Self::Error> {
        let [depositor, depositor_base_ata, vault_base_ata, vault_state, pending_deposit, system_program, token_program, clock_sysvar, ..] =
            accounts
        else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        if !depositor.is_signer() {
            return Err(ProgramError::MissingRequiredSignature);
        }
        if !depositor.is_writable() {
            return Err(ProgramError::InvalidAccountData);
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
            pending_deposit,
            _system_program: system_program,
            _token_program: token_program,
            clock_sysvar,
            amount,
        })
    }
}
