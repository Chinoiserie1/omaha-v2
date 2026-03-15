mod helpers;

use helpers::*;
use mollusk_svm::result::Check;
use solana_account::Account;
use solana_instruction::AccountMeta;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;

use omaha_vault::state::VaultState;

#[test]
fn test_fulfill_deposit_success() {
    let mollusk = setup_with_token2022();
    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");
    let share_mint_key = Pubkey::new_unique();

    let share_decimals: u8 = 6;
    let old_price: u64 = 1_000_000;
    let new_price: u64 = 2_000_000;
    let deposit_amount: u64 = 10_000_000;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, old_price, &[], b"test-vault",
    );

    let (pending_key, pending_bump) = pending_deposit_pda(&vault_key, &depositor);
    let pending_data = create_pending_deposit_data(
        &vault_key, &depositor, pending_bump, deposit_amount,
    );

    let depositor_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        fulfill_deposit_data(new_price),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(pending_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(depositor_share_ata, false),
            AccountMeta::new(depositor, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (pending_key, make_pending_deposit_account(pending_data)),
        (share_mint_key, create_token2022_mint(&vault_key, share_decimals, 0, b"Test", b"TST", b"")),
        (depositor_share_ata, create_token2022_token_account(&share_mint_key, &depositor, 0)),
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];

    let expected_shares: u64 = 5_000_000;

    let result = mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );

    let depositor_shares = result.resulting_accounts.iter()
        .find(|(k, _)| *k == depositor_share_ata).unwrap().1.clone();
    let shares_amount = u64::from_le_bytes(depositor_shares.data[64..72].try_into().unwrap());
    assert_eq!(shares_amount, expected_shares);

    let vault_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_key).unwrap().1.clone();
    let updated_price = u64::from_le_bytes(vault_account.data[144..152].try_into().unwrap());
    assert_eq!(updated_price, new_price);

    let pending_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == pending_key).unwrap().1.clone();
    assert_eq!(pending_account.lamports, 0);
}

#[test]
fn test_fulfill_deposit_unauthorized() {
    let mollusk = setup_with_token2022();
    let admin = Pubkey::new_unique();
    let not_admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let (pending_key, pending_bump) = pending_deposit_pda(&vault_key, &depositor);
    let pending_data = create_pending_deposit_data(
        &vault_key, &depositor, pending_bump, 5_000_000,
    );

    let depositor_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        fulfill_deposit_data(2_000_000),
        vec![
            AccountMeta::new_readonly(not_admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(pending_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(depositor_share_ata, false),
            AccountMeta::new(depositor, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (not_admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (pending_key, make_pending_deposit_account(pending_data)),
        (share_mint_key, create_token2022_mint(&vault_key, 6, 0, b"Test", b"TST", b"")),
        (depositor_share_ata, create_token2022_token_account(&share_mint_key, &depositor, 0)),
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x100))],
    );
}

#[test]
fn test_fulfill_deposit_wrong_depositor() {
    let mollusk = setup_with_token2022();
    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let wrong_depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let (pending_key, pending_bump) = pending_deposit_pda(&vault_key, &depositor);
    let pending_data = create_pending_deposit_data(
        &vault_key, &depositor, pending_bump, 5_000_000,
    );

    let depositor_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        fulfill_deposit_data(2_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(pending_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(depositor_share_ata, false),
            AccountMeta::new(wrong_depositor, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (pending_key, make_pending_deposit_account(pending_data)),
        (share_mint_key, create_token2022_mint(&vault_key, 6, 0, b"Test", b"TST", b"")),
        (depositor_share_ata, create_token2022_token_account(&share_mint_key, &wrong_depositor, 0)),
        (wrong_depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::InvalidAccountData)],
    );
}

#[test]
fn test_fulfill_deposit_wrong_vault() {
    let mollusk = setup_with_token2022();
    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let other_base_mint = Pubkey::new_unique();
    let (vault_key, _bump) = vault_pda(b"test-vault");
    let (other_vault_key, other_bump) = vault_pda(b"other-vault");
    let share_mint_key = Pubkey::new_unique();

    let (pending_key, pending_bump) = pending_deposit_pda(&vault_key, &depositor);
    let pending_data = create_pending_deposit_data(
        &vault_key, &depositor, pending_bump, 5_000_000,
    );

    let other_vault_data = create_vault_state_data(
        &admin, &other_base_mint, &share_mint_key, other_bump, 6, 1_000_000, &[], b"other-vault",
    );

    let depositor_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        fulfill_deposit_data(2_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(other_vault_key, false),
            AccountMeta::new(pending_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(depositor_share_ata, false),
            AccountMeta::new(depositor, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (other_vault_key, make_vault_account(other_vault_data)),
        (pending_key, make_pending_deposit_account(pending_data)),
        (share_mint_key, create_token2022_mint(&other_vault_key, 6, 0, b"Test", b"TST", b"")),
        (depositor_share_ata, create_token2022_token_account(&share_mint_key, &depositor, 0)),
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::InvalidAccountData)],
    );
}

#[test]
fn test_fulfill_deposit_zero_price() {
    let mollusk = setup_with_token2022();
    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let (pending_key, pending_bump) = pending_deposit_pda(&vault_key, &depositor);
    let pending_data = create_pending_deposit_data(
        &vault_key, &depositor, pending_bump, 5_000_000,
    );

    let depositor_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        fulfill_deposit_data(0),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(pending_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(depositor_share_ata, false),
            AccountMeta::new(depositor, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (pending_key, make_pending_deposit_account(pending_data)),
        (share_mint_key, create_token2022_mint(&vault_key, 6, 0, b"Test", b"TST", b"")),
        (depositor_share_ata, create_token2022_token_account(&share_mint_key, &depositor, 0)),
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x101))],
    );
}

#[test]
fn test_fulfill_deposit_missing_admin_signer() {
    let mollusk = setup_with_token2022();
    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let (pending_key, pending_bump) = pending_deposit_pda(&vault_key, &depositor);
    let pending_data = create_pending_deposit_data(
        &vault_key, &depositor, pending_bump, 5_000_000,
    );

    let depositor_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        fulfill_deposit_data(2_000_000),
        vec![
            AccountMeta::new_readonly(admin, false),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(pending_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(depositor_share_ata, false),
            AccountMeta::new(depositor, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (pending_key, make_pending_deposit_account(pending_data)),
        (share_mint_key, create_token2022_mint(&vault_key, 6, 0, b"Test", b"TST", b"")),
        (depositor_share_ata, create_token2022_token_account(&share_mint_key, &depositor, 0)),
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::MissingRequiredSignature)],
    );
}
