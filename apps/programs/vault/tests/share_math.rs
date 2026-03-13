mod helpers;

use helpers::*;
use mollusk_svm::result::Check;
use solana_account::Account;
use solana_instruction::AccountMeta;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;

/// Create a packed SPL Mint account.
fn create_mint(authority: &Pubkey, decimals: u8, supply: u64) -> Account {
    use solana_program_pack::Pack;
    use spl_token_interface::state::Mint;

    let mint = Mint {
        mint_authority: solana_program_option::COption::Some(*authority),
        supply,
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

/// Helper to run a DepositWithPrice and return resulting accounts.
fn run_deposit(
    share_decimals: u8,
    share_price: u64,
    deposit_amount: u64,
) -> mollusk_svm::result::InstructionResult {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, share_price, &[],
    );

    let depositor_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let depositor_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        deposit_with_price_data(share_price, deposit_amount),
        vec![
            AccountMeta::new_readonly(admin, true),            // admin (signer)
            AccountMeta::new_readonly(depositor, true),        // depositor (signer)
            AccountMeta::new(depositor_base_ata, false),       // depositor's base token
            AccountMeta::new(vault_base_ata, false),           // vault's base token
            AccountMeta::new(vault_key, false),                // vault_state (writable)
            AccountMeta::new(share_mint_key, false),           // share_mint
            AccountMeta::new(depositor_share_ata, false),      // depositor's share token
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false), // token_program
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, create_token_account(&base_mint, &depositor, deposit_amount)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_mint(&vault_key, share_decimals, 0)),
        (depositor_share_ata, create_token_account(&share_mint_key, &depositor, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    mollusk.process_instruction(&instruction, &accounts)
}

/// Helper to run a DepositWithPrice and assert an error.
fn run_deposit_expect_err(
    share_decimals: u8,
    share_price: u64,
    deposit_amount: u64,
    expected_err: ProgramError,
) {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, share_price, &[],
    );

    let depositor_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let depositor_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        deposit_with_price_data(share_price, deposit_amount),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(depositor, true),
            AccountMeta::new(depositor_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(depositor_share_ata, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, create_token_account(&base_mint, &depositor, deposit_amount)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_mint(&vault_key, share_decimals, 0)),
        (depositor_share_ata, create_token_account(&share_mint_key, &depositor, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(expected_err)],
    );
}

/// Helper to run a withdraw and assert an error.
fn run_withdraw_expect_err(
    share_decimals: u8,
    share_price: u64,
    shares_to_burn: u64,
    vault_base_balance: u64,
    expected_err: ProgramError,
) {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let withdrawer = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, share_price, &[],
    );

    let withdrawer_share_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let withdrawer_base_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        withdraw_data(shares_to_burn),
        vec![
            AccountMeta::new_readonly(withdrawer, true),
            AccountMeta::new(withdrawer_share_ata, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(withdrawer_base_ata, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (withdrawer, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (withdrawer_share_ata, create_token_account(&share_mint_key, &withdrawer, shares_to_burn)),
        (share_mint_key, create_mint(&vault_key, share_decimals, shares_to_burn)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, vault_base_balance)),
        (withdrawer_base_ata, create_token_account(&base_mint, &withdrawer, 0)),
        (vault_key, make_vault_account(vault_data)),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(expected_err)],
    );
}

// ── Deposit share math edge cases ──────────────────────────────────────

#[test]
fn test_deposit_high_decimals_9() {
    // decimals=9, price=1_000_000_000 (1:1), amount=5_000_000_000 (5 tokens)
    // shares = 5_000_000_000 * 10^9 / 1_000_000_000 = 5_000_000_000
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();

    let share_decimals: u8 = 9;
    let share_price: u64 = 1_000_000_000;
    let deposit_amount: u64 = 5_000_000_000;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, share_price, &[],
    );

    let depositor_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let depositor_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        deposit_with_price_data(share_price, deposit_amount),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(depositor, true),
            AccountMeta::new(depositor_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(depositor_share_ata, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, create_token_account(&base_mint, &depositor, deposit_amount)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_mint(&vault_key, share_decimals, 0)),
        (depositor_share_ata, create_token_account(&share_mint_key, &depositor, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    let result = mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );

    let depositor_shares = result.resulting_accounts.iter()
        .find(|(k, _)| *k == depositor_share_ata).unwrap().1.clone();
    let shares_minted = u64::from_le_bytes(depositor_shares.data[64..72].try_into().unwrap());
    assert_eq!(shares_minted, 5_000_000_000);
}

#[test]
fn test_deposit_truncation_rounding() {
    // decimals=6, price=3_000_000 (3x price)
    // amount = 10_000_000 (10 USDC)
    // shares = 10_000_000 * 10^6 / 3_000_000 = 10_000_000_000_000 / 3_000_000 = 3_333_333
    // (truncated, not 3_333_333.333...)
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();

    let share_decimals: u8 = 6;
    let share_price: u64 = 3_000_000;
    let deposit_amount: u64 = 10_000_000;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, share_price, &[],
    );

    let depositor_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let depositor_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        deposit_with_price_data(share_price, deposit_amount),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(depositor, true),
            AccountMeta::new(depositor_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(depositor_share_ata, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, create_token_account(&base_mint, &depositor, deposit_amount)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_mint(&vault_key, share_decimals, 0)),
        (depositor_share_ata, create_token_account(&share_mint_key, &depositor, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    let result = mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );

    let depositor_shares = result.resulting_accounts.iter()
        .find(|(k, _)| *k == depositor_share_ata).unwrap().1.clone();
    let shares_minted = u64::from_le_bytes(depositor_shares.data[64..72].try_into().unwrap());
    // 10_000_000 * 1_000_000 / 3_000_000 = 3_333_333 (integer truncation)
    assert_eq!(shares_minted, 3_333_333);
}

#[test]
fn test_deposit_rounds_to_zero_shares() {
    // decimals=6, price=10_000_000 (10x), amount=9
    // shares = 9 * 10^6 / 10_000_000 = 9_000_000 / 10_000_000 = 0 → InvalidAmount
    run_deposit_expect_err(
        6,
        10_000_000,
        9,
        ProgramError::Custom(0x102), // InvalidAmount
    );
}

#[test]
fn test_deposit_overflow_amount_times_multiplier() {
    // decimals=6, price=1_000_000, amount = u64::MAX / 10^6 + 1
    // amount * 10^6 overflows u64 → MathOverflow
    let overflow_amount = u64::MAX / 1_000_000 + 1; // 18_446_744_073_710
    run_deposit_expect_err(
        6,
        1_000_000,
        overflow_amount,
        ProgramError::Custom(0x106), // MathOverflow
    );
}

#[test]
fn test_deposit_large_valid_amount() {
    // decimals=6, price=1_000_000, amount just below overflow threshold
    // This should succeed: amount * 10^6 fits in u64
    let large_amount = u64::MAX / 1_000_000; // 18_446_744_073_709
    let result = run_deposit(6, 1_000_000, large_amount);
    // shares = large_amount * 10^6 / 10^6 = large_amount
    match &result.program_result {
        mollusk_svm::result::ProgramResult::Success => {}
        other => panic!("expected success, got: {:?}", other),
    }
}

// ── Withdraw share math edge cases ─────────────────────────────────────

#[test]
fn test_withdraw_overflow_shares_times_price() {
    // decimals=6, price=1_000_000, shares = u64::MAX / 1_000_000 + 1
    // shares * price overflows u64 → MathOverflow
    let overflow_shares = u64::MAX / 1_000_000 + 1;
    run_withdraw_expect_err(
        6,
        1_000_000,
        overflow_shares,
        u64::MAX, // vault has plenty of base
        ProgramError::Custom(0x106), // MathOverflow
    );
}

#[test]
fn test_withdraw_rounds_to_zero_base() {
    // decimals=9, price=1 (minimum valid price)
    // shares=999_999_999 → base = 999_999_999 * 1 / 10^9 = 0 → InvalidAmount
    run_withdraw_expect_err(
        9,
        1,
        999_999_999,
        1_000_000_000,
        ProgramError::Custom(0x102), // InvalidAmount
    );
}

#[test]
fn test_withdraw_high_decimals_success() {
    // decimals=9, price=1_000_000_000 (1:1), shares=3_000_000_000
    // base = 3_000_000_000 * 1_000_000_000 / 10^9 = 3_000_000_000
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let withdrawer = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();

    let share_decimals: u8 = 9;
    let share_price: u64 = 1_000_000_000;
    let shares_to_burn: u64 = 3_000_000_000;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, share_price, &[],
    );

    let withdrawer_share_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let withdrawer_base_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        withdraw_data(shares_to_burn),
        vec![
            AccountMeta::new_readonly(withdrawer, true),
            AccountMeta::new(withdrawer_share_ata, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(withdrawer_base_ata, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (withdrawer, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (withdrawer_share_ata, create_token_account(&share_mint_key, &withdrawer, shares_to_burn)),
        (share_mint_key, create_mint(&vault_key, share_decimals, shares_to_burn)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 10_000_000_000)),
        (withdrawer_base_ata, create_token_account(&base_mint, &withdrawer, 0)),
        (vault_key, make_vault_account(vault_data)),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    let result = mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );

    let withdrawer_base = result.resulting_accounts.iter()
        .find(|(k, _)| *k == withdrawer_base_ata).unwrap().1.clone();
    let base_received = u64::from_le_bytes(withdrawer_base.data[64..72].try_into().unwrap());
    assert_eq!(base_received, 3_000_000_000);
}

#[test]
fn test_withdraw_truncation_rounding() {
    // decimals=6, price=3_000_000 (3x), shares=10_000_000
    // base = 10_000_000 * 3_000_000 / 10^6 = 30_000_000_000_000 / 1_000_000 = 30_000_000
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let withdrawer = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();

    let share_decimals: u8 = 6;
    let share_price: u64 = 3_000_000;
    let shares_to_burn: u64 = 10_000_000;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, share_price, &[],
    );

    let withdrawer_share_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let withdrawer_base_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        withdraw_data(shares_to_burn),
        vec![
            AccountMeta::new_readonly(withdrawer, true),
            AccountMeta::new(withdrawer_share_ata, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(withdrawer_base_ata, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (withdrawer, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (withdrawer_share_ata, create_token_account(&share_mint_key, &withdrawer, shares_to_burn)),
        (share_mint_key, create_mint(&vault_key, share_decimals, shares_to_burn)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 100_000_000)),
        (withdrawer_base_ata, create_token_account(&base_mint, &withdrawer, 0)),
        (vault_key, make_vault_account(vault_data)),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    let result = mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );

    let withdrawer_base = result.resulting_accounts.iter()
        .find(|(k, _)| *k == withdrawer_base_ata).unwrap().1.clone();
    let base_received = u64::from_le_bytes(withdrawer_base.data[64..72].try_into().unwrap());
    // 10_000_000 * 3_000_000 / 1_000_000 = 30_000_000
    assert_eq!(base_received, 30_000_000);
}

// ── Round-trip consistency ──────────────────────────────────────────────

#[test]
fn test_deposit_withdraw_round_trip() {
    // At 1:1 price (decimals=6, price=1_000_000), deposit 7_500_000 then withdraw same shares.
    // Should get back exactly the same amount.
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let user = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();

    let share_decimals: u8 = 6;
    let share_price: u64 = 1_000_000;
    let deposit_amount: u64 = 7_500_000;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, share_price, &[],
    );

    let user_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let user_share_ata = Pubkey::new_unique();

    // ── Step 1: DepositWithPrice ──
    let deposit_ix = build_instruction(
        deposit_with_price_data(share_price, deposit_amount),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(user_share_ata, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let deposit_accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_base_ata, create_token_account(&base_mint, &user, deposit_amount)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_mint(&vault_key, share_decimals, 0)),
        (user_share_ata, create_token_account(&share_mint_key, &user, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    let deposit_result = mollusk.process_and_validate_instruction(
        &deposit_ix,
        &deposit_accounts,
        &[Check::success()],
    );

    // Read shares minted
    let user_shares_after_deposit = deposit_result.resulting_accounts.iter()
        .find(|(k, _)| *k == user_share_ata).unwrap().1.clone();
    let shares_minted = u64::from_le_bytes(
        user_shares_after_deposit.data[64..72].try_into().unwrap(),
    );
    assert_eq!(shares_minted, deposit_amount); // 1:1 at this price

    // ── Step 2: Withdraw using resulting accounts ──
    let updated_vault_base = deposit_result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_base_ata).unwrap().1.clone();
    let updated_share_mint = deposit_result.resulting_accounts.iter()
        .find(|(k, _)| *k == share_mint_key).unwrap().1.clone();

    let withdraw_ix = build_instruction(
        withdraw_data(shares_minted),
        vec![
            AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_share_ata, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(user_base_ata, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let vault_account = deposit_result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_key).unwrap().1.clone();

    let withdraw_accounts = vec![
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_share_ata, user_shares_after_deposit),
        (share_mint_key, updated_share_mint),
        (vault_base_ata, updated_vault_base),
        (user_base_ata, create_token_account(&base_mint, &user, 0)), // fresh dest
        (vault_key, vault_account),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    let withdraw_result = mollusk.process_and_validate_instruction(
        &withdraw_ix,
        &withdraw_accounts,
        &[Check::success()],
    );

    // Verify user got back exactly the deposit amount
    let user_base_final = withdraw_result.resulting_accounts.iter()
        .find(|(k, _)| *k == user_base_ata).unwrap().1.clone();
    let base_received = u64::from_le_bytes(user_base_final.data[64..72].try_into().unwrap());
    assert_eq!(base_received, deposit_amount);

    // Verify vault is empty
    let vault_base_final = withdraw_result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_base_ata).unwrap().1.clone();
    let vault_remaining = u64::from_le_bytes(vault_base_final.data[64..72].try_into().unwrap());
    assert_eq!(vault_remaining, 0);
}

#[test]
fn test_deposit_withdraw_round_trip_lossy() {
    // At 3x price, deposit 10 then withdraw the truncated shares.
    // User should lose the rounding difference.
    //
    // Deposit: shares = 10 * 10^6 / 3_000_000 = 10_000_000 / 3_000_000 = 3 (truncated from 3.33)
    // Withdraw: base = 3 * 3_000_000 / 10^6 = 9_000_000 / 1_000_000 = 9
    // User deposited 10, gets back 9 → lost 1 to rounding
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let user = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();

    let share_decimals: u8 = 6;
    let share_price: u64 = 3_000_000;
    let deposit_amount: u64 = 10;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, share_price, &[],
    );

    let user_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let user_share_ata = Pubkey::new_unique();

    // ── Step 1: DepositWithPrice ──
    let deposit_ix = build_instruction(
        deposit_with_price_data(share_price, deposit_amount),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(user_share_ata, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let deposit_accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_base_ata, create_token_account(&base_mint, &user, deposit_amount)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_mint(&vault_key, share_decimals, 0)),
        (user_share_ata, create_token_account(&share_mint_key, &user, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    let deposit_result = mollusk.process_and_validate_instruction(
        &deposit_ix,
        &deposit_accounts,
        &[Check::success()],
    );

    let user_shares_after = deposit_result.resulting_accounts.iter()
        .find(|(k, _)| *k == user_share_ata).unwrap().1.clone();
    let shares_minted = u64::from_le_bytes(user_shares_after.data[64..72].try_into().unwrap());
    // 10 * 10^6 / 3_000_000 = 3 (truncated)
    assert_eq!(shares_minted, 3);

    // ── Step 2: Withdraw ──
    let updated_vault_base = deposit_result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_base_ata).unwrap().1.clone();
    let updated_share_mint = deposit_result.resulting_accounts.iter()
        .find(|(k, _)| *k == share_mint_key).unwrap().1.clone();
    let vault_account = deposit_result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_key).unwrap().1.clone();

    let withdraw_ix = build_instruction(
        withdraw_data(shares_minted),
        vec![
            AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_share_ata, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(user_base_ata, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let withdraw_accounts = vec![
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_share_ata, user_shares_after),
        (share_mint_key, updated_share_mint),
        (vault_base_ata, updated_vault_base),
        (user_base_ata, create_token_account(&base_mint, &user, 0)),
        (vault_key, vault_account),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    let withdraw_result = mollusk.process_and_validate_instruction(
        &withdraw_ix,
        &withdraw_accounts,
        &[Check::success()],
    );

    let user_base_final = withdraw_result.resulting_accounts.iter()
        .find(|(k, _)| *k == user_base_ata).unwrap().1.clone();
    let base_received = u64::from_le_bytes(user_base_final.data[64..72].try_into().unwrap());
    // 3 shares * 3_000_000 / 10^6 = 9 (lost 1 to rounding)
    assert_eq!(base_received, 9);
    assert!(base_received < deposit_amount, "rounding should favor the vault");
}
