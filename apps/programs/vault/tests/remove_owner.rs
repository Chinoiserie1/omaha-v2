mod helpers;

use helpers::*;
use mollusk_svm::result::Check;
use solana_account::Account;
use solana_instruction::AccountMeta;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;

#[test]
fn test_remove_owner_success() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let owner = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[owner],
    );

    let instruction = build_instruction(
        remove_owner_data(&owner),
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
fn test_remove_owner_unauthorized() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let stranger = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let owner = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[owner],
    );

    let instruction = build_instruction(
        remove_owner_data(&owner),
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
fn test_remove_owner_not_found() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let owner = Pubkey::new_unique();
    let unknown = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[owner],
    );

    let instruction = build_instruction(
        remove_owner_data(&unknown), // not in list
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
        &[Check::err(ProgramError::Custom(0x104))], // OwnerNotFound
    );
}

#[test]
fn test_remove_owner_swap_removes_correctly() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let owner_a = Pubkey::new_unique();
    let owner_b = Pubkey::new_unique();
    let owner_c = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000,
        &[owner_a, owner_b, owner_c],
    );

    // Remove middle owner (owner_b)
    let instruction = build_instruction(
        remove_owner_data(&owner_b),
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
