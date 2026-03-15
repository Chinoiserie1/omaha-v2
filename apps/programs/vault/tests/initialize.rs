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

/// Create a factory_state account with `admin` as an authorized admin.
///
/// Account 0 of Initialize is now `factory_state` (writable PDA owned by program).
/// The signer (account 1 = admin) must be listed in the factory's admins array.
fn make_authorized_factory(admin: &Pubkey) -> Account {
    let (factory_key, factory_bump) = factory_pda();
    let data = create_factory_state_data(admin, factory_bump, &[*admin]);
    make_factory_account(data)
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
    let (factory_key, _) = factory_pda();
    let (vault_key, _) = vault_pda(b"Vault Share");
    let (share_mint_key, _) = share_mint_pda(&vault_key);

    let instruction = build_instruction(
        initialize_data(6, 1_000_000, b"Vault Share", b"vSHR", b"https://example.com/metadata.json"),
        vec![
            AccountMeta::new(factory_key, false),
            AccountMeta::new(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new_readonly(base_mint, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (factory_key, make_authorized_factory(&admin)),
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
    let (factory_key, _) = factory_pda();
    let (vault_key, _) = vault_pda(b"Test");
    let (share_mint_key, _) = share_mint_pda(&vault_key);

    let instruction = build_instruction(
        initialize_data(6, 0, b"Test", b"TST", b""), // zero price
        vec![
            AccountMeta::new(factory_key, false),
            AccountMeta::new(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new_readonly(base_mint, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (factory_key, make_authorized_factory(&admin)),
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
fn test_initialize_missing_admin_signer() {
    let mollusk = setup_with_token2022();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (factory_key, _) = factory_pda();
    let (vault_key, _) = vault_pda(b"Test");
    let (share_mint_key, _) = share_mint_pda(&vault_key);

    let instruction = build_instruction(
        initialize_data(6, 1_000_000, b"Test", b"TST", b""),
        vec![
            AccountMeta::new(factory_key, false),
            AccountMeta::new(admin, false), // NOT a signer
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new_readonly(base_mint, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (factory_key, make_authorized_factory(&admin)),
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
    let (factory_key, _) = factory_pda();
    let wrong_vault = Pubkey::new_unique();
    let (share_mint_key, _) = share_mint_pda(&wrong_vault);

    let instruction = build_instruction(
        initialize_data(6, 1_000_000, b"Test", b"TST", b""),
        vec![
            AccountMeta::new(factory_key, false),
            AccountMeta::new(admin, true),
            AccountMeta::new(wrong_vault, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new_readonly(base_mint, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (factory_key, make_authorized_factory(&admin)),
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
    let (factory_key, _) = factory_pda();
    let (vault_key, _) = vault_pda(b"Test");
    let (share_mint_key, _) = share_mint_pda(&vault_key);

    // disc + decimals + only 2 bytes of price (need 8)
    let instruction = build_instruction(
        vec![0x00, 0x06, 0x01, 0x02],
        vec![
            AccountMeta::new(factory_key, false),
            AccountMeta::new(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new_readonly(base_mint, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (factory_key, make_authorized_factory(&admin)),
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
    let (factory_key, _) = factory_pda();

    let instruction = build_instruction(
        initialize_data(6, 1_000_000, b"Test", b"TST", b""),
        vec![
            AccountMeta::new(factory_key, false),
            AccountMeta::new(admin, true),
        ],
    );

    let accounts = vec![
        (factory_key, make_authorized_factory(&admin)),
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
    let (factory_key, _) = factory_pda();
    let (vault_key, _) = vault_pda(b"Test");
    let (share_mint_key, _) = share_mint_pda(&vault_key);

    // Pass legacy Token program instead of Token 2022
    let instruction = build_instruction(
        initialize_data(6, 1_000_000, b"Test", b"TST", b""),
        vec![
            AccountMeta::new(factory_key, false),
            AccountMeta::new(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new_readonly(base_mint, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false), // wrong!
        ],
    );

    let accounts = vec![
        (factory_key, make_authorized_factory(&admin)),
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
    let (factory_key, _) = factory_pda();
    let (vault_key, _) = vault_pda(b"Test");
    let (share_mint_key, _) = share_mint_pda(&vault_key);

    let long_name = [b'A'; 129]; // exceeds MAX_METADATA_STRING_LEN (128)

    let instruction = build_instruction(
        initialize_data(6, 1_000_000, &long_name, b"TST", b""),
        vec![
            AccountMeta::new(factory_key, false),
            AccountMeta::new(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new_readonly(base_mint, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (factory_key, make_authorized_factory(&admin)),
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

// ── Factory Authorization Negative Tests ─────────────────────────────────────

#[test]
fn test_initialize_unauthorized_admin() {
    let mollusk = setup_with_token2022();
    let authorized_admin = Pubkey::new_unique();
    let unauthorized_admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (factory_key, _) = factory_pda();
    let (vault_key, _) = vault_pda(b"Test");
    let (share_mint_key, _) = share_mint_pda(&vault_key);

    // Factory only authorizes authorized_admin, not unauthorized_admin
    let instruction = build_instruction(
        initialize_data(6, 1_000_000, b"Test", b"TST", b""),
        vec![
            AccountMeta::new(factory_key, false),
            AccountMeta::new(unauthorized_admin, true), // not in factory admins
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new_readonly(base_mint, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (factory_key, make_authorized_factory(&authorized_admin)),
        (unauthorized_admin, system_account(10_000_000_000)),
        (vault_key, system_account(0)),
        (share_mint_key, system_account(0)),
        (base_mint, system_account(0)),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x11C))], // UnauthorizedVaultCreator
    );
}

#[test]
fn test_initialize_missing_program_authority() {
    let mollusk = setup_with_token2022();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();

    // Only 6 accounts (missing factory_state at account 0)
    let (vault_key, _) = vault_pda(b"Test");
    let (share_mint_key, _) = share_mint_pda(&vault_key);

    let instruction = build_instruction(
        initialize_data(6, 1_000_000, b"Test", b"TST", b""),
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

    // With only 6 accounts, the 7-account destructuring fails
    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::NotEnoughAccountKeys)],
    );
}
