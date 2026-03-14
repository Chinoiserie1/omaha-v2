use pinocchio::{
    account_info::AccountInfo,
    instruction::{Seed, Signer},
    program_error::ProgramError,
    ProgramResult,
};
use pinocchio::pubkey::find_program_address;
use pinocchio_system::instructions::CreateAccount;

use crate::error::VaultError;
use crate::state::{VaultState, VAULT_DISCRIMINATOR};
use crate::token2022;

/// Initialize a new vault with a Token 2022 share mint (metadata + close authority).
///
/// All fee fields default to 0 (no fees). Use UpdateFees to configure fees.
///
/// Accounts:
///   0. `[signer]`           program_authority — must match PROGRAM_AUTHORITY constant
///   1. `[signer, writable]` admin — pays for account creation, becomes vault admin
///   2. `[writable]`         vault_state — PDA: ["vault", admin, base_mint]
///   3. `[writable]`         share_mint — PDA: ["share_mint", vault_state]
///   4. `[]`                 base_mint — the deposit token (e.g. USDC)
///   5. `[]`                 system_program
///   6. `[]`                 token_program — must be Token 2022
///
/// Data:
///   [0]       discriminator (0x00)
///   [1]       share_decimals (u8)
///   [2..10]   initial share_price (u64 LE)
///   [10..12]  name_len (u16 LE)
///   [12..12+N] name bytes (UTF-8)
///   [..+2]    symbol_len (u16 LE)
///   [..+S]    symbol bytes (UTF-8)
///   [..+2]    uri_len (u16 LE)
///   [..+U]    uri bytes (UTF-8)
pub struct Initialize<'a> {
    _program_authority: &'a AccountInfo,
    admin: &'a AccountInfo,
    vault_state: &'a AccountInfo,
    share_mint: &'a AccountInfo,
    base_mint: &'a AccountInfo,
    _system_program: &'a AccountInfo,
    token_program: &'a AccountInfo,
    share_decimals: u8,
    share_price: u64,
    name: &'a [u8],
    symbol: &'a [u8],
    uri: &'a [u8],
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

        // Calculate Token 2022 mint space:
        // - initial_space (188): for CreateAccount (MintCloseAuthority + MetadataPointer only)
        // - final_space: for lamports (includes TokenMetadata, which reallocs after InitializeMint2)
        let final_mint_space = token2022::calculate_mint_space(
            self.name.len(),
            self.symbol.len(),
            self.uri.len(),
        );

        // Create share mint account — owned by Token 2022
        // Space = INITIAL_MINT_SPACE (Token 2022 does strict size check in InitializeMint2)
        // Lamports = rent for final size (Token 2022 reallocs during InitializeTokenMetadata)
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
            lamports: crate::rent::minimum_balance(final_mint_space),
            space: token2022::INITIAL_MINT_SPACE as u64,
            owner: self.token_program.key(),
        }
        .invoke_signed(&mint_signers)?;

        // Initialize extensions BEFORE InitializeMint2 (Token 2022 requirement)

        // 1. MintCloseAuthority — vault_state PDA as close authority
        token2022::initialize_mint_close_authority(
            self.token_program,
            self.share_mint,
            vault_state_key.as_ref().try_into().unwrap(),
        )?;

        // 2. MetadataPointer — self-referential (metadata = mint itself)
        let share_mint_key = self.share_mint.key();
        token2022::initialize_metadata_pointer(
            self.token_program,
            self.share_mint,
            vault_state_key.as_ref().try_into().unwrap(),
            share_mint_key.as_ref().try_into().unwrap(),
        )?;

        // 3. InitializeMint2 — vault_state PDA is mint authority
        token2022::initialize_mint2(
            self.token_program,
            self.share_mint,
            self.share_decimals,
            vault_state_key.as_ref().try_into().unwrap(),
            None,
        )?;

        // 4. Initialize token metadata (AFTER InitializeMint2)
        // vault_state PDA signs as mint_authority
        token2022::initialize_token_metadata(
            self.token_program,
            self.share_mint,
            self.vault_state,   // update_authority
            self.vault_state,   // mint_authority (signer)
            self.name,
            self.symbol,
            self.uri,
            &vault_signers,
        )?;

        // Write vault state (fee fields are zeroed by CreateAccount)
        let mut data = self.vault_state.try_borrow_mut_data()?;
        let state: &mut VaultState =
            bytemuck::from_bytes_mut(&mut data[..VaultState::LEN]);

        state.discriminator = VAULT_DISCRIMINATOR;
        state.bump = vault_bump;
        state.share_decimals = self.share_decimals;
        state.num_owners = 0;
        // entry_fee_bps, exit_fee_bps, management_fee_bps, performance_fee_bps = 0
        state.admin = *admin_key;
        state.share_mint = *self.share_mint.key();
        state.base_mint = *base_mint_key;
        // fee_receiver = [0; 32] (no fees until UpdateFees is called)
        state.share_price = self.share_price;
        state.high_water_mark = self.share_price;
        // last_fee_timestamp = 0 (initialized on first CollectFees call)

        Ok(())
    }
}

