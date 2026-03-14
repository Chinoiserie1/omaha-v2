use pinocchio::{
    account_info::AccountInfo,
    cpi,
    instruction::{AccountMeta, Instruction, Signer},
    program_error::ProgramError,
    ProgramResult,
};

/// SPL Token 2022 program ID (`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`).
pub const TOKEN_2022_PROGRAM_ID: [u8; 32] = [
    6, 221, 246, 225, 238, 117, 143, 222, 24, 66, 93, 188, 228, 108, 205, 218,
    182, 26, 252, 77, 131, 185, 13, 39, 254, 189, 249, 40, 216, 161, 139, 252,
];

/// 8-byte discriminator for spl-token-metadata-interface Initialize instruction.
/// SHA256("spl_token_metadata_interface:initialize_account")[0..8]
const METADATA_INIT_DISCRIMINATOR: [u8; 8] = [
    210, 225, 30, 162, 88, 184, 77, 141,
];

/// MintTo via Token 2022: discriminator 7.
pub fn mint_to<'a>(
    token_program: &'a AccountInfo,
    mint: &'a AccountInfo,
    account: &'a AccountInfo,
    mint_authority: &'a AccountInfo,
    amount: u64,
    signers: &[Signer],
) -> ProgramResult {
    let mut data = [0u8; 9];
    data[0] = 7;
    data[1..9].copy_from_slice(&amount.to_le_bytes());

    let metas = [
        AccountMeta::writable(mint.key()),
        AccountMeta::writable(account.key()),
        AccountMeta::readonly_signer(mint_authority.key()),
    ];

    let ix = Instruction {
        program_id: token_program.key(),
        accounts: &metas,
        data: &data,
    };

    cpi::slice_invoke_signed(
        &ix,
        &[mint, account, mint_authority, token_program],
        signers,
    )
}

/// Burn via Token 2022: discriminator 8.
pub fn burn<'a>(
    token_program: &'a AccountInfo,
    account: &'a AccountInfo,
    mint: &'a AccountInfo,
    authority: &'a AccountInfo,
    amount: u64,
    signers: &[Signer],
) -> ProgramResult {
    let mut data = [0u8; 9];
    data[0] = 8;
    data[1..9].copy_from_slice(&amount.to_le_bytes());

    let metas = [
        AccountMeta::writable(account.key()),
        AccountMeta::writable(mint.key()),
        AccountMeta::readonly_signer(authority.key()),
    ];

    let ix = Instruction {
        program_id: token_program.key(),
        accounts: &metas,
        data: &data,
    };

    cpi::slice_invoke_signed(
        &ix,
        &[account, mint, authority, token_program],
        signers,
    )
}

/// InitializeMint2 via Token 2022: discriminator 20.
pub fn initialize_mint2<'a>(
    token_program: &'a AccountInfo,
    mint: &'a AccountInfo,
    decimals: u8,
    mint_authority: &[u8; 32],
    freeze_authority: Option<&[u8; 32]>,
) -> ProgramResult {
    let mut data = [0u8; 67];
    data[0] = 20;
    data[1] = decimals;
    data[2..34].copy_from_slice(mint_authority);
    match freeze_authority {
        Some(key) => {
            data[34] = 1;
            data[35..67].copy_from_slice(key);
        }
        None => {
            data[34] = 0;
            // remaining 32 bytes stay zeroed
        }
    }

    let metas = [AccountMeta::writable(mint.key())];

    let ix = Instruction {
        program_id: token_program.key(),
        accounts: &metas,
        data: &data,
    };

    cpi::slice_invoke_signed(&ix, &[mint, token_program], &[])
}

/// InitializeMintCloseAuthority: Token 2022 instruction type 25.
pub fn initialize_mint_close_authority<'a>(
    token_program: &'a AccountInfo,
    mint: &'a AccountInfo,
    close_authority: &[u8; 32],
) -> ProgramResult {
    let mut data = [0u8; 37];
    data[0] = 25;
    // COption<Pubkey>: tag = 1 (Some), then 32-byte pubkey
    data[1..5].copy_from_slice(&1u32.to_le_bytes());
    data[5..37].copy_from_slice(close_authority);

    let metas = [AccountMeta::writable(mint.key())];

    let ix = Instruction {
        program_id: token_program.key(),
        accounts: &metas,
        data: &data,
    };

    cpi::slice_invoke_signed(&ix, &[mint, token_program], &[])
}

