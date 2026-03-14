use pinocchio::{
    account_info::AccountInfo,
    instruction::{Seed, Signer},
    program_error::ProgramError,
    ProgramResult,
};

use crate::error::VaultError;
use crate::state::{PendingDeposit, VaultState, PENDING_DEPOSIT_DISCRIMINATOR, VAULT_DISCRIMINATOR};
use crate::token2022;

/// Admin-only: fulfill a pending deposit by setting share price and minting shares.
///
/// The admin sets the new share price, shares are calculated from the
/// pending deposit amount, minted to the depositor, and the PendingDeposit
/// PDA is closed (rent refunded to depositor). Entry fees are applied if configured.
///
/// Accounts:
///   0. `[signer]`    admin              — must be vault admin
///   1. `[writable]`  vault_state        — PDA (price updated)
///   2. `[writable]`  pending_deposit    — PDA to read and close
///   3. `[writable]`  share_mint         — share token mint
///   4. `[writable]`  depositor_share_ata — destination for minted shares
///   5. `[writable]`  depositor          — receives rent refund (NOT a signer)
///   6. `[]`          token_program
///   7. `[writable]`  fee_receiver_ata   — (optional) destination for fee shares
///
/// Data:
///   [0]    discriminator (0x09)
///   [1..9] new_share_price (u64 LE)
pub struct FulfillDeposit<'a> {
    admin: &'a AccountInfo,
    vault_state: &'a AccountInfo,
    pending_deposit: &'a AccountInfo,
    share_mint: &'a AccountInfo,
    depositor_share_ata: &'a AccountInfo,
    depositor: &'a AccountInfo,
    token_program: &'a AccountInfo,
    fee_receiver_ata: Option<&'a AccountInfo>,
    new_share_price: u64,
}

impl<'a> FulfillDeposit<'a> {
    pub const DISCRIMINATOR: u8 = 9;

    pub fn process(self) -> ProgramResult {
        // Read pending deposit
        let deposit_amount;
        let pending_depositor;
        let pending_vault;
        {
            let pd_data = self.pending_deposit.try_borrow_data()?;
            let pending: &PendingDeposit =
                bytemuck::from_bytes(&pd_data[..PendingDeposit::LEN]);

            deposit_amount = pending.amount;
            pending_depositor = pending.depositor;
            pending_vault = pending.vault_state;
        }

        // Verify depositor account matches pending deposit
        if *self.depositor.key() != pending_depositor {
            return Err(ProgramError::InvalidAccountData);
        }

        // Verify pending deposit belongs to this vault
        if *self.vault_state.key() != pending_vault {
            return Err(ProgramError::InvalidAccountData);
        }

        // Borrow vault state mutably to update price and read config
        let share_decimals;
        let vault_bump;
        let admin_bytes;
        let base_mint_bytes;
        let entry_fee_bps;
        let has_fee_receiver;
        {
            let mut vs_data = self.vault_state.try_borrow_mut_data()?;
            let state: &mut VaultState =
                bytemuck::from_bytes_mut(&mut vs_data[..VaultState::LEN]);

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

            share_decimals = state.share_decimals;
            vault_bump = state.bump;
            admin_bytes = state.admin;
            base_mint_bytes = state.base_mint;
            entry_fee_bps = state.entry_fee_bps;
            has_fee_receiver = state.has_fee_receiver();
        }

        // Calculate shares to mint: amount * 10^share_decimals / share_price
        let share_multiplier = 10u64
            .checked_pow(share_decimals as u32)
            .ok_or(VaultError::MathOverflow)?;
        let gross_shares = deposit_amount
            .checked_mul(share_multiplier)
            .ok_or(VaultError::MathOverflow)?
            .checked_div(self.new_share_price)
            .ok_or(VaultError::MathOverflow)?;

        if gross_shares == 0 {
            return Err(VaultError::InvalidAmount.into());
        }

        // Apply entry fee
        let (user_shares, fee_shares) = if entry_fee_bps > 0 && has_fee_receiver {
            crate::fees::apply_fee(gross_shares, entry_fee_bps)
                .ok_or(VaultError::MathOverflow)?
        } else {
            (gross_shares, 0u64)
        };

        // Mint share tokens to depositor (vault_state PDA is mint authority)
        let vault_bump_bytes = [vault_bump];
        let seeds: [Seed; 4] = [
            Seed::from(b"vault" as &[u8]),
            Seed::from(&admin_bytes),
            Seed::from(&base_mint_bytes),
            Seed::from(&vault_bump_bytes),
        ];
        let signers: [Signer; 1] = [Signer::from(&seeds)];

        token2022::mint_to(
            self.token_program,
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
                self.token_program,
                self.share_mint,
                fee_ata,
                self.vault_state,
                fee_shares,
                &signers,
            )?;
        }

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

impl<'a> TryFrom<(&'a [u8], &'a [AccountInfo])> for FulfillDeposit<'a> {
    type Error = ProgramError;

    fn try_from(
        (data, accounts): (&'a [u8], &'a [AccountInfo]),
    ) -> Result<Self, Self::Error> {
        let [admin, vault_state, pending_deposit, share_mint, depositor_share_ata, depositor, token_program, ..] =
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

        // Validate depositor is writable (receives rent refund)
        if !depositor.is_writable() {
            return Err(ProgramError::InvalidAccountData);
        }

        // Optional fee_receiver_ata (8th account, index 7)
        let fee_receiver_ata = accounts.get(7);

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
            pending_deposit,
            share_mint,
            depositor_share_ata,
            depositor,
            token_program,
            fee_receiver_ata,
            new_share_price,
        })
    }
}
