mod helpers;

use helpers::*;
use mollusk_svm::result::Check;
use solana_account::Account;
use solana_instruction::AccountMeta;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;

#[test]
fn test_update_fees_success() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();
    let fee_receiver = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[],
    );

    let instruction = build_instruction(
        update_fees_data(100, 50, 200, 2000, &fee_receiver),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
    ];

    let result = mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );

    // Verify fee fields were written
    let vault_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_key).unwrap().1.clone();

    let entry = u16::from_le_bytes(vault_account.data[4..6].try_into().unwrap());
    let exit = u16::from_le_bytes(vault_account.data[6..8].try_into().unwrap());
    let mgmt = u16::from_le_bytes(vault_account.data[8..10].try_into().unwrap());
    let perf = u16::from_le_bytes(vault_account.data[10..12].try_into().unwrap());
    let receiver = &vault_account.data[112..144];

    assert_eq!(entry, 100);
    assert_eq!(exit, 50);
    assert_eq!(mgmt, 200);
    assert_eq!(perf, 2000);
    assert_eq!(receiver, fee_receiver.as_ref());

    // HWM should be initialized to share_price
    let hwm = u64::from_le_bytes(vault_account.data[152..160].try_into().unwrap());
    assert_eq!(hwm, 1_000_000);
}

#[test]
fn test_update_fees_unauthorized() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let not_admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();
    let fee_receiver = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[],
    );

    let instruction = build_instruction(
        update_fees_data(100, 50, 200, 2000, &fee_receiver),
        vec![
            AccountMeta::new_readonly(not_admin, true),
            AccountMeta::new(vault_key, false),
        ],
    );

    let accounts = vec![
        (not_admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x100))],
    );
}

#[test]
fn test_update_fees_exceeds_entry_max() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();
    let fee_receiver = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[],
    );

    // entry_fee_bps = 1001 > max 1000
    let instruction = build_instruction(
        update_fees_data(1001, 0, 0, 0, &fee_receiver),
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
        &[Check::err(ProgramError::Custom(0x10B))], // FeeExceedsMaximum
    );
}

#[test]
fn test_update_fees_exceeds_perf_max() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();
    let fee_receiver = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[],
    );

    // performance_fee_bps = 5001 > max 5000
    let instruction = build_instruction(
        update_fees_data(0, 0, 0, 5001, &fee_receiver),
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
        &[Check::err(ProgramError::Custom(0x10B))],
    );
}

#[test]
fn test_update_fees_missing_signer() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();
    let fee_receiver = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[],
    );

    let instruction = build_instruction(
        update_fees_data(100, 50, 200, 2000, &fee_receiver),
        vec![
            AccountMeta::new_readonly(admin, false), // NOT signer
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
        &[Check::err(ProgramError::MissingRequiredSignature)],
    );
}

#[test]
fn test_update_fees_at_max_values() {
    let mollusk = setup();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();
    let fee_receiver = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[],
    );

    // All fees at their maximums
    let instruction = build_instruction(
        update_fees_data(1000, 1000, 1000, 5000, &fee_receiver),
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
