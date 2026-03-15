mod helpers;

use helpers::*;
use mollusk_svm::result::Check;
use solana_account::Account;
use solana_instruction::AccountMeta;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;

#[test]
fn test_execute_admin_authorized() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let instruction = build_instruction(
        execute_data(&[]),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (SYSTEM_PROGRAM_ID, Account { executable: true, ..Account::default() }),
    ];

    // The CPI to system program with empty data may fail, but the vault program
    // should pass authorization. We verify it doesn't return Unauthorized (0x100).
    let result = mollusk.process_instruction(&instruction, &accounts);
    match &result.program_result {
        mollusk_svm::result::ProgramResult::Failure(err) => {
            assert_ne!(*err, ProgramError::Custom(0x100), "should not be Unauthorized");
        }
        _ => {} // success or unknown error are both fine (auth passed)
    }
}

#[test]
fn test_execute_owner_authorized() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let owner = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[owner], b"test-vault",
    );

    let instruction = build_instruction(
        execute_data(&[]),
        vec![
            AccountMeta::new_readonly(owner, true),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (owner, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (SYSTEM_PROGRAM_ID, Account { executable: true, ..Account::default() }),
    ];

    let result = mollusk.process_instruction(&instruction, &accounts);
    match &result.program_result {
        mollusk_svm::result::ProgramResult::Failure(err) => {
            assert_ne!(*err, ProgramError::Custom(0x100), "should not be Unauthorized");
        }
        _ => {}
    }
}

#[test]
fn test_execute_unauthorized() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let stranger = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let instruction = build_instruction(
        execute_data(&[]),
        vec![
            AccountMeta::new_readonly(stranger, true),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (stranger, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (SYSTEM_PROGRAM_ID, Account { executable: true, ..Account::default() }),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x100))], // Unauthorized
    );
}

#[test]
fn test_execute_not_signer() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let instruction = build_instruction(
        execute_data(&[]),
        vec![
            AccountMeta::new_readonly(admin, false), // NOT signer
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (SYSTEM_PROGRAM_ID, Account { executable: true, ..Account::default() }),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::MissingRequiredSignature)],
    );
}

#[test]
fn test_execute_not_enough_accounts() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();

    let instruction = build_instruction(
        execute_data(&[]),
        vec![
            AccountMeta::new_readonly(admin, true),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::NotEnoughAccountKeys)],
    );
}

#[test]
fn test_execute_bad_discriminator() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");

    let mut vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[], b"test-vault",
    );
    vault_data[0] = 0xFF; // bad discriminator

    let instruction = build_instruction(
        execute_data(&[]),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (SYSTEM_PROGRAM_ID, Account { executable: true, ..Account::default() }),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x105))], // InvalidDiscriminator
    );
}
