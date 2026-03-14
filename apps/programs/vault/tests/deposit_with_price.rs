mod helpers;

use helpers::*;
use mollusk_svm::result::Check;
use solana_account::Account;
use solana_instruction::AccountMeta;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;

use omaha_vault::state::VaultState;

/// Create a packed SPL Mint account (legacy token — for base token operations).
fn create_mint(authority: &Pubkey, decimals: u8) -> Account {
    use solana_program_pack::Pack;
    use spl_token_interface::state::Mint;

    let mint = Mint {
        mint_authority: solana_program_option::COption::Some(*authority),
        supply: 0,
        decimals,
        is_initialized: true,
        freeze_authority: solana_program_option::COption::None,
    };
    let mut data = vec![0u8; Mint::LEN];
    Mint::pack(mint, &mut data).unwrap();

    Account {
        lamports: 1_000_000_000,
        data,
        owner: TOKEN_PROGRAM_ID,
        executable: false,
        rent_epoch: 0,
    }
}

/// Create a packed SPL Token account (legacy token — for base token operations).
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
fn test_deposit_with_price_success() {
    let mollusk = setup_with_both_tokens();
    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();

    let share_decimals: u8 = 6;
    let old_price: u64 = 1_000_000;
    let new_price: u64 = 2_000_000; // 2x price
    let deposit_amount: u64 = 10_000_000; // 10 USDC

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, old_price, &[],
    );

    let depositor_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let depositor_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        deposit_with_price_data(new_price, deposit_amount),
        vec![
            AccountMeta::new_readonly(admin, true),                      // 0: admin (signer)
            AccountMeta::new_readonly(depositor, true),                  // 1: depositor (signer)
            AccountMeta::new(depositor_base_ata, false),                 // 2: depositor's base token (legacy)
            AccountMeta::new(vault_base_ata, false),                     // 3: vault's base token (legacy)
            AccountMeta::new(vault_key, false),                          // 4: vault_state (writable)
            AccountMeta::new(share_mint_key, false),                     // 5: share_mint (Token 2022)
            AccountMeta::new(depositor_share_ata, false),                // 6: depositor's share token (Token 2022)
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),          // 7: legacy token_program
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),     // 8: share_token_program (Token 2022)
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, create_token_account(&base_mint, &depositor, deposit_amount)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_token2022_mint(&vault_key, share_decimals, 0, b"Test", b"TST", b"")),
        (depositor_share_ata, create_token2022_token_account(&share_mint_key, &depositor, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];

    // shares = 10_000_000 * 10^6 / 2_000_000 = 5_000_000
    let expected_shares: u64 = 5_000_000;

    let result = mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );

    // Verify shares minted at new price
    let depositor_shares = result.resulting_accounts.iter()
        .find(|(k, _)| *k == depositor_share_ata).unwrap().1.clone();
    let shares_amount = u64::from_le_bytes(depositor_shares.data[64..72].try_into().unwrap());
    assert_eq!(shares_amount, expected_shares);

    // Verify vault state price was updated
    let vault_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_key).unwrap().1.clone();
    let updated_price = u64::from_le_bytes(vault_account.data[144..152].try_into().unwrap());
    assert_eq!(updated_price, new_price);

    // Verify base tokens transferred
    let vault_base = result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_base_ata).unwrap().1.clone();
    let vault_base_amount = u64::from_le_bytes(vault_base.data[64..72].try_into().unwrap());
    assert_eq!(vault_base_amount, deposit_amount);
}