/// InitializeMetadataPointer: Token 2022 extension instruction type 39, sub-instruction 0.
pub fn initialize_metadata_pointer<'a>(
    token_program: &'a AccountInfo,
    mint: &'a AccountInfo,
    authority: &[u8; 32],
    metadata_address: &[u8; 32],
) -> ProgramResult {
    let mut data = [0u8; 66];
    data[0] = 39; // MetadataPointerExtension
    data[1] = 0;  // Initialize sub-instruction
    data[2..34].copy_from_slice(authority);
    data[34..66].copy_from_slice(metadata_address);

    let metas = [AccountMeta::writable(mint.key())];

    let ix = Instruction {
        program_id: token_program.key(),
        accounts: &metas,
        data: &data,
    };

    cpi::slice_invoke_signed(&ix, &[mint, token_program], &[])
}

/// Max length for metadata strings (name, symbol, uri).
pub const MAX_METADATA_STRING_LEN: usize = 128;

/// Initialize token metadata on a Token 2022 mint (self-referential pointer).
///
/// Uses the spl-token-metadata-interface Initialize instruction format.
///
/// Accounts:
///   1. metadata (writable) — the mint account itself
///   2. update_authority — vault_state PDA
///   3. mint — the mint account (same as metadata)
///   4. mint_authority (signer) — vault_state PDA
pub fn initialize_token_metadata<'a>(
    token_program: &'a AccountInfo,
    mint: &'a AccountInfo,
    update_authority: &'a AccountInfo,
    mint_authority: &'a AccountInfo,
    name: &[u8],
    symbol: &[u8],
    uri: &[u8],
    signers: &[Signer],
) -> ProgramResult {
    // Max data: 8 (disc) + 3*(4 + MAX_METADATA_STRING_LEN) = 8 + 396 = 404
    let data_len = 8 + 4 + name.len() + 4 + symbol.len() + 4 + uri.len();
    if data_len > 404 {
        return Err(ProgramError::InvalidInstructionData);
    }

    let mut data = [0u8; 404];
    data[0..8].copy_from_slice(&METADATA_INIT_DISCRIMINATOR);

    let mut offset = 8;

    // name (Borsh String: u32 LE length + bytes)
    data[offset..offset + 4].copy_from_slice(&(name.len() as u32).to_le_bytes());
    offset += 4;
    data[offset..offset + name.len()].copy_from_slice(name);
    offset += name.len();

    // symbol
    data[offset..offset + 4].copy_from_slice(&(symbol.len() as u32).to_le_bytes());
    offset += 4;
    data[offset..offset + symbol.len()].copy_from_slice(symbol);
    offset += symbol.len();

    // uri
    data[offset..offset + 4].copy_from_slice(&(uri.len() as u32).to_le_bytes());
    offset += 4;
    data[offset..offset + uri.len()].copy_from_slice(uri);
    offset += uri.len();

    let metas = [
        AccountMeta::writable(mint.key()),           // metadata = mint
        AccountMeta::readonly(update_authority.key()), // update_authority
        AccountMeta::readonly(mint.key()),            // mint (same as metadata)
        AccountMeta::readonly_signer(mint_authority.key()), // mint_authority
    ];

    let ix = Instruction {
        program_id: token_program.key(),
        accounts: &metas,
        data: &data[..offset],
    };

    cpi::slice_invoke_signed(
        &ix,
        &[mint, update_authority, mint, mint_authority, token_program],
        signers,
    )
}

/// Initial mint space for CreateAccount (before InitializeMint2).
///
/// Token 2022 pads Mint accounts to Account::LEN (165) before the AccountType byte.
/// This ensures all extended accounts (Mint and Token) share a common base size.
/// TokenMetadata is variable-length and initializes AFTER InitializeMint2 via realloc.
///
/// Layout (270 bytes):
///   165  padded base (82 mint + 83 zero-padding to Account::LEN)
///   1    AccountType byte
///   36   MintCloseAuthority TLV (2 type + 2 length + 32 data)
///   68   MetadataPointer TLV (2 type + 2 length + 64 data)
pub const INITIAL_MINT_SPACE: usize = 166 + 36 + 68; // = 270

/// Calculate final mint space after TokenMetadata initialization (for lamports).
///
/// The CreateAccount allocates only `INITIAL_MINT_SPACE` bytes, but must be funded
/// with enough lamports for the full final size. Token 2022's InitializeTokenMetadata
/// reallocs the account internally.
pub fn calculate_mint_space(name_len: usize, symbol_len: usize, uri_len: usize) -> usize {
    let metadata_data = 32   // update_authority
        + 32                 // mint pubkey
        + 4 + name_len      // name (borsh string)
        + 4 + symbol_len    // symbol (borsh string)
        + 4 + uri_len       // uri (borsh string)
        + 4;                 // empty additional_metadata vec
    let total = INITIAL_MINT_SPACE + 4 + metadata_data; // +4 for TLV header
    // Avoid Multisig::LEN (355) ambiguity — Token 2022 adds 2 bytes if sizes match
    if total == 355 {
        total + 2
    } else {
        total
    }
}
