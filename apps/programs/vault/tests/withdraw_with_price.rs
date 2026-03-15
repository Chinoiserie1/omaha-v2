mod helpers;

use helpers::*;
use mollusk_svm::result::Check;
use solana_account::Account;
use solana_instruction::AccountMeta;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;


/// Create a packed SPL Token account (legacy, for base token operations).
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
fn test_withdraw_with_price_success() {
    let mollusk = setup_with_both_tokens();
    let admin = Pubkey::new_unique();
    let withdrawer = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");
    let share_mint_key = Pubkey::new_unique();

    let share_decimals: u8 = 6;
    let old_price: u64 = 1_000_000;
    let new_price: u64 = 2_000_000; // 2x price
    let shares_to_burn: u64 = 3_000_000; // 3 shares
    // base_to_return = 3_000_000 * 2_000_000 / 10^6 = 6_000_000

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, old_price, &[], b"test-vault",
    );

    let withdrawer_share_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let withdrawer_base_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        withdraw_with_price_data(new_price, shares_to_burn),
        vec![
            AccountMeta::new_readonly(admin, true),                      // 0: admin (signer)
            AccountMeta::new_readonly(withdrawer, true),                  // 1: withdrawer (signer)
            AccountMeta::new(withdrawer_share_ata, false),               // 2: shares to burn (Token 2022)
            AccountMeta::new(share_mint_key, false),                     // 3: share_mint (Token 2022)
            AccountMeta::new(vault_base_ata, false),                     // 4: vault's base tokens (legacy)
            AccountMeta::new(withdrawer_base_ata, false),                // 5: receives base tokens (legacy)
            AccountMeta::new(vault_key, false),                          // 6: vault_state (writable)
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),          // 7: legacy token program
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),     // 8: Token 2022 program
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (withdrawer, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (withdrawer_share_ata, create_token2022_token_account(&share_mint_key, &withdrawer, shares_to_burn)),
        (share_mint_key, create_token2022_mint(&vault_key, share_decimals, shares_to_burn, b"Test", b"TST", b"")),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 10_000_000)),
        (withdrawer_base_ata, create_token_account(&base_mint, &withdrawer, 0)),
        (vault_key, make_vault_account(vault_data)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];

    let result = mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );

    // Verify shares were burned
    let withdrawer_shares = result.resulting_accounts.iter()
        .find(|(k, _)| *k == withdrawer_share_ata).unwrap().1.clone();
    let shares_remaining = u64::from_le_bytes(withdrawer_shares.data[64..72].try_into().unwrap());
    assert_eq!(shares_remaining, 0);

    // Verify vault state price was updated
    let vault_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_key).unwrap().1.clone();
    let updated_price = u64::from_le_bytes(vault_account.data[144..152].try_into().unwrap());
    assert_eq!(updated_price, new_price);

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
}

#[test]
fn test_withdraw_with_price_unauthorized() {
    let mollusk = setup_with_both_tokens();
    let admin = Pubkey::new_unique();
    let not_admin = Pubkey::new_unique();
    let withdrawer = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let withdrawer_share_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let withdrawer_base_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        withdraw_with_price_data(2_000_000, 1_000_000),
        vec![
            AccountMeta::new_readonly(not_admin, true),                  // NOT admin
            AccountMeta::new_readonly(withdrawer, true),
            AccountMeta::new(withdrawer_share_ata, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(withdrawer_base_ata, false),
            AccountMeta::new(vault_key, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (not_admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (withdrawer, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (withdrawer_share_ata, create_token2022_token_account(&share_mint_key, &withdrawer, 1_000_000)),
        (share_mint_key, create_token2022_mint(&vault_key, 6, 1_000_000, b"Test", b"TST", b"")),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 10_000_000)),
        (withdrawer_base_ata, create_token_account(&base_mint, &withdrawer, 0)),
        (vault_key, make_vault_account(vault_data)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x100))], // Unauthorized
    );
}

