mod helpers;

use helpers::*;
use mollusk_svm::result::Check;
use solana_account::Account;
use solana_instruction::AccountMeta;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;


/// Create a packed SPL Token account.
fn create_token_account(mint: &Pubkey, owner: &Pubkey, amount: u64) -> Account {
    use solana_program_pack::Pack;
    use spl_token_interface::state::Account as TokenAccount;
    use spl_token_interface::state::AccountState;

    let token = TokenAccount {
        mint: *mint,
        owner: *owner,
        amount,
        delegate: solana_program_option::COption::None,
        state: AccountState::Initialized,
        is_native: solana_program_option::COption::None,
        delegated_amount: 0,
        close_authority: solana_program_option::COption::None,
    };
    let mut data = vec![0u8; TokenAccount::LEN];
    TokenAccount::pack(token, &mut data).unwrap();

    Account {
        lamports: 1_000_000_000,
        data,
        owner: TOKEN_PROGRAM_ID,
        executable: false,
        rent_epoch: 0,
    }
}

#[test]
fn test_fulfill_withdraw_success() {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let withdrawer = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");
    let share_mint_key = Pubkey::new_unique();

    let share_decimals: u8 = 6;
    let old_price: u64 = 1_000_000;
    let new_price: u64 = 2_000_000;
    let pending_shares: u64 = 3_000_000; // 3 shares burned during RequestWithdraw
    // base_to_return = 3_000_000 * 2_000_000 / 10^6 = 6_000_000

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, old_price, &[], b"test-vault",
    );

    let (pending_key, pending_bump) = pending_withdraw_pda(&vault_key, &withdrawer);
    let pending_data = create_pending_withdraw_data(
        &vault_key, &withdrawer, pending_bump, pending_shares,
    );

    let vault_base_ata = Pubkey::new_unique();
    let withdrawer_base_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        fulfill_withdraw_data(new_price),
        vec![
            AccountMeta::new_readonly(admin, true),              // admin (signer)
            AccountMeta::new(vault_key, false),                   // vault_state (writable)
            AccountMeta::new(pending_key, false),                 // pending_withdraw (writable)
            AccountMeta::new(vault_base_ata, false),              // vault's base tokens
            AccountMeta::new(withdrawer_base_ata, false),         // receives base tokens
            AccountMeta::new(withdrawer, false),                  // withdrawer (writable, NOT signer)
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),   // token_program
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (pending_key, make_pending_withdraw_account(pending_data)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 10_000_000)),
        (withdrawer_base_ata, create_token_account(&base_mint, &withdrawer, 0)),
        (withdrawer, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    let result = mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );

    // Verify base tokens transferred
    let withdrawer_base = result.resulting_accounts.iter()
        .find(|(k, _)| *k == withdrawer_base_ata).unwrap().1.clone();
    let base_received = u64::from_le_bytes(withdrawer_base.data[64..72].try_into().unwrap());
    assert_eq!(base_received, 6_000_000);

    // Verify vault balance decreased
    let vault_base = result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_base_ata).unwrap().1.clone();
    let vault_remaining = u64::from_le_bytes(vault_base.data[64..72].try_into().unwrap());
    assert_eq!(vault_remaining, 10_000_000 - 6_000_000);

    // Verify vault state price was updated
    let vault_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_key).unwrap().1.clone();
    let updated_price = u64::from_le_bytes(vault_account.data[144..152].try_into().unwrap());
    assert_eq!(updated_price, new_price);

    // Verify pending withdraw was closed (lamports = 0)
    let pending_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == pending_key).unwrap().1.clone();
    assert_eq!(pending_account.lamports, 0);
}

#[test]
fn test_fulfill_withdraw_unauthorized() {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let not_admin = Pubkey::new_unique();
    let withdrawer = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let (pending_key, pending_bump) = pending_withdraw_pda(&vault_key, &withdrawer);
    let pending_data = create_pending_withdraw_data(
        &vault_key, &withdrawer, pending_bump, 3_000_000,
    );

    let vault_base_ata = Pubkey::new_unique();
    let withdrawer_base_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        fulfill_withdraw_data(2_000_000),
        vec![
            AccountMeta::new_readonly(not_admin, true),           // NOT admin
            AccountMeta::new(vault_key, false),
            AccountMeta::new(pending_key, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(withdrawer_base_ata, false),
            AccountMeta::new(withdrawer, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (not_admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (pending_key, make_pending_withdraw_account(pending_data)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 10_000_000)),
        (withdrawer_base_ata, create_token_account(&base_mint, &withdrawer, 0)),
        (withdrawer, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x100))], // Unauthorized
    );
}