#[test]
fn test_deposit_with_price_admin_is_depositor() {
    let mollusk = setup_with_both_tokens();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();

    let share_decimals: u8 = 6;
    let new_price: u64 = 1_000_000;
    let deposit_amount: u64 = 5_000_000;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, new_price, &[],
    );

    let admin_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let admin_share_ata = Pubkey::new_unique();

    // Admin is both admin and depositor
    let instruction = build_instruction(
        deposit_with_price_data(new_price, deposit_amount),
        vec![
            AccountMeta::new_readonly(admin, true),                      // 0: admin = depositor
            AccountMeta::new_readonly(admin, true),                      // 1: depositor = admin
            AccountMeta::new(admin_base_ata, false),                     // 2: base token (legacy)
            AccountMeta::new(vault_base_ata, false),                     // 3: vault's base token (legacy)
            AccountMeta::new(vault_key, false),                          // 4: vault_state
            AccountMeta::new(share_mint_key, false),                     // 5: share_mint (Token 2022)
            AccountMeta::new(admin_share_ata, false),                    // 6: share token (Token 2022)
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),          // 7: legacy token_program
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),     // 8: share_token_program (Token 2022)
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (admin_base_ata, create_token_account(&base_mint, &admin, deposit_amount)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_token2022_mint(&vault_key, share_decimals, 0, b"Test", b"TST", b"")),
        (admin_share_ata, create_token2022_token_account(&share_mint_key, &admin, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );
}

