use pinocchio::{
    account_info::AccountInfo,
    program_error::ProgramError,
    ProgramResult,
};

use crate::error::VaultError;
use crate::fees;
use crate::state::{VaultState, VAULT_DISCRIMINATOR};

/// Admin-only: configure vault fee parameters.
///
/// Sets entry/exit/management/performance fee rates and the fee receiver
/// address. All fee rates are in basis points (10,000 = 100%).
///
/// Accounts:
///   0. `[signer]`    admin       — must be vault admin
///   1. `[writable]`  vault_state — PDA (fees updated)
///
/// Data:
///   [0]     discriminator (0x05)
///   [1..3]  entry_fee_bps (u16 LE)
///   [3..5]  exit_fee_bps (u16 LE)
///   [5..7]  management_fee_bps (u16 LE)
///   [7..9]  performance_fee_bps (u16 LE)
///   [9..41] fee_receiver (32 bytes, pubkey)
pub struct UpdateFees<'a> {
    admin: &'a AccountInfo,
    vault_state: &'a AccountInfo,
    entry_fee_bps: u16,
    exit_fee_bps: u16,
    management_fee_bps: u16,
    performance_fee_bps: u16,
    fee_receiver: [u8; 32],
}

impl<'a> UpdateFees<'a> {
    pub const DISCRIMINATOR: u8 = 5;

    pub fn process(self) -> ProgramResult {
        let mut data = self.vault_state.try_borrow_mut_data()?;
        let state: &mut VaultState =
            bytemuck::from_bytes_mut(&mut data[..VaultState::LEN]);

        if !state.is_admin(self.admin.key()) {
            return Err(VaultError::Unauthorized.into());
        }

        state.entry_fee_bps = self.entry_fee_bps;
        state.exit_fee_bps = self.exit_fee_bps;
        state.management_fee_bps = self.management_fee_bps;
        state.performance_fee_bps = self.performance_fee_bps;
        state.fee_receiver = self.fee_receiver;

        // Initialize high_water_mark to current price if not set
        if state.high_water_mark == 0 {
            state.high_water_mark = state.share_price;
        }

        Ok(())
    }
}

impl<'a> TryFrom<(&'a [u8], &'a [AccountInfo])> for UpdateFees<'a> {
    type Error = ProgramError;

    fn try_from(
        (data, accounts): (&'a [u8], &'a [AccountInfo]),
    ) -> Result<Self, Self::Error> {
        let [admin, vault_state, ..] = accounts else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        if !admin.is_signer() {
            return Err(ProgramError::MissingRequiredSignature);
        }
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

        // Parse: [entry: u16] [exit: u16] [mgmt: u16] [perf: u16] [receiver: 32]
        if data.len() < 40 {
            return Err(ProgramError::InvalidInstructionData);
        }

        let entry_fee_bps = u16::from_le_bytes(
            data[0..2].try_into().map_err(|_| ProgramError::InvalidInstructionData)?,
        );
        let exit_fee_bps = u16::from_le_bytes(
            data[2..4].try_into().map_err(|_| ProgramError::InvalidInstructionData)?,
        );
        let management_fee_bps = u16::from_le_bytes(
            data[4..6].try_into().map_err(|_| ProgramError::InvalidInstructionData)?,
        );
        let performance_fee_bps = u16::from_le_bytes(
            data[6..8].try_into().map_err(|_| ProgramError::InvalidInstructionData)?,
        );

        if !fees::validate_fee_bps(entry_fee_bps, exit_fee_bps, management_fee_bps, performance_fee_bps) {
            return Err(VaultError::FeeExceedsMaximum.into());
        }

        let mut fee_receiver = [0u8; 32];
        fee_receiver.copy_from_slice(&data[8..40]);

        Ok(Self {
            admin,
            vault_state,
            entry_fee_bps,
            exit_fee_bps,
            management_fee_bps,
            performance_fee_bps,
            fee_receiver,
        })
    }
}
