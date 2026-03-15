mod helpers;

use helpers::*;
use mollusk_svm::program::keyed_account_for_system_program;
use mollusk_svm::result::Check;
use solana_account::Account;
use solana_instruction::AccountMeta;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;

use omaha_vault::state::PendingWithdraw;

#[test]
fn test_request_withdraw_success() {
    let mollusk = setup_with_token2022();

    let admin = Pubkey::new_unique();
    let withdrawer = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");
    let share_mint_key = Pubkey::new_unique();
    let shares_to_burn: u64 = 3_000_000;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let (pending_key, _pending_bump) = pending_withdraw_pda(&vault_key, &withdrawer);
    let withdrawer_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        request_withdraw_data(shares_to_burn),
        vec![
            AccountMeta::new(withdrawer, true),                    // withdrawer (signer, writable)
            AccountMeta::new(withdrawer_share_ata, false),         // shares to burn
            AccountMeta::new(share_mint_key, false),               // share_mint
            AccountMeta::new_readonly(vault_key, false),           // vault_state
            AccountMeta::new(pending_key, false),                  // pending_withdraw PDA
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),   // system_program
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false), // token_program
        ],
    );

    let accounts = vec![
        (withdrawer, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (withdrawer_share_ata, create_token2022_token_account(&share_mint_key, &withdrawer, shares_to_burn)),
        (share_mint_key, create_token2022_mint(&vault_key, 6, shares_to_burn, b"Share", b"SHR", b"")),
        (vault_key, make_vault_account(vault_data)),
        (pending_key, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];

    let result = mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );

    // Verify pending withdraw PDA was created
    let pending_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == pending_key).unwrap().1.clone();
    assert_eq!(pending_account.data.len(), PendingWithdraw::LEN);
    assert_eq!(pending_account.data[0], 0xA3); // PENDING_WITHDRAW_DISCRIMINATOR
    assert_eq!(pending_account.owner, program_id());

    // Verify stored withdrawer
    let stored_withdrawer = &pending_account.data[40..72];
    assert_eq!(stored_withdrawer, withdrawer.as_ref());

    // Verify stored shares
    let stored_shares = u64::from_le_bytes(pending_account.data[72..80].try_into().unwrap());
    assert_eq!(stored_shares, shares_to_burn);

    // Verify shares were burned
    let withdrawer_shares = result.resulting_accounts.iter()
        .find(|(k, _)| *k == withdrawer_share_ata).unwrap().1.clone();
    let shares_remaining = u64::from_le_bytes(withdrawer_shares.data[64..72].try_into().unwrap());
    assert_eq!(shares_remaining, 0);
}

#[test]
fn test_request_withdraw_zero_shares() {
    let mollusk = setup_with_token2022();

    let admin = Pubkey::new_unique();
    let withdrawer = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let (pending_key, _) = pending_withdraw_pda(&vault_key, &withdrawer);
    let withdrawer_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        request_withdraw_data(0), // zero shares
        vec![
            AccountMeta::new(withdrawer, true),
            AccountMeta::new(withdrawer_share_ata, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pending_key, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (withdrawer, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (withdrawer_share_ata, create_token2022_token_account(&share_mint_key, &withdrawer, 1_000_000)),
        (share_mint_key, create_token2022_mint(&vault_key, 6, 1_000_000, b"Share", b"SHR", b"")),
        (vault_key, make_vault_account(vault_data)),
        (pending_key, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x102))], // InvalidAmount
    );
}

#[test]
fn test_request_withdraw_missing_signer() {
    let mollusk = setup_with_token2022();

    let admin = Pubkey::new_unique();
    let withdrawer = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let (pending_key, _) = pending_withdraw_pda(&vault_key, &withdrawer);
    let withdrawer_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        request_withdraw_data(1_000_000),
        vec![
            AccountMeta::new(withdrawer, false),                   // NOT signer
            AccountMeta::new(withdrawer_share_ata, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pending_key, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (withdrawer, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (withdrawer_share_ata, create_token2022_token_account(&share_mint_key, &withdrawer, 1_000_000)),
        (share_mint_key, create_token2022_mint(&vault_key, 6, 1_000_000, b"Share", b"SHR", b"")),
        (vault_key, make_vault_account(vault_data)),
        (pending_key, Account::new(0, 0, &Pubkey::default())),
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
fn test_request_withdraw_wrong_pending_pda() {
    let mollusk = setup_with_token2022();

    let admin = Pubkey::new_unique();
    let withdrawer = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let wrong_pending_key = Pubkey::new_unique(); // wrong PDA
    let withdrawer_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        request_withdraw_data(1_000_000),
        vec![
            AccountMeta::new(withdrawer, true),
            AccountMeta::new(withdrawer_share_ata, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(wrong_pending_key, false),            // wrong PDA
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (withdrawer, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (withdrawer_share_ata, create_token2022_token_account(&share_mint_key, &withdrawer, 1_000_000)),
        (share_mint_key, create_token2022_mint(&vault_key, 6, 1_000_000, b"Share", b"SHR", b"")),
        (vault_key, make_vault_account(vault_data)),
        (wrong_pending_key, Account::new(0, 0, &Pubkey::default())),
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
fn test_request_withdraw_wrong_share_mint() {
    let mollusk = setup_with_token2022();

    let admin = Pubkey::new_unique();
    let withdrawer = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");
    let share_mint_key = Pubkey::new_unique();
    let wrong_mint = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let (pending_key, _) = pending_withdraw_pda(&vault_key, &withdrawer);
    let withdrawer_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        request_withdraw_data(1_000_000),
        vec![
            AccountMeta::new(withdrawer, true),
            AccountMeta::new(withdrawer_share_ata, false),
            AccountMeta::new(wrong_mint, false),                   // wrong mint
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pending_key, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (withdrawer, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (withdrawer_share_ata, create_token2022_token_account(&wrong_mint, &withdrawer, 1_000_000)),
        (wrong_mint, create_token2022_mint(&vault_key, 6, 1_000_000, b"Share", b"SHR", b"")),
        (vault_key, make_vault_account(vault_data)),
        (pending_key, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::InvalidAccountData)],
    );
}