#[test]
fn test_deposit_with_price_unauthorized() {
    let mollusk = setup_with_both_tokens();
    let admin = Pubkey::new_unique();
    let not_admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[],
    );

    let depositor_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let depositor_share_ata = Pubkey::new_unique();

    // not_admin tries to set price — should fail
    let instruction = build_instruction(
        deposit_with_price_data(2_000_000, 1_000_000),
        vec![
            AccountMeta::new_readonly(not_admin, true),                  // 0: NOT admin
            AccountMeta::new_readonly(depositor, true),                  // 1: depositor
            AccountMeta::new(depositor_base_ata, false),                 // 2: base token (legacy)
            AccountMeta::new(vault_base_ata, false),                     // 3: vault's base token (legacy)
            AccountMeta::new(vault_key, false),                          // 4: vault_state
            AccountMeta::new(share_mint_key, false),                     // 5: share_mint (Token 2022)
            AccountMeta::new(depositor_share_ata, false),                // 6: share token (Token 2022)
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),          // 7: legacy token_program
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),     // 8: share_token_program (Token 2022)
        ],
    );

    let accounts = vec![
        (not_admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, create_token_account(&base_mint, &depositor, 1_000_000)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_token2022_mint(&vault_key, 6, 0, b"Test", b"TST", b"")),
        (depositor_share_ata, create_token2022_token_account(&share_mint_key, &depositor, 0)),
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
fn test_deposit_with_price_zero_price() {
    let mollusk = setup_with_both_tokens();
    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[],
    );

    let depositor_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let depositor_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        deposit_with_price_data(0, 1_000_000), // zero price
        vec![
            AccountMeta::new_readonly(admin, true),                      // 0: admin
            AccountMeta::new_readonly(depositor, true),                  // 1: depositor
            AccountMeta::new(depositor_base_ata, false),                 // 2: base token (legacy)
            AccountMeta::new(vault_base_ata, false),                     // 3: vault's base token (legacy)
            AccountMeta::new(vault_key, false),                          // 4: vault_state
            AccountMeta::new(share_mint_key, false),                     // 5: share_mint (Token 2022)
            AccountMeta::new(depositor_share_ata, false),                // 6: share token (Token 2022)
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),          // 7: legacy token_program
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),     // 8: share_token_program (Token 2022)
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, create_token_account(&base_mint, &depositor, 1_000_000)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_token2022_mint(&vault_key, 6, 0, b"Test", b"TST", b"")),
        (depositor_share_ata, create_token2022_token_account(&share_mint_key, &depositor, 0)),
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
fn test_deposit_with_price_zero_amount() {
    let mollusk = setup_with_both_tokens();
    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[],
    );

    let depositor_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let depositor_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        deposit_with_price_data(1_000_000, 0), // zero amount
        vec![
            AccountMeta::new_readonly(admin, true),                      // 0: admin
            AccountMeta::new_readonly(depositor, true),                  // 1: depositor
            AccountMeta::new(depositor_base_ata, false),                 // 2: base token (legacy)
            AccountMeta::new(vault_base_ata, false),                     // 3: vault's base token (legacy)
            AccountMeta::new(vault_key, false),                          // 4: vault_state
            AccountMeta::new(share_mint_key, false),                     // 5: share_mint (Token 2022)
            AccountMeta::new(depositor_share_ata, false),                // 6: share token (Token 2022)
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),          // 7: legacy token_program
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),     // 8: share_token_program (Token 2022)
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, create_token_account(&base_mint, &depositor, 1_000_000)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_token2022_mint(&vault_key, 6, 0, b"Test", b"TST", b"")),
        (depositor_share_ata, create_token2022_token_account(&share_mint_key, &depositor, 0)),
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
fn test_deposit_with_price_missing_admin_signer() {
    let mollusk = setup_with_both_tokens();
    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[],
    );

    let depositor_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let depositor_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        deposit_with_price_data(1_000_000, 1_000_000),
        vec![
            AccountMeta::new_readonly(admin, false),                     // 0: NOT signer
            AccountMeta::new_readonly(depositor, true),                  // 1: depositor
            AccountMeta::new(depositor_base_ata, false),                 // 2: base token (legacy)
            AccountMeta::new(vault_base_ata, false),                     // 3: vault's base token (legacy)
            AccountMeta::new(vault_key, false),                          // 4: vault_state
            AccountMeta::new(share_mint_key, false),                     // 5: share_mint (Token 2022)
            AccountMeta::new(depositor_share_ata, false),                // 6: share token (Token 2022)
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),          // 7: legacy token_program
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),     // 8: share_token_program (Token 2022)
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, create_token_account(&base_mint, &depositor, 1_000_000)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_token2022_mint(&vault_key, 6, 0, b"Test", b"TST", b"")),
        (depositor_share_ata, create_token2022_token_account(&share_mint_key, &depositor, 0)),
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
fn test_deposit_with_price_missing_depositor_signer() {
    let mollusk = setup_with_both_tokens();
    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[],
    );

    let depositor_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let depositor_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        deposit_with_price_data(1_000_000, 1_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),                      // 0: admin
            AccountMeta::new_readonly(depositor, false),                 // 1: NOT signer
            AccountMeta::new(depositor_base_ata, false),                 // 2: base token (legacy)
            AccountMeta::new(vault_base_ata, false),                     // 3: vault's base token (legacy)
            AccountMeta::new(vault_key, false),                          // 4: vault_state
            AccountMeta::new(share_mint_key, false),                     // 5: share_mint (Token 2022)
            AccountMeta::new(depositor_share_ata, false),                // 6: share token (Token 2022)
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),          // 7: legacy token_program
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),     // 8: share_token_program (Token 2022)
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, create_token_account(&base_mint, &depositor, 1_000_000)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_token2022_mint(&vault_key, 6, 0, b"Test", b"TST", b"")),
        (depositor_share_ata, create_token2022_token_account(&share_mint_key, &depositor, 0)),
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
fn test_deposit_with_price_wrong_share_mint() {
    let mollusk = setup_with_both_tokens();
    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();
    let wrong_share_mint = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[],
    );

    let depositor_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let depositor_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        deposit_with_price_data(1_000_000, 1_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),                      // 0: admin
            AccountMeta::new_readonly(depositor, true),                  // 1: depositor
            AccountMeta::new(depositor_base_ata, false),                 // 2: base token (legacy)
            AccountMeta::new(vault_base_ata, false),                     // 3: vault's base token (legacy)
            AccountMeta::new(vault_key, false),                          // 4: vault_state
            AccountMeta::new(wrong_share_mint, false),                   // 5: wrong mint
            AccountMeta::new(depositor_share_ata, false),                // 6: share token (Token 2022)
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),          // 7: legacy token_program
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),     // 8: share_token_program (Token 2022)
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, create_token_account(&base_mint, &depositor, 1_000_000)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (wrong_share_mint, create_token2022_mint(&vault_key, 6, 0, b"Test", b"TST", b"")),
        (depositor_share_ata, create_token2022_token_account(&wrong_share_mint, &depositor, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::InvalidAccountData)],
    );
}
