mod helpers;

use helpers::*;
use mollusk_svm::result::Check;
use solana_account::Account;
use solana_instruction::AccountMeta;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;

#[test]
fn test_set_share_price_success() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let new_price: u64 = 2_000_000;
    let instruction = build_instruction(
        set_share_price_data(new_price),
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
fn test_set_share_price_unauthorized() {
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
        set_share_price_data(2_000_000),
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
fn test_set_share_price_zero() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let instruction = build_instruction(
        set_share_price_data(0), // zero price
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
        &[Check::err(ProgramError::Custom(0x101))], // InvalidSharePrice
    );
}

#[test]
fn test_set_share_price_wrong_owner() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[], b"test-vault",
    );

    // vault_state owned by wrong program
    let mut vault_account = make_vault_account(vault_data);
    vault_account.owner = Pubkey::new_unique();

    let instruction = build_instruction(
        set_share_price_data(2_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, vault_account),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::IllegalOwner)],
    );
}

#[test]
fn test_set_share_price_bad_discriminator() {
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
        &[Check::err(ProgramError::Custom(0x105))], // InvalidDiscriminator
    );
}

#[test]
fn test_set_share_price_not_enough_accounts() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();

    let instruction = build_instruction(
        set_share_price_data(2_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            // missing vault_state
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
