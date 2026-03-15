use pinocchio::{
    account_info::AccountInfo,
    instruction::{Seed, Signer},
    program_error::ProgramError,
    ProgramResult,
};

use crate::error::VaultError;
use crate::fees;
use crate::state::{VaultState, VAULT_DISCRIMINATOR};
use crate::token2022;

/// Offset of `supply` (u64 LE) within SPL Mint account data.
const MINT_SUPPLY_OFFSET: usize = 36;

/// Admin-only: collect management and performance fees.
///
/// Calculates time-based management fees and HWM-based performance fees,
/// then mints the fee shares to the fee_receiver's token account.
///
/// Accounts:
///   0. `[signer]`    admin              — must be vault admin
///   1. `[writable]`  vault_state        — PDA (timestamps/HWM updated)
///   2. `[writable]`  share_mint         — read supply + mint fee shares
///   3. `[writable]`  fee_receiver_ata   — destination for minted fee shares
///   4. `[]`          token_program
///
/// Data:
///   [0]    discriminator (0x06)
///   [1..9] current_timestamp (i64 LE) — current unix timestamp
pub struct CollectFees<'a> {
    admin: &'a AccountInfo,
    vault_state: &'a AccountInfo,
    share_mint: &'a AccountInfo,
    fee_receiver_ata: &'a AccountInfo,
    token_program: &'a AccountInfo,
    current_timestamp: i64,
}

impl<'a> CollectFees<'a> {
    pub const DISCRIMINATOR: u8 = 6;

    pub fn process(self) -> ProgramResult {
        // Read total supply from share mint account
        let total_supply = {
            let mint_data = self.share_mint.try_borrow_data()?;
            if mint_data.len() < MINT_SUPPLY_OFFSET + 8 {
                return Err(ProgramError::InvalidAccountData);
            }
            u64::from_le_bytes(
                mint_data[MINT_SUPPLY_OFFSET..MINT_SUPPLY_OFFSET + 8]
                    .try_into()
                    .map_err(|_| ProgramError::InvalidAccountData)?,
            )
        };

        // Read vault state and calculate fees
        let vault_bump;
        let vn_len;
        let vault_name;
        let total_fee_shares;
        {
            let mut vs_data = self.vault_state.try_borrow_mut_data()?;
            let state: &mut VaultState =
                bytemuck::from_bytes_mut(&mut vs_data[..VaultState::LEN]);

            if !state.is_admin(self.admin.key()) {
                return Err(VaultError::Unauthorized.into());
            }

            if state.share_mint != *self.share_mint.key() {
                return Err(ProgramError::InvalidAccountData);
            }

            if !state.has_fee_receiver() {
                return Err(VaultError::NoFeesToCollect.into());
            }

            // First call: just initialize timestamp, no fees
            if state.last_fee_timestamp == 0 {
                state.last_fee_timestamp = self.current_timestamp;
                return Ok(());
            }

            // Timestamp must be >= last collection
            if self.current_timestamp < state.last_fee_timestamp {
                return Err(ProgramError::InvalidInstructionData);
            }

            let elapsed = (self.current_timestamp - state.last_fee_timestamp) as u64;

            // Management fee
            let mgmt_shares = fees::management_fee_shares(
                total_supply,
                state.management_fee_bps,
                elapsed,
            )
            .ok_or(VaultError::MathOverflow)?;

            // Performance fee
            let perf_shares = fees::performance_fee_shares(
                state.share_price,
                state.high_water_mark,
                total_supply,
                state.performance_fee_bps,
            )
            .ok_or(VaultError::MathOverflow)?;

            total_fee_shares = mgmt_shares
                .checked_add(perf_shares)
                .ok_or(VaultError::MathOverflow)?;

            // Update timestamps and HWM
            state.last_fee_timestamp = self.current_timestamp;
            if state.performance_fee_bps > 0 && state.share_price > state.high_water_mark {
                state.high_water_mark = state.share_price;
            }

            vault_bump = state.bump;
            vn_len = state.vault_name_len as usize;
            vault_name = state.vault_name;
        }

        // Mint fee shares if any
        if total_fee_shares > 0 {
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
                self.fee_receiver_ata,
                self.vault_state,
                total_fee_shares,
                &signers,
            )?;
        }

        Ok(())
    }
}

impl<'a> TryFrom<(&'a [u8], &'a [AccountInfo])> for CollectFees<'a> {
    type Error = ProgramError;

    fn try_from(
        (data, accounts): (&'a [u8], &'a [AccountInfo]),
    ) -> Result<Self, Self::Error> {
        let [admin, vault_state, share_mint, fee_receiver_ata, token_program, ..] =
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

        // Parse: [current_timestamp: i64 LE]
        if data.len() < 8 {
            return Err(ProgramError::InvalidInstructionData);
        }
        let current_timestamp = i64::from_le_bytes(
            data[..8]
                .try_into()
                .map_err(|_| ProgramError::InvalidInstructionData)?,
        );
        if current_timestamp <= 0 {
            return Err(ProgramError::InvalidInstructionData);
        }

        Ok(Self {
            admin,
            vault_state,
            share_mint,
            fee_receiver_ata,
            token_program,
            current_timestamp,
        })
    }
}
