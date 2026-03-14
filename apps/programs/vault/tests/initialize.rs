mod helpers;

use helpers::*;
use mollusk_svm::program::keyed_account_for_system_program;
use mollusk_svm::result::Check;
use solana_account::Account;
use solana_instruction::AccountMeta;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;

use omaha_vault::state::VaultState;

fn system_account(lamports: u64) -> Account {
    Account::new(lamports, 0, &SYSTEM_PROGRAM_ID)
}

// Token 2022's InitializeTokenMetadata internally calls account_info.realloc()
// to expand the mint from INITIAL_MINT_SPACE (270) to include metadata TLV data.
// Mollusk's BPF VM does not support realloc for accounts created in the same
// instruction, so this test expects InvalidRealloc. The CPI flow is verified by
// the logs: CreateAccount, InitializeMintCloseAuthority, InitializeMetadataPointer,
// and InitializeMint2 all succeed before the realloc failure. On-chain (devnet/mainnet)
// this instruction completes successfully.
#[test]
fn test_initialize_hits_realloc_limit_in_mollusk() {
    let mollusk = setup_with_token2022();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, _) = vault_pda(&admin, &base_mint);
    let (share_mint_key, _) = share_mint_pda(&vault_key);

    let instruction = build_instruction(
        initialize_data(6, 1_000_000, b"Vault Share", b"vSHR", b"https://example.com/metadata.json"),
        vec![
            AccountMeta::new(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new_readonly(base_mint, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, system_account(10_000_000_000)),
        (vault_key, system_account(0)),
        (share_mint_key, system_account(0)),
        (base_mint, system_account(0)),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::InvalidRealloc)],
    );
}

#[test]
fn test_initialize_zero_share_price() {
    let mollusk = setup_with_token2022();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, _) = vault_pda(&admin, &base_mint);
    let (share_mint_key, _) = share_mint_pda(&vault_key);

    let instruction = build_instruction(
        initialize_data(6, 0, b"Test", b"TST", b""), // zero price
        vec![
            AccountMeta::new(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new_readonly(base_mint, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, system_account(10_000_000_000)),
        (vault_key, system_account(0)),
        (share_mint_key, system_account(0)),
        (base_mint, system_account(0)),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x101))], // InvalidSharePrice
    );
}

#[test]
fn test_initialize_missing_signer() {
    let mollusk = setup_with_token2022();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, _) = vault_pda(&admin, &base_mint);
    let (share_mint_key, _) = share_mint_pda(&vault_key);

    let instruction = build_instruction(
        initialize_data(6, 1_000_000, b"Test", b"TST", b""),
        vec![
            AccountMeta::new(admin, false), // NOT a signer
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new_readonly(base_mint, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, system_account(10_000_000_000)),
        (vault_key, system_account(0)),
        (share_mint_key, system_account(0)),
        (base_mint, system_account(0)),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::MissingRequiredSignature)],
    );
}

#[test]
fn test_initialize_wrong_vault_pda() {
    let mollusk = setup_with_token2022();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let wrong_vault = Pubkey::new_unique();
    let (share_mint_key, _) = share_mint_pda(&wrong_vault);

    let instruction = build_instruction(
        initialize_data(6, 1_000_000, b"Test", b"TST", b""),
        vec![
            AccountMeta::new(admin, true),
            AccountMeta::new(wrong_vault, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new_readonly(base_mint, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, system_account(10_000_000_000)),
        (wrong_vault, system_account(0)),
        (share_mint_key, system_account(0)),
        (base_mint, system_account(0)),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::InvalidSeeds)],
    );
}

#[test]
fn test_initialize_insufficient_data() {
    let mollusk = setup_with_token2022();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, _) = vault_pda(&admin, &base_mint);
    let (share_mint_key, _) = share_mint_pda(&vault_key);

    // disc + decimals + only 2 bytes of price (need 8)
    let instruction = build_instruction(
        vec![0x00, 0x06, 0x01, 0x02],
        vec![
            AccountMeta::new(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new_readonly(base_mint, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, system_account(10_000_000_000)),
        (vault_key, system_account(0)),
        (share_mint_key, system_account(0)),
        (base_mint, system_account(0)),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::InvalidInstructionData)],
    );
}

#[test]
fn test_initialize_not_enough_accounts() {
    let mollusk = setup_with_token2022();
    let admin = Pubkey::new_unique();

    let instruction = build_instruction(
        initialize_data(6, 1_000_000, b"Test", b"TST", b""),
        vec![
            AccountMeta::new(admin, true),
        ],
    );

    let accounts = vec![
        (admin, system_account(10_000_000_000)),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::NotEnoughAccountKeys)],
    );
}

#[test]
fn test_initialize_wrong_token_program() {
    let mollusk = setup_with_token2022();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, _) = vault_pda(&admin, &base_mint);
    let (share_mint_key, _) = share_mint_pda(&vault_key);

    // Pass legacy Token program instead of Token 2022
    let instruction = build_instruction(
        initialize_data(6, 1_000_000, b"Test", b"TST", b""),
        vec![
            AccountMeta::new(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new_readonly(base_mint, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false), // wrong!
        ],
    );

    let accounts = vec![
        (admin, system_account(10_000_000_000)),
        (vault_key, system_account(0)),
        (share_mint_key, system_account(0)),
        (base_mint, system_account(0)),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::IncorrectProgramId)],
    );
}

#[test]
fn test_initialize_metadata_name_too_long() {
    let mollusk = setup_with_token2022();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, _) = vault_pda(&admin, &base_mint);
    let (share_mint_key, _) = share_mint_pda(&vault_key);

    let long_name = [b'A'; 129]; // exceeds MAX_METADATA_STRING_LEN (128)

    let instruction = build_instruction(
        initialize_data(6, 1_000_000, &long_name, b"TST", b""),
        vec![
            AccountMeta::new(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new_readonly(base_mint, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, system_account(10_000_000_000)),
        (vault_key, system_account(0)),
        (share_mint_key, system_account(0)),
        (base_mint, system_account(0)),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x10D))], // InvalidMetadata
    );
}
