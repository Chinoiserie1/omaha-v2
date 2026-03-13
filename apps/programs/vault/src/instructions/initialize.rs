use pinocchio::{
    account_info::AccountInfo,
    instruction::{Seed, Signer},
    program_error::ProgramError,
    ProgramResult,
};
use pinocchio::pubkey::find_program_address;
use pinocchio_system::instructions::CreateAccount;
use pinocchio_token::instructions::InitializeMint2;

use crate::error::VaultError;
use crate::state::{VaultState, VAULT_DISCRIMINATOR};

/// Initialize a new vault.
///
/// Accounts:
///   0. `[signer, writable]` admin — pays for account creation, becomes vault admin
///   1. `[writable]`         vault_state — PDA: ["vault", admin, base_mint]
///   2. `[writable]`         share_mint — PDA: ["share_mint", vault_state]
///   3. `[]`                 base_mint — the deposit token (e.g. USDC)
///   4. `[]`                 system_program
///   5. `[]`                 token_program
///
/// Data:
///   [0]    discriminator (0x00)
///   [1]    share_decimals (u8)
///   [2..10] initial share_price (u64 LE)
pub struct Initialize<'a> {
    admin: &'a AccountInfo,
    vault_state: &'a AccountInfo,
    share_mint: &'a AccountInfo,
    base_mint: &'a AccountInfo,
    _system_program: &'a AccountInfo,
    _token_program: &'a AccountInfo,
    share_decimals: u8,
    share_price: u64,
}

impl<'a> Initialize<'a> {
    pub const DISCRIMINATOR: u8 = 0;

    pub fn process(self) -> ProgramResult {
        // Derive vault PDA and verify address
        let admin_key = self.admin.key();
        let base_mint_key = self.base_mint.key();

        let (expected_vault, vault_bump) = find_program_address(
            &[b"vault", admin_key.as_ref(), base_mint_key.as_ref()],
            &crate::ID,
        );
        if self.vault_state.key() != &expected_vault {
            return Err(ProgramError::InvalidSeeds);
        }

        // Derive share mint PDA
        let vault_state_key = self.vault_state.key();
        let (expected_mint, mint_bump) = find_program_address(
            &[b"share_mint", vault_state_key.as_ref()],
            &crate::ID,
        );
        if self.share_mint.key() != &expected_mint {
            return Err(ProgramError::InvalidSeeds);
        }

        // Create vault state account
        let vault_bump_bytes = [vault_bump];
        let vault_seeds: [Seed; 4] = [
            Seed::from(b"vault" as &[u8]),
            Seed::from(admin_key.as_ref()),
            Seed::from(base_mint_key.as_ref()),
            Seed::from(&vault_bump_bytes),
        ];
        let vault_signers: [Signer; 1] = [Signer::from(&vault_seeds)];

        CreateAccount {
            from: self.admin,
            to: self.vault_state,
            lamports: crate::rent::minimum_balance(VaultState::LEN),
            space: VaultState::LEN as u64,
            owner: &crate::ID,
        }
        .invoke_signed(&vault_signers)?;

        // Create share mint account (82 bytes for SPL Mint)
        let mint_bump_bytes = [mint_bump];
        let mint_seeds: [Seed; 3] = [
            Seed::from(b"share_mint" as &[u8]),
            Seed::from(vault_state_key.as_ref()),
            Seed::from(&mint_bump_bytes),
        ];
        let mint_signers: [Signer; 1] = [Signer::from(&mint_seeds)];

        CreateAccount {
            from: self.admin,
            to: self.share_mint,
            lamports: crate::rent::minimum_balance(82),
            space: 82,
            owner: self._token_program.key(),
        }
        .invoke_signed(&mint_signers)?;

        // Initialize the mint — vault_state PDA is mint authority
        InitializeMint2 {
            mint: self.share_mint,
            decimals: self.share_decimals,
            mint_authority: vault_state_key,
            freeze_authority: None,
        }
        .invoke()?;

        // Write vault state
        let mut data = self.vault_state.try_borrow_mut_data()?;
        let state: &mut VaultState =
            bytemuck::from_bytes_mut(&mut data[..VaultState::LEN]);

        state.discriminator = VAULT_DISCRIMINATOR;
        state.bump = vault_bump;
        state.share_decimals = self.share_decimals;
        state.num_owners = 0;
        state.admin = *admin_key;
        state.share_mint = *self.share_mint.key();
        state.base_mint = *base_mint_key;
        state.share_price = self.share_price;

        Ok(())
    }
}

impl<'a> TryFrom<(&'a [u8], &'a [AccountInfo])> for Initialize<'a> {
    type Error = ProgramError;

    fn try_from(
        (data, accounts): (&'a [u8], &'a [AccountInfo]),
    ) -> Result<Self, Self::Error> {
        let [admin, vault_state, share_mint, base_mint, system_program, token_program, ..] =
            accounts
        else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        if !admin.is_signer() {
            return Err(ProgramError::MissingRequiredSignature);
        }
        if !admin.is_writable() || !vault_state.is_writable() || !share_mint.is_writable() {
            return Err(ProgramError::InvalidAccountData);
        }

        // data layout: [share_decimals: u8] [share_price: u64 LE]
        if data.len() < 9 {
            return Err(ProgramError::InvalidInstructionData);
        }
        let share_decimals = data[0];
        let share_price = u64::from_le_bytes(
            data[1..9]
                .try_into()
                .map_err(|_| ProgramError::InvalidInstructionData)?,
        );

        if share_price == 0 {
            return Err(VaultError::InvalidSharePrice.into());
        }

        Ok(Self {
            admin,
            vault_state,
            share_mint,
            base_mint,
            _system_program: system_program,
            _token_program: token_program,
            share_decimals,
            share_price,
        })
    }
}
