mod helpers;

use helpers::*;
use mollusk_svm::result::Check;
use solana_account::Account;
use solana_instruction::AccountMeta;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;

#[test]
fn test_add_owner_success() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let new_owner = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let instruction = build_instruction(
        add_owner_data(&new_owner),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );
}

#[test]
fn test_add_owner_unauthorized() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let stranger = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let new_owner = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let instruction = build_instruction(
        add_owner_data(&new_owner),
        vec![
            AccountMeta::new_readonly(stranger, true),
            AccountMeta::new(vault_key, false),
        ],
    );

    let accounts = vec![
        (stranger, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x100))], // Unauthorized
    );
}

#[test]
fn test_add_owner_duplicate() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let existing_owner = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000,
        &[existing_owner], b"test-vault",
    );

    let instruction = build_instruction(
        add_owner_data(&existing_owner), // duplicate
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x108))], // DuplicateOwner
    );
}

#[test]
fn test_add_owner_full() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");

    // Fill all 10 owner slots
    let owners: Vec<Pubkey> = (0..10).map(|_| Pubkey::new_unique()).collect();
    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &owners, b"test-vault",
    );

    let new_owner = Pubkey::new_unique();
    let instruction = build_instruction(
        add_owner_data(&new_owner),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x103))], // OwnersFull
    );
}

#[test]
fn test_add_owner_insufficient_data() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[], b"test-vault",
    );

    // Only 16 bytes of owner key (need 32)
    let mut data = vec![0x05];
    data.extend_from_slice(&[1u8; 16]);

    let instruction = build_instruction(
        data,
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::InvalidInstructionData)],
    );
}