#[test]
fn test_fulfill_withdraw_wrong_withdrawer() {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let withdrawer = Pubkey::new_unique();
    let wrong_withdrawer = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let (pending_key, pending_bump) = pending_withdraw_pda(&vault_key, &withdrawer);
    let pending_data = create_pending_withdraw_data(
        &vault_key, &withdrawer, pending_bump, 3_000_000,
    );

    let vault_base_ata = Pubkey::new_unique();
    let withdrawer_base_ata = Pubkey::new_unique();

    // Pass wrong_withdrawer instead of withdrawer
    let instruction = build_instruction(
        fulfill_withdraw_data(2_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(pending_key, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(withdrawer_base_ata, false),
            AccountMeta::new(wrong_withdrawer, false),            // wrong withdrawer
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (pending_key, make_pending_withdraw_account(pending_data)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 10_000_000)),
        (withdrawer_base_ata, create_token_account(&base_mint, &wrong_withdrawer, 0)),
        (wrong_withdrawer, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::InvalidAccountData)],
    );
}

#[test]
fn test_fulfill_withdraw_wrong_vault() {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let withdrawer = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let other_base_mint = Pubkey::new_unique();
    let (vault_key, _bump) = vault_pda(b"test-vault");
    let (other_vault_key, other_bump) = vault_pda(b"other-vault");
    let share_mint_key = Pubkey::new_unique();

    // Pending withdraw belongs to vault_key
    let (pending_key, pending_bump) = pending_withdraw_pda(&vault_key, &withdrawer);
    let pending_data = create_pending_withdraw_data(
        &vault_key, &withdrawer, pending_bump, 3_000_000,
    );

    // But we pass other_vault_key
    let other_vault_data = create_vault_state_data(
        &admin, &other_base_mint, &share_mint_key, other_bump, 6, 1_000_000, &[], b"other-vault",
    );

    let vault_base_ata = Pubkey::new_unique();
    let withdrawer_base_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        fulfill_withdraw_data(2_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(other_vault_key, false),             // wrong vault
            AccountMeta::new(pending_key, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(withdrawer_base_ata, false),
            AccountMeta::new(withdrawer, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (other_vault_key, make_vault_account(other_vault_data)),
        (pending_key, make_pending_withdraw_account(pending_data)),
        (vault_base_ata, create_token_account(&other_base_mint, &other_vault_key, 10_000_000)),
        (withdrawer_base_ata, create_token_account(&other_base_mint, &withdrawer, 0)),
        (withdrawer, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::InvalidAccountData)],
    );
}

#[test]
fn test_fulfill_withdraw_zero_price() {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let withdrawer = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let (pending_key, pending_bump) = pending_withdraw_pda(&vault_key, &withdrawer);
    let pending_data = create_pending_withdraw_data(
        &vault_key, &withdrawer, pending_bump, 3_000_000,
    );

    let vault_base_ata = Pubkey::new_unique();
    let withdrawer_base_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        fulfill_withdraw_data(0), // zero price
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(pending_key, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(withdrawer_base_ata, false),
            AccountMeta::new(withdrawer, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (pending_key, make_pending_withdraw_account(pending_data)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 10_000_000)),
        (withdrawer_base_ata, create_token_account(&base_mint, &withdrawer, 0)),
        (withdrawer, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x101))], // InvalidSharePrice
    );
}

#[test]
fn test_fulfill_withdraw_missing_admin_signer() {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let withdrawer = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let (pending_key, pending_bump) = pending_withdraw_pda(&vault_key, &withdrawer);
    let pending_data = create_pending_withdraw_data(
        &vault_key, &withdrawer, pending_bump, 3_000_000,
    );

    let vault_base_ata = Pubkey::new_unique();
    let withdrawer_base_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        fulfill_withdraw_data(2_000_000),
        vec![
            AccountMeta::new_readonly(admin, false),              // NOT signer
            AccountMeta::new(vault_key, false),
            AccountMeta::new(pending_key, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(withdrawer_base_ata, false),
            AccountMeta::new(withdrawer, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (pending_key, make_pending_withdraw_account(pending_data)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 10_000_000)),
        (withdrawer_base_ata, create_token_account(&base_mint, &withdrawer, 0)),
        (withdrawer, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::MissingRequiredSignature)],
    );
}