#[test]
fn test_withdraw_with_price_missing_withdrawer_signer() {
    let mollusk = setup_with_both_tokens();
    let admin = Pubkey::new_unique();
    let withdrawer = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let withdrawer_share_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let withdrawer_base_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        withdraw_with_price_data(1_000_000, 1_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(withdrawer, false),                // NOT signer
            AccountMeta::new(withdrawer_share_ata, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(withdrawer_base_ata, false),
            AccountMeta::new(vault_key, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (withdrawer, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (withdrawer_share_ata, create_token2022_token_account(&share_mint_key, &withdrawer, 1_000_000)),
        (share_mint_key, create_token2022_mint(&vault_key, 6, 1_000_000, b"Test", b"TST", b"")),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 10_000_000)),
        (withdrawer_base_ata, create_token_account(&base_mint, &withdrawer, 0)),
        (vault_key, make_vault_account(vault_data)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::MissingRequiredSignature)],
    );
}

#[test]
fn test_withdraw_with_price_zero_price() {
    let mollusk = setup_with_both_tokens();
    let admin = Pubkey::new_unique();
    let withdrawer = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let withdrawer_share_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let withdrawer_base_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        withdraw_with_price_data(0, 1_000_000), // zero price
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(withdrawer, true),
            AccountMeta::new(withdrawer_share_ata, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(withdrawer_base_ata, false),
            AccountMeta::new(vault_key, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (withdrawer, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (withdrawer_share_ata, create_token2022_token_account(&share_mint_key, &withdrawer, 1_000_000)),
        (share_mint_key, create_token2022_mint(&vault_key, 6, 1_000_000, b"Test", b"TST", b"")),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 10_000_000)),
        (withdrawer_base_ata, create_token_account(&base_mint, &withdrawer, 0)),
        (vault_key, make_vault_account(vault_data)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x101))], // InvalidSharePrice
    );
}

#[test]
fn test_withdraw_with_price_zero_shares() {
    let mollusk = setup_with_both_tokens();
    let admin = Pubkey::new_unique();
    let withdrawer = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let withdrawer_share_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let withdrawer_base_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        withdraw_with_price_data(1_000_000, 0), // zero shares
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(withdrawer, true),
            AccountMeta::new(withdrawer_share_ata, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(withdrawer_base_ata, false),
            AccountMeta::new(vault_key, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (withdrawer, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (withdrawer_share_ata, create_token2022_token_account(&share_mint_key, &withdrawer, 1_000_000)),
        (share_mint_key, create_token2022_mint(&vault_key, 6, 1_000_000, b"Test", b"TST", b"")),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 10_000_000)),
        (withdrawer_base_ata, create_token_account(&base_mint, &withdrawer, 0)),
        (vault_key, make_vault_account(vault_data)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x102))], // InvalidAmount
    );
}

#[test]
fn test_withdraw_with_price_wrong_share_mint() {
    let mollusk = setup_with_both_tokens();
    let admin = Pubkey::new_unique();
    let withdrawer = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");
    let share_mint_key = Pubkey::new_unique();
    let wrong_share_mint = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let withdrawer_share_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let withdrawer_base_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        withdraw_with_price_data(1_000_000, 1_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(withdrawer, true),
            AccountMeta::new(withdrawer_share_ata, false),
            AccountMeta::new(wrong_share_mint, false),                   // wrong mint
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(withdrawer_base_ata, false),
            AccountMeta::new(vault_key, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (withdrawer, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (withdrawer_share_ata, create_token2022_token_account(&wrong_share_mint, &withdrawer, 1_000_000)),
        (wrong_share_mint, create_token2022_mint(&vault_key, 6, 1_000_000, b"Test", b"TST", b"")),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 10_000_000)),
        (withdrawer_base_ata, create_token_account(&base_mint, &withdrawer, 0)),
        (vault_key, make_vault_account(vault_data)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::InvalidAccountData)],
    );
}
