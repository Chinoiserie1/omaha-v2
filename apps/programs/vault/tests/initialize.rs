mod helpers;

use helpers::*;
use mollusk_svm::program::keyed_account_for_system_program;
use mollusk_svm::result::Check;
use solana_account::Account;
use solana_instruction::AccountMeta;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;

use omaha_vault::rent::minimum_balance;
use omaha_vault::state::VaultState;

fn system_account(lamports: u64) -> Account {
    Account::new(lamports, 0, &SYSTEM_PROGRAM_ID)
}

#[test]
fn test_initialize_success() {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, _) = vault_pda(&admin, &base_mint);
    let (share_mint_key, _) = share_mint_pda(&vault_key);

    let share_decimals: u8 = 6;
    let share_price: u64 = 1_000_000;

    let instruction = build_instruction(
        initialize_data(share_decimals, share_price),
        vec![
            AccountMeta::new(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new_readonly(base_mint, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let admin_lamports = 10_000_000_000;
    let accounts = vec![
        (admin, system_account(admin_lamports)),
        (vault_key, system_account(0)),
        (share_mint_key, system_account(0)),
        (base_mint, system_account(0)),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    let result = mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );

    // Verify vault state was written correctly
    let vault_account = result
        .resulting_accounts
        .iter()
        .find(|(k, _)| *k == vault_key)
        .map(|(_, a)| a)
        .expect("vault account not found");

    assert_eq!(vault_account.owner, program_id());
    assert_eq!(vault_account.data.len(), VaultState::LEN);
    assert_eq!(vault_account.data[0], 0xA1); // discriminator
    assert_eq!(vault_account.data[2], share_decimals);
    assert_eq!(vault_account.data[3], 0); // num_owners
    assert_eq!(&vault_account.data[16..48], admin.as_ref());
    assert_eq!(&vault_account.data[48..80], share_mint_key.as_ref());
    assert_eq!(&vault_account.data[80..112], base_mint.as_ref());
    assert_eq!(
        u64::from_le_bytes(vault_account.data[144..152].try_into().unwrap()),
        share_price
    );

    // Verify share mint was created and owned by token program
    let mint_account = result
        .resulting_accounts
        .iter()
        .find(|(k, _)| *k == share_mint_key)
        .map(|(_, a)| a)
        .expect("share mint not found");
    assert_eq!(mint_account.owner, TOKEN_PROGRAM_ID);

    // Verify admin paid for both accounts
    let admin_after = result
        .resulting_accounts
        .iter()
        .find(|(k, _)| *k == admin)
        .map(|(_, a)| a)
        .expect("admin account not found");
    let expected_cost = minimum_balance(VaultState::LEN) + minimum_balance(82);
    assert_eq!(admin_after.lamports, admin_lamports - expected_cost);
}

#[test]
fn test_initialize_zero_share_price() {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, _) = vault_pda(&admin, &base_mint);
    let (share_mint_key, _) = share_mint_pda(&vault_key);

    let instruction = build_instruction(
        initialize_data(6, 0), // zero price
        vec![
            AccountMeta::new(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new_readonly(base_mint, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
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
        &[Check::err(ProgramError::Custom(0x101))], // InvalidSharePrice
    );
}

#[test]
fn test_initialize_missing_signer() {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, _) = vault_pda(&admin, &base_mint);
    let (share_mint_key, _) = share_mint_pda(&vault_key);

    let instruction = build_instruction(
        initialize_data(6, 1_000_000),
        vec![
            AccountMeta::new(admin, false), // NOT a signer
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new_readonly(base_mint, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
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
        &[Check::err(ProgramError::MissingRequiredSignature)],
    );
}

#[test]
fn test_initialize_wrong_vault_pda() {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let wrong_vault = Pubkey::new_unique();
    let (share_mint_key, _) = share_mint_pda(&wrong_vault);

    let instruction = build_instruction(
        initialize_data(6, 1_000_000),
        vec![
            AccountMeta::new(admin, true),
            AccountMeta::new(wrong_vault, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new_readonly(base_mint, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, system_account(10_000_000_000)),
        (wrong_vault, system_account(0)),
        (share_mint_key, system_account(0)),
        (base_mint, system_account(0)),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::InvalidSeeds)],
    );
}

#[test]
fn test_initialize_insufficient_data() {
    let mollusk = setup_with_token();
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
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
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
        &[Check::err(ProgramError::InvalidInstructionData)],
    );
}

#[test]
fn test_initialize_not_enough_accounts() {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();

    let instruction = build_instruction(
        initialize_data(6, 1_000_000),
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
