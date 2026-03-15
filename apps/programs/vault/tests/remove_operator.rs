mod helpers;

use helpers::*;
use mollusk_svm::result::Check;
use solana_account::Account;
use solana_instruction::AccountMeta;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;

#[test]
fn test_remove_operator_success() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let operator = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[operator], b"test-vault",
    );

    let instruction = build_instruction(
        remove_operator_data(&operator),
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
fn test_remove_operator_unauthorized() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let stranger = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let operator = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[operator], b"test-vault",
    );

    let instruction = build_instruction(
        remove_operator_data(&operator),
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
fn test_remove_operator_not_found() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let operator = Pubkey::new_unique();
    let unknown = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[operator], b"test-vault",
    );

    let instruction = build_instruction(
        remove_operator_data(&unknown), // not in list
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
        &[Check::err(ProgramError::Custom(0x104))], // OperatorNotFound
    );
}

#[test]
fn test_remove_operator_swap_removes_correctly() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let operator_a = Pubkey::new_unique();
    let operator_b = Pubkey::new_unique();
    let operator_c = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000,
        &[operator_a, operator_b, operator_c], b"test-vault",
    );

    // Remove middle operator (operator_b)
    let instruction = build_instruction(
        remove_operator_data(&operator_b),
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