impl<'a> TryFrom<(&'a [u8], &'a [AccountInfo])> for Initialize<'a> {
    type Error = ProgramError;

    fn try_from(
        (data, accounts): (&'a [u8], &'a [AccountInfo]),
    ) -> Result<Self, Self::Error> {
        let [program_authority, admin, vault_state, share_mint, base_mint, system_program, token_program, ..] =
            accounts
        else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        // Verify program authority is a signer and matches the hardcoded constant
        if !program_authority.is_signer() {
            return Err(ProgramError::MissingRequiredSignature);
        }
        if program_authority.key().as_ref() != &crate::PROGRAM_AUTHORITY {
            return Err(VaultError::UnauthorizedInitializer.into());
        }

        if !admin.is_signer() {
            return Err(ProgramError::MissingRequiredSignature);
        }
        if !admin.is_writable() || !vault_state.is_writable() || !share_mint.is_writable() {
            return Err(ProgramError::InvalidAccountData);
        }

        // Verify token_program is Token 2022
        if token_program.key().as_ref() != &token2022::TOKEN_2022_PROGRAM_ID {
            return Err(ProgramError::IncorrectProgramId);
        }

        // data layout: [share_decimals: u8] [share_price: u64 LE] [name_len: u16 LE] [name] [symbol_len: u16 LE] [symbol] [uri_len: u16 LE] [uri]
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

        // Parse metadata strings
        let mut offset = 9;

        // name
        if data.len() < offset + 2 {
            return Err(ProgramError::InvalidInstructionData);
        }
        let name_len = u16::from_le_bytes(
            data[offset..offset + 2]
                .try_into()
                .map_err(|_| ProgramError::InvalidInstructionData)?,
        ) as usize;
        offset += 2;
        if name_len > token2022::MAX_METADATA_STRING_LEN || data.len() < offset + name_len {
            return Err(VaultError::InvalidMetadata.into());
        }
        let name = &data[offset..offset + name_len];
        offset += name_len;

        // symbol
        if data.len() < offset + 2 {
            return Err(ProgramError::InvalidInstructionData);
        }
        let symbol_len = u16::from_le_bytes(
            data[offset..offset + 2]
                .try_into()
                .map_err(|_| ProgramError::InvalidInstructionData)?,
        ) as usize;
        offset += 2;
        if symbol_len > token2022::MAX_METADATA_STRING_LEN || data.len() < offset + symbol_len {
            return Err(VaultError::InvalidMetadata.into());
        }
        let symbol = &data[offset..offset + symbol_len];
        offset += symbol_len;

        // uri
        if data.len() < offset + 2 {
            return Err(ProgramError::InvalidInstructionData);
        }
        let uri_len = u16::from_le_bytes(
            data[offset..offset + 2]
                .try_into()
                .map_err(|_| ProgramError::InvalidInstructionData)?,
        ) as usize;
        offset += 2;
        if uri_len > token2022::MAX_METADATA_STRING_LEN || data.len() < offset + uri_len {
            return Err(VaultError::InvalidMetadata.into());
        }
        let uri = &data[offset..offset + uri_len];

        Ok(Self {
            _program_authority: program_authority,
            admin,
            vault_state,
            share_mint,
            base_mint,
            _system_program: system_program,
            token_program,
            share_decimals,
            share_price,
            name,
            symbol,
            uri,
        })
    }
}
