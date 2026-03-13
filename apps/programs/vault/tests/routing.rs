mod helpers;

use helpers::*;
use mollusk_svm::result::Check;
use solana_account::Account;
use solana_instruction::AccountMeta;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;

#[test]
fn test_empty_instruction_data() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();

    let instruction = build_instruction(
        vec![], // empty data
        vec![AccountMeta::new_readonly(admin, true)],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::InvalidInstructionData)],
    );
}

#[test]
fn test_unknown_discriminator() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();

    let instruction = build_instruction(
        vec![0xFF], // unknown discriminator
        vec![AccountMeta::new_readonly(admin, true)],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::InvalidInstructionData)],
    );
}

#[test]
fn test_discriminator_0x03_routes_to_set_share_price() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[],
    );

    let instruction = build_instruction(
        set_share_price_data(2_000_000),
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
fn test_discriminator_0x01_routes_to_add_owner() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let new_owner = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[],
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
fn test_discriminator_0x02_routes_to_remove_owner() {
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
