use pinocchio::{
    account_info::AccountInfo,
    instruction::{Seed, Signer},
    program_error::ProgramError,
    pubkey::find_program_address,
    ProgramResult,
};
use pinocchio_system::instructions::CreateAccount;
use pinocchio_token::instructions::Burn;

use crate::error::VaultError;
use crate::state::{PendingWithdraw, VaultState, PENDING_WITHDRAW_DISCRIMINATOR, VAULT_DISCRIMINATOR};

/// Request a withdrawal from the vault (async flow — step 1 of 2).
///
/// The withdrawer burns share tokens and a PendingWithdraw PDA is created
/// to record the request. The admin later fulfills the withdrawal by
/// setting the share price and transferring base tokens.
///
/// Accounts:
///   0. `[signer, writable]` withdrawer          — pays rent + signs share burn
///   1. `[writable]`         withdrawer_share_ata — shares to burn
///   2. `[writable]`         share_mint           — share token mint
///   3. `[]`                 vault_state          — PDA (read-only, for validation)
///   4. `[writable]`         pending_withdraw     — PDA to create
///   5. `[]`                 system_program
///   6. `[]`                 token_program
///
/// Data:
///   [0]    discriminator (0x0B)
///   [1..9] shares (u64 LE) — share tokens to burn
pub struct RequestWithdraw<'a> {
    withdrawer: &'a AccountInfo,
    withdrawer_share_ata: &'a AccountInfo,
    share_mint: &'a AccountInfo,
    vault_state: &'a AccountInfo,
    pending_withdraw: &'a AccountInfo,
    _system_program: &'a AccountInfo,
    _token_program: &'a AccountInfo,
    shares: u64,
}

impl<'a> RequestWithdraw<'a> {
    pub const DISCRIMINATOR: u8 = 0x0B;

    pub fn process(self) -> ProgramResult {
        // Validate share mint matches vault state
        {
            let vdata = self.vault_state.try_borrow_data()?;
            let state: &VaultState = bytemuck::from_bytes(&vdata[..VaultState::LEN]);

            if state.share_mint != *self.share_mint.key() {
                return Err(ProgramError::InvalidAccountData);
            }
        }

        let vault_state_key = self.vault_state.key();
        let withdrawer_key = self.withdrawer.key();

        // Derive and verify pending withdraw PDA
        let (expected_pda, pending_bump) = find_program_address(
            &[b"pending_withdraw", vault_state_key.as_ref(), withdrawer_key.as_ref()],
            &crate::ID,
        );
        if self.pending_withdraw.key() != &expected_pda {
            return Err(ProgramError::InvalidSeeds);
        }

        // Create PendingWithdraw account (PDA signs) — do this before burn
        // so if PDA already exists, instruction fails before burning shares
        let pending_bump_bytes = [pending_bump];
        let pending_seeds: [Seed; 4] = [
            Seed::from(b"pending_withdraw" as &[u8]),
            Seed::from(vault_state_key.as_ref()),
            Seed::from(withdrawer_key.as_ref()),
            Seed::from(&pending_bump_bytes),
        ];
        let pending_signers: [Signer; 1] = [Signer::from(&pending_seeds)];

        CreateAccount {
            from: self.withdrawer,
            to: self.pending_withdraw,
            lamports: crate::rent::minimum_balance(PendingWithdraw::LEN),
            space: PendingWithdraw::LEN as u64,
            owner: &crate::ID,
        }
        .invoke_signed(&pending_signers)?;

        // Write pending withdraw state
        {
            let mut data = self.pending_withdraw.try_borrow_mut_data()?;
            let state: &mut PendingWithdraw =
                bytemuck::from_bytes_mut(&mut data[..PendingWithdraw::LEN]);

            state.discriminator = PENDING_WITHDRAW_DISCRIMINATOR;
            state.bump = pending_bump;
            state.vault_state = *vault_state_key;
            state.withdrawer = *withdrawer_key;
            state.shares = self.shares;
        }

        // Burn share tokens from withdrawer
        Burn {
            account: self.withdrawer_share_ata,
            mint: self.share_mint,
            authority: self.withdrawer,
            amount: self.shares,
        }
        .invoke()?;

        Ok(())
    }
}

impl<'a> TryFrom<(&'a [u8], &'a [AccountInfo])> for RequestWithdraw<'a> {
    type Error = ProgramError;

    fn try_from(
        (data, accounts): (&'a [u8], &'a [AccountInfo]),
    ) -> Result<Self, Self::Error> {
        let [withdrawer, withdrawer_share_ata, share_mint, vault_state, pending_withdraw, system_program, token_program, ..] =
            accounts
        else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        if !withdrawer.is_signer() {
            return Err(ProgramError::MissingRequiredSignature);
        }
        if !withdrawer.is_writable() {
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
            vault_state,
            pending_withdraw,
            _system_program: system_program,
            _token_program: token_program,
            shares,
        })
    }
}
