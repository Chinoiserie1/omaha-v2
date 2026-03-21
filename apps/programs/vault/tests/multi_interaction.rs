mod helpers;

use helpers::*;
use mollusk_svm::program::keyed_account_for_system_program;
use mollusk_svm::result::Check;
use solana_account::Account;
use solana_instruction::AccountMeta;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;

// ── Token Account Helpers (local, same pattern as other test files) ──

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

// ═══════════════════════════════════════════════════════════════════
// Group 1: Sequential Deposits (same user, same vault)
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_user_deposits_twice_same_vault() {
    let mollusk = setup_with_both_tokens();

    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"multi-dep");
    let share_mint_key = Pubkey::new_unique();
    let share_decimals: u8 = 6;
    let price: u64 = 1_000_000; // 1:1

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, price, &[], b"multi-dep",
    );

    let (pending_key, _) = pending_deposit_pda(&vault_key, &depositor);
    let depositor_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let depositor_share_ata = Pubkey::new_unique();

    // ── Step 1: RequestDeposit(5M) ──────────────────────────────
    let ix1 = build_instruction(
        request_deposit_data(5_000_000),
        vec![
            AccountMeta::new(depositor, true),
            AccountMeta::new(depositor_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pending_key, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
        ],
    );

    let accounts1 = vec![
        (depositor, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, create_token_account(&base_mint, &depositor, 10_000_000)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (pending_key, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(1000)),
    ];

    let r1 = mollusk.process_and_validate_instruction(&ix1, &accounts1, &[Check::success()]);

    let vault_after_1 = extract_account(&r1, &vault_key);
    let pending_after_1 = extract_account(&r1, &pending_key);
    let vault_base_after_1 = extract_account(&r1, &vault_base_ata);
    let depositor_base_after_1 = extract_account(&r1, &depositor_base_ata);
    let depositor_after_1 = extract_account(&r1, &depositor);

    assert_eq!(read_u64(&vault_base_after_1.data, 64), 5_000_000);

    // ── Step 2: FulfillDeposit (price=1M → 5M shares) ──────────
    let ix2 = build_instruction(
        fulfill_deposit_data(price),
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

    let accounts2 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, vault_after_1),
        (pending_key, pending_after_1),
        (share_mint_key, create_token2022_mint(&vault_key, share_decimals, 0, b"Test", b"TST", b"")),
        (depositor_share_ata, create_token2022_token_account(&share_mint_key, &depositor, 0)),
        (depositor, depositor_after_1),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];

    let r2 = mollusk.process_and_validate_instruction(&ix2, &accounts2, &[Check::success()]);

    let vault_after_2 = extract_account(&r2, &vault_key);
    let share_mint_after_2 = extract_account(&r2, &share_mint_key);
    let depositor_shares_after_2 = extract_account(&r2, &depositor_share_ata);

    assert_eq!(read_u64(&depositor_shares_after_2.data, 64), 5_000_000);
    // Pending PDA should be closed
    assert_eq!(extract_account(&r2, &pending_key).lamports, 0);

    // ── Step 3: RequestDeposit(3M) — new pending PDA ────────────
    let ix3 = build_instruction(
        request_deposit_data(3_000_000),
        vec![
            AccountMeta::new(depositor, true),
            AccountMeta::new(depositor_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pending_key, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
        ],
    );

    let accounts3 = vec![
        (depositor, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, depositor_base_after_1),
        (vault_base_ata, vault_base_after_1),
        (vault_key, vault_after_2.clone()),
        (pending_key, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(2000)),
    ];

    let r3 = mollusk.process_and_validate_instruction(&ix3, &accounts3, &[Check::success()]);

    let vault_base_after_3 = extract_account(&r3, &vault_base_ata);
    assert_eq!(read_u64(&vault_base_after_3.data, 64), 8_000_000);

    // ── Step 4: FulfillDeposit (price=1M → 3M more shares) ─────
    let pending_after_3 = extract_account(&r3, &pending_key);
    let vault_after_3 = extract_account(&r3, &vault_key);

    let ix4 = build_instruction(
        fulfill_deposit_data(price),
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

    let accounts4 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, vault_after_3),
        (pending_key, pending_after_3),
        (share_mint_key, share_mint_after_2),
        (depositor_share_ata, depositor_shares_after_2),
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];

    let r4 = mollusk.process_and_validate_instruction(&ix4, &accounts4, &[Check::success()]);

    // Final assertions: 5M + 3M = 8M shares
    let final_shares = extract_account(&r4, &depositor_share_ata);
    assert_eq!(read_u64(&final_shares.data, 64), 8_000_000);

    // Pending PDA closed again
    assert_eq!(extract_account(&r4, &pending_key).lamports, 0);
}

#[test]
fn test_user_second_pending_deposit_fails() {
    let mollusk = setup_with_token();

    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"dup-dep");
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[], b"dup-dep",
    );

    let (pending_key, _) = pending_deposit_pda(&vault_key, &depositor);
    let depositor_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();

    // ── Step 1: RequestDeposit(5M) — succeeds ──────────────────
    let ix1 = build_instruction(
        request_deposit_data(5_000_000),
        vec![
            AccountMeta::new(depositor, true),
            AccountMeta::new(depositor_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pending_key, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
        ],
    );

    let accounts1 = vec![
        (depositor, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, create_token_account(&base_mint, &depositor, 10_000_000)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (pending_key, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(1000)),
    ];

    let r1 = mollusk.process_and_validate_instruction(&ix1, &accounts1, &[Check::success()]);

    // ── Step 2: RequestDeposit(3M) without fulfilling first — fails
    let vault_after = extract_account(&r1, &vault_key);
    let pending_after = extract_account(&r1, &pending_key);
    let depositor_base_after = extract_account(&r1, &depositor_base_ata);
    let vault_base_after = extract_account(&r1, &vault_base_ata);
    let depositor_after = extract_account(&r1, &depositor);

    let ix2 = build_instruction(
        request_deposit_data(3_000_000),
        vec![
            AccountMeta::new(depositor, true),
            AccountMeta::new(depositor_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pending_key, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
        ],
    );

    let accounts2 = vec![
        (depositor, depositor_after),
        (depositor_base_ata, depositor_base_after),
        (vault_base_ata, vault_base_after),
        (vault_key, vault_after),
        (pending_key, pending_after), // already initialized!
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(2000)),
    ];

    // System program rejects creating an account that already exists (Custom(0))
    mollusk.process_and_validate_instruction(
        &ix2,
        &accounts2,
        &[Check::err(ProgramError::Custom(0))],
    );
}

// ═══════════════════════════════════════════════════════════════════
// Group 2: Multiple Vaults (same user)
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_user_deposits_in_two_vaults() {
    let mollusk = setup_with_both_tokens();

    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let price: u64 = 1_000_000;
    let share_decimals: u8 = 6;

    // Vault A
    let (vault_a_key, bump_a) = vault_pda(b"vault-a");
    let share_mint_a = Pubkey::new_unique();
    let vault_a_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_a, bump_a, share_decimals, price, &[], b"vault-a",
    );
    let (pending_a, _) = pending_deposit_pda(&vault_a_key, &depositor);
    let depositor_base_ata_a = Pubkey::new_unique();
    let vault_base_ata_a = Pubkey::new_unique();
    let depositor_share_ata_a = Pubkey::new_unique();

    // Vault B
    let (vault_b_key, bump_b) = vault_pda(b"vault-b");
    let share_mint_b = Pubkey::new_unique();
    let vault_b_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_b, bump_b, share_decimals, price, &[], b"vault-b",
    );
    let (pending_b, _) = pending_deposit_pda(&vault_b_key, &depositor);
    let depositor_base_ata_b = Pubkey::new_unique();
    let vault_base_ata_b = Pubkey::new_unique();
    let depositor_share_ata_b = Pubkey::new_unique();

    // ── Step 1: RequestDeposit(5M, vault_A) ─────────────────────
    let ix1 = build_instruction(
        request_deposit_data(5_000_000),
        vec![
            AccountMeta::new(depositor, true),
            AccountMeta::new(depositor_base_ata_a, false),
            AccountMeta::new(vault_base_ata_a, false),
            AccountMeta::new_readonly(vault_a_key, false),
            AccountMeta::new(pending_a, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
        ],
    );
    let accounts1 = vec![
        (depositor, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata_a, create_token_account(&base_mint, &depositor, 5_000_000)),
        (vault_base_ata_a, create_token_account(&base_mint, &vault_a_key, 0)),
        (vault_a_key, make_vault_account(vault_a_data)),
        (pending_a, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(1000)),
    ];
    let r1 = mollusk.process_and_validate_instruction(&ix1, &accounts1, &[Check::success()]);

    // ── Step 2: RequestDeposit(3M, vault_B) — different vault ───
    let ix2 = build_instruction(
        request_deposit_data(3_000_000),
        vec![
            AccountMeta::new(depositor, true),
            AccountMeta::new(depositor_base_ata_b, false),
            AccountMeta::new(vault_base_ata_b, false),
            AccountMeta::new_readonly(vault_b_key, false),
            AccountMeta::new(pending_b, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
        ],
    );
    let accounts2 = vec![
        (depositor, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata_b, create_token_account(&base_mint, &depositor, 3_000_000)),
        (vault_base_ata_b, create_token_account(&base_mint, &vault_b_key, 0)),
        (vault_b_key, make_vault_account(vault_b_data)),
        (pending_b, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(1000)),
    ];
    let r2 = mollusk.process_and_validate_instruction(&ix2, &accounts2, &[Check::success()]);

    // Both pendings exist simultaneously
    assert_eq!(extract_account(&r1, &pending_a).data[0], 0xA2);
    assert_eq!(extract_account(&r2, &pending_b).data[0], 0xA2);

    // ── Step 3: FulfillDeposit(vault_A) ─────────────────────────
    let ix3 = build_instruction(
        fulfill_deposit_data(price),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_a_key, false),
            AccountMeta::new(pending_a, false),
            AccountMeta::new(share_mint_a, false),
            AccountMeta::new(depositor_share_ata_a, false),
            AccountMeta::new(depositor, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let accounts3 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_a_key, extract_account(&r1, &vault_a_key)),
        (pending_a, extract_account(&r1, &pending_a)),
        (share_mint_a, create_token2022_mint(&vault_a_key, share_decimals, 0, b"A", b"A", b"")),
        (depositor_share_ata_a, create_token2022_token_account(&share_mint_a, &depositor, 0)),
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];
    let r3 = mollusk.process_and_validate_instruction(&ix3, &accounts3, &[Check::success()]);

    // ── Step 4: FulfillDeposit(vault_B) ─────────────────────────
    let ix4 = build_instruction(
        fulfill_deposit_data(price),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_b_key, false),
            AccountMeta::new(pending_b, false),
            AccountMeta::new(share_mint_b, false),
            AccountMeta::new(depositor_share_ata_b, false),
            AccountMeta::new(depositor, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let accounts4 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_b_key, extract_account(&r2, &vault_b_key)),
        (pending_b, extract_account(&r2, &pending_b)),
        (share_mint_b, create_token2022_mint(&vault_b_key, share_decimals, 0, b"B", b"B", b"")),
        (depositor_share_ata_b, create_token2022_token_account(&share_mint_b, &depositor, 0)),
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];
    let r4 = mollusk.process_and_validate_instruction(&ix4, &accounts4, &[Check::success()]);

    // Vault A: 5M shares
    assert_eq!(read_u64(&extract_account(&r3, &depositor_share_ata_a).data, 64), 5_000_000);
    // Vault B: 3M shares
    assert_eq!(read_u64(&extract_account(&r4, &depositor_share_ata_b).data, 64), 3_000_000);
}

#[test]
fn test_user_deposits_and_withdraws_different_vaults() {
    let mollusk = setup_with_both_tokens();

    let admin = Pubkey::new_unique();
    let user = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let price: u64 = 1_000_000;
    let share_decimals: u8 = 6;

    // Vault A setup
    let (vault_a_key, bump_a) = vault_pda(b"vlt-a");
    let share_mint_a = Pubkey::new_unique();
    let vault_a_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_a, bump_a, share_decimals, price, &[], b"vlt-a",
    );
    let user_base_ata_a = Pubkey::new_unique();
    let vault_base_ata_a = Pubkey::new_unique();
    let user_share_ata_a = Pubkey::new_unique();

    // Vault B setup
    let (vault_b_key, bump_b) = vault_pda(b"vlt-b");
    let share_mint_b = Pubkey::new_unique();
    let vault_b_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_b, bump_b, share_decimals, price, &[], b"vlt-b",
    );
    let user_base_ata_b = Pubkey::new_unique();
    let vault_base_ata_b = Pubkey::new_unique();
    let user_share_ata_b = Pubkey::new_unique();

    // ── Step 1: DepositWithPrice(5M, vault_A) ───────────────────
    let ix1 = build_instruction(
        deposit_with_price_data(price, 5_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_base_ata_a, false),
            AccountMeta::new(vault_base_ata_a, false),
            AccountMeta::new(vault_a_key, false),
            AccountMeta::new(share_mint_a, false),
            AccountMeta::new(user_share_ata_a, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let accounts1 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_base_ata_a, create_token_account(&base_mint, &user, 5_000_000)),
        (vault_base_ata_a, create_token_account(&base_mint, &vault_a_key, 0)),
        (vault_a_key, make_vault_account(vault_a_data)),
        (share_mint_a, create_token2022_mint(&vault_a_key, share_decimals, 0, b"A", b"A", b"")),
        (user_share_ata_a, create_token2022_token_account(&share_mint_a, &user, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];
    let r1 = mollusk.process_and_validate_instruction(&ix1, &accounts1, &[Check::success()]);

    // ── Step 2: DepositWithPrice(3M, vault_B) ───────────────────
    let ix2 = build_instruction(
        deposit_with_price_data(price, 3_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_base_ata_b, false),
            AccountMeta::new(vault_base_ata_b, false),
            AccountMeta::new(vault_b_key, false),
            AccountMeta::new(share_mint_b, false),
            AccountMeta::new(user_share_ata_b, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let accounts2 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_base_ata_b, create_token_account(&base_mint, &user, 3_000_000)),
        (vault_base_ata_b, create_token_account(&base_mint, &vault_b_key, 0)),
        (vault_b_key, make_vault_account(vault_b_data)),
        (share_mint_b, create_token2022_mint(&vault_b_key, share_decimals, 0, b"B", b"B", b"")),
        (user_share_ata_b, create_token2022_token_account(&share_mint_b, &user, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];
    let r2 = mollusk.process_and_validate_instruction(&ix2, &accounts2, &[Check::success()]);

    // User has 5M shares in A, 3M shares in B
    assert_eq!(read_u64(&extract_account(&r1, &user_share_ata_a).data, 64), 5_000_000);
    assert_eq!(read_u64(&extract_account(&r2, &user_share_ata_b).data, 64), 3_000_000);

    // ── Step 3: WithdrawWithPrice(2M shares, vault_A) ───────────
    let user_base_ata_a_recv = Pubkey::new_unique();
    let ix3 = build_instruction(
        withdraw_with_price_data(price, 2_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_share_ata_a, false),
            AccountMeta::new(share_mint_a, false),
            AccountMeta::new(vault_base_ata_a, false),
            AccountMeta::new(user_base_ata_a_recv, false),
            AccountMeta::new(vault_a_key, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let accounts3 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_share_ata_a, extract_account(&r1, &user_share_ata_a)),
        (share_mint_a, extract_account(&r1, &share_mint_a)),
        (vault_base_ata_a, extract_account(&r1, &vault_base_ata_a)),
        (user_base_ata_a_recv, create_token_account(&base_mint, &user, 0)),
        (vault_a_key, extract_account(&r1, &vault_a_key)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];
    let r3 = mollusk.process_and_validate_instruction(&ix3, &accounts3, &[Check::success()]);

    // Vault A: 3M shares remaining (5M - 2M)
    assert_eq!(read_u64(&extract_account(&r3, &user_share_ata_a).data, 64), 3_000_000);
    // Vault A base decreased: 5M - 2M = 3M
    assert_eq!(read_u64(&extract_account(&r3, &vault_base_ata_a).data, 64), 3_000_000);
    // User received 2M base tokens
    assert_eq!(read_u64(&extract_account(&r3, &user_base_ata_a_recv).data, 64), 2_000_000);
    // Vault B shares untouched (still same as after r2)
    assert_eq!(read_u64(&extract_account(&r2, &user_share_ata_b).data, 64), 3_000_000);
}

// ═══════════════════════════════════════════════════════════════════
// Group 3: Full Deposit → Withdraw Cycle
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_full_deposit_then_withdraw_cycle() {
    let mollusk = setup_with_both_tokens();

    let admin = Pubkey::new_unique();
    let user = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"full-cycle");
    let share_mint_key = Pubkey::new_unique();
    let share_decimals: u8 = 6;
    let price: u64 = 1_000_000;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, price, &[], b"full-cycle",
    );

    let (pd_key, _) = pending_deposit_pda(&vault_key, &user);
    let user_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let user_share_ata = Pubkey::new_unique();

    // ── Step 1: RequestDeposit(10M) ─────────────────────────────
    let ix1 = build_instruction(
        request_deposit_data(10_000_000),
        vec![
            AccountMeta::new(user, true),
            AccountMeta::new(user_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pd_key, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
        ],
    );
    let accounts1 = vec![
        (user, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (user_base_ata, create_token_account(&base_mint, &user, 10_000_000)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (pd_key, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(1000)),
    ];
    let r1 = mollusk.process_and_validate_instruction(&ix1, &accounts1, &[Check::success()]);

    // ── Step 2: FulfillDeposit(price=1M) → 10M shares ──────────
    let ix2 = build_instruction(
        fulfill_deposit_data(price),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(pd_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(user_share_ata, false),
            AccountMeta::new(user, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let accounts2 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, extract_account(&r1, &vault_key)),
        (pd_key, extract_account(&r1, &pd_key)),
        (share_mint_key, create_token2022_mint(&vault_key, share_decimals, 0, b"T", b"T", b"")),
        (user_share_ata, create_token2022_token_account(&share_mint_key, &user, 0)),
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];
    let r2 = mollusk.process_and_validate_instruction(&ix2, &accounts2, &[Check::success()]);

    assert_eq!(read_u64(&extract_account(&r2, &user_share_ata).data, 64), 10_000_000);
    assert_eq!(extract_account(&r2, &pd_key).lamports, 0); // PDA closed

    // ── Step 3: RequestWithdraw(10M shares) ─────────────────────
    let (pw_key, _) = pending_withdraw_pda(&vault_key, &user);
    let vault_share_ata = Pubkey::new_unique();
    let ix3 = build_instruction(
        request_withdraw_data(10_000_000),
        vec![
            AccountMeta::new(user, true),
            AccountMeta::new(user_share_ata, false),
            AccountMeta::new_readonly(share_mint_key, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pw_key, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
            AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
            AccountMeta::new(vault_share_ata, false),
        ],
    );
    let accounts3 = vec![
        (user, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (user_share_ata, extract_account(&r2, &user_share_ata)),
        (share_mint_key, extract_account(&r2, &share_mint_key)),
        (vault_key, extract_account(&r2, &vault_key)),
        (pw_key, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token2022::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(2000)),
        (vault_share_ata, create_token2022_token_account(&share_mint_key, &vault_key, 0)),
    ];
    let r3 = mollusk.process_and_validate_instruction(&ix3, &accounts3, &[Check::success()]);

    // User shares = 0 (escrowed)
    assert_eq!(read_u64(&extract_account(&r3, &user_share_ata).data, 64), 0);

    // ── Step 4: FulfillWithdraw(price=1M) → 10M base returned ──
    let user_base_ata_recv = Pubkey::new_unique();
    let ix4 = build_instruction(
        fulfill_withdraw_data(price),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(pw_key, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(user_base_ata_recv, false),
            AccountMeta::new(user, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new(vault_share_ata, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let accounts4 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, extract_account(&r3, &vault_key)),
        (pw_key, extract_account(&r3, &pw_key)),
        (vault_base_ata, extract_account(&r1, &vault_base_ata)),
        (user_base_ata_recv, create_token_account(&base_mint, &user, 0)),
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token::keyed_account(),
        (vault_share_ata, extract_account(&r3, &vault_share_ata)),
        (share_mint_key, extract_account(&r3, &share_mint_key)),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];
    let r4 = mollusk.process_and_validate_instruction(&ix4, &accounts4, &[Check::success()]);

    // User gets back 10M base tokens
    assert_eq!(read_u64(&extract_account(&r4, &user_base_ata_recv).data, 64), 10_000_000);
    // Vault base balance = 0
    assert_eq!(read_u64(&extract_account(&r4, &vault_base_ata).data, 64), 0);
    // Share supply = 0
    assert_eq!(read_u64(&extract_account(&r4, &share_mint_key).data, 36), 0);
    // Pending withdraw PDA closed
    assert_eq!(extract_account(&r4, &pw_key).lamports, 0);
}

#[test]
fn test_deposit_price_increase_then_withdraw() {
    let mollusk = setup_with_both_tokens();

    let admin = Pubkey::new_unique();
    let user = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"price-up");
    let share_mint_key = Pubkey::new_unique();
    let share_decimals: u8 = 6;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, 1_000_000, &[], b"price-up",
    );

    let user_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let user_share_ata = Pubkey::new_unique();

    // ── Step 1: DepositWithPrice(10M, price=1M) → 10M shares ───
    let ix1 = build_instruction(
        deposit_with_price_data(1_000_000, 10_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(user_share_ata, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let accounts1 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_base_ata, create_token_account(&base_mint, &user, 10_000_000)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_token2022_mint(&vault_key, share_decimals, 0, b"T", b"T", b"")),
        (user_share_ata, create_token2022_token_account(&share_mint_key, &user, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];
    let r1 = mollusk.process_and_validate_instruction(&ix1, &accounts1, &[Check::success()]);
    assert_eq!(read_u64(&extract_account(&r1, &user_share_ata).data, 64), 10_000_000);

    // ── Step 2: WithdrawWithPrice(10M shares, price=2M) ─────────
    // Price doubled → 10M shares × 2M / 1M = 20M base tokens
    let user_base_ata_recv = Pubkey::new_unique();
    let ix2 = build_instruction(
        withdraw_with_price_data(2_000_000, 10_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_share_ata, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(user_base_ata_recv, false),
            AccountMeta::new(vault_key, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );

    // Vault needs 20M but only has 10M from deposit, so simulate that vault acquired more
    // via trading (using vault_base with 20M)
    let mut vault_base_data = extract_account(&r1, &vault_base_ata);
    vault_base_data.data[64..72].copy_from_slice(&20_000_000u64.to_le_bytes());

    let accounts2 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_share_ata, extract_account(&r1, &user_share_ata)),
        (share_mint_key, extract_account(&r1, &share_mint_key)),
        (vault_base_ata, vault_base_data),
        (user_base_ata_recv, create_token_account(&base_mint, &user, 0)),
        (vault_key, extract_account(&r1, &vault_key)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];
    let r2 = mollusk.process_and_validate_instruction(&ix2, &accounts2, &[Check::success()]);

    // User profits: got 20M base from 10M deposit
    assert_eq!(read_u64(&extract_account(&r2, &user_base_ata_recv).data, 64), 20_000_000);
    assert_eq!(read_u64(&extract_account(&r2, &user_share_ata).data, 64), 0);
    assert_eq!(read_u64(&extract_account(&r2, &vault_key).data, 208), 2_000_000);
}

#[test]
fn test_deposit_price_decrease_then_withdraw() {
    let mollusk = setup_with_both_tokens();

    let admin = Pubkey::new_unique();
    let user = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"price-down");
    let share_mint_key = Pubkey::new_unique();
    let share_decimals: u8 = 6;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, 1_000_000, &[], b"price-down",
    );

    let user_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let user_share_ata = Pubkey::new_unique();

    // ── Step 1: DepositWithPrice(10M, price=1M) → 10M shares ───
    let ix1 = build_instruction(
        deposit_with_price_data(1_000_000, 10_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(user_share_ata, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let accounts1 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_base_ata, create_token_account(&base_mint, &user, 10_000_000)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_token2022_mint(&vault_key, share_decimals, 0, b"T", b"T", b"")),
        (user_share_ata, create_token2022_token_account(&share_mint_key, &user, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];
    let r1 = mollusk.process_and_validate_instruction(&ix1, &accounts1, &[Check::success()]);

    // ── Step 2: WithdrawWithPrice(10M shares, price=500K) ───────
    // Price halved → 10M shares × 500K / 1M = 5M base tokens
    let user_base_ata_recv = Pubkey::new_unique();
    let ix2 = build_instruction(
        withdraw_with_price_data(500_000, 10_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_share_ata, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(user_base_ata_recv, false),
            AccountMeta::new(vault_key, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let accounts2 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_share_ata, extract_account(&r1, &user_share_ata)),
        (share_mint_key, extract_account(&r1, &share_mint_key)),
        (vault_base_ata, extract_account(&r1, &vault_base_ata)),
        (user_base_ata_recv, create_token_account(&base_mint, &user, 0)),
        (vault_key, extract_account(&r1, &vault_key)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];
    let r2 = mollusk.process_and_validate_instruction(&ix2, &accounts2, &[Check::success()]);

    // User loses: got 5M base from 10M deposit
    assert_eq!(read_u64(&extract_account(&r2, &user_base_ata_recv).data, 64), 5_000_000);
    // Vault retains 5M
    assert_eq!(read_u64(&extract_account(&r2, &vault_base_ata).data, 64), 5_000_000);
}

// ═══════════════════════════════════════════════════════════════════
// Group 4: Multiple Users
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_two_users_deposit_same_vault() {
    let mollusk = setup_with_both_tokens();

    let admin = Pubkey::new_unique();
    let user_a = Pubkey::new_unique();
    let user_b = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"two-users");
    let share_mint_key = Pubkey::new_unique();
    let share_decimals: u8 = 6;
    let price: u64 = 1_000_000;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, price, &[], b"two-users",
    );

    let (pending_a, _) = pending_deposit_pda(&vault_key, &user_a);
    let (pending_b, _) = pending_deposit_pda(&vault_key, &user_b);
    let user_a_base_ata = Pubkey::new_unique();
    let user_b_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let user_a_share_ata = Pubkey::new_unique();
    let user_b_share_ata = Pubkey::new_unique();

    // ── Step 1: User A RequestDeposit(5M) ───────────────────────
    let ix1 = build_instruction(
        request_deposit_data(5_000_000),
        vec![
            AccountMeta::new(user_a, true),
            AccountMeta::new(user_a_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pending_a, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
        ],
    );
    let accounts1 = vec![
        (user_a, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (user_a_base_ata, create_token_account(&base_mint, &user_a, 5_000_000)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (pending_a, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(1000)),
    ];
    let r1 = mollusk.process_and_validate_instruction(&ix1, &accounts1, &[Check::success()]);

    // ── Step 2: User B RequestDeposit(3M) — same vault ──────────
    let ix2 = build_instruction(
        request_deposit_data(3_000_000),
        vec![
            AccountMeta::new(user_b, true),
            AccountMeta::new(user_b_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pending_b, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
        ],
    );
    let accounts2 = vec![
        (user_b, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (user_b_base_ata, create_token_account(&base_mint, &user_b, 3_000_000)),
        (vault_base_ata, extract_account(&r1, &vault_base_ata)),
        (vault_key, extract_account(&r1, &vault_key)),
        (pending_b, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(1000)),
    ];
    let r2 = mollusk.process_and_validate_instruction(&ix2, &accounts2, &[Check::success()]);

    // Both pending PDAs exist with correct depositors
    assert_eq!(&extract_account(&r1, &pending_a).data[40..72], user_a.as_ref());
    assert_eq!(&extract_account(&r2, &pending_b).data[40..72], user_b.as_ref());
    // Vault base = 5M + 3M = 8M
    assert_eq!(read_u64(&extract_account(&r2, &vault_base_ata).data, 64), 8_000_000);

    // ── Step 3: FulfillDeposit(user_A) ──────────────────────────
    let ix3 = build_instruction(
        fulfill_deposit_data(price),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(pending_a, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(user_a_share_ata, false),
            AccountMeta::new(user_a, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let accounts3 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, extract_account(&r2, &vault_key)),
        (pending_a, extract_account(&r1, &pending_a)),
        (share_mint_key, create_token2022_mint(&vault_key, share_decimals, 0, b"T", b"T", b"")),
        (user_a_share_ata, create_token2022_token_account(&share_mint_key, &user_a, 0)),
        (user_a, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];
    let r3 = mollusk.process_and_validate_instruction(&ix3, &accounts3, &[Check::success()]);

    // ── Step 4: FulfillDeposit(user_B) ──────────────────────────
    let ix4 = build_instruction(
        fulfill_deposit_data(price),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(pending_b, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(user_b_share_ata, false),
            AccountMeta::new(user_b, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let accounts4 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, extract_account(&r3, &vault_key)),
        (pending_b, extract_account(&r2, &pending_b)),
        (share_mint_key, extract_account(&r3, &share_mint_key)),
        (user_b_share_ata, create_token2022_token_account(&share_mint_key, &user_b, 0)),
        (user_b, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];
    let r4 = mollusk.process_and_validate_instruction(&ix4, &accounts4, &[Check::success()]);

    // User A: 5M shares, User B: 3M shares
    assert_eq!(read_u64(&extract_account(&r3, &user_a_share_ata).data, 64), 5_000_000);
    assert_eq!(read_u64(&extract_account(&r4, &user_b_share_ata).data, 64), 3_000_000);
    // Total supply = 8M
    assert_eq!(read_u64(&extract_account(&r4, &share_mint_key).data, 36), 8_000_000);
}

#[test]
fn test_two_users_deposit_and_one_withdraws() {
    let mollusk = setup_with_both_tokens();

    let admin = Pubkey::new_unique();
    let user_a = Pubkey::new_unique();
    let user_b = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"two-u-wd");
    let share_mint_key = Pubkey::new_unique();
    let share_decimals: u8 = 6;
    let price: u64 = 1_000_000;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, price, &[], b"two-u-wd",
    );

    let user_a_base_ata = Pubkey::new_unique();
    let user_b_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let user_a_share_ata = Pubkey::new_unique();
    let user_b_share_ata = Pubkey::new_unique();

    // ── Step 1: DepositWithPrice(5M, user_A) ────────────────────
    let ix1 = build_instruction(
        deposit_with_price_data(price, 5_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(user_a, true),
            AccountMeta::new(user_a_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(user_a_share_ata, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let accounts1 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_a, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_a_base_ata, create_token_account(&base_mint, &user_a, 5_000_000)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_token2022_mint(&vault_key, share_decimals, 0, b"T", b"T", b"")),
        (user_a_share_ata, create_token2022_token_account(&share_mint_key, &user_a, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];
    let r1 = mollusk.process_and_validate_instruction(&ix1, &accounts1, &[Check::success()]);

    // ── Step 2: DepositWithPrice(3M, user_B) ────────────────────
    let ix2 = build_instruction(
        deposit_with_price_data(price, 3_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(user_b, true),
            AccountMeta::new(user_b_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(user_b_share_ata, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let accounts2 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_b, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_b_base_ata, create_token_account(&base_mint, &user_b, 3_000_000)),
        (vault_base_ata, extract_account(&r1, &vault_base_ata)),
        (vault_key, extract_account(&r1, &vault_key)),
        (share_mint_key, extract_account(&r1, &share_mint_key)),
        (user_b_share_ata, create_token2022_token_account(&share_mint_key, &user_b, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];
    let r2 = mollusk.process_and_validate_instruction(&ix2, &accounts2, &[Check::success()]);

    // ── Step 3: WithdrawWithPrice(5M shares, user_A) ────────────
    let user_a_base_ata_recv = Pubkey::new_unique();
    let ix3 = build_instruction(
        withdraw_with_price_data(price, 5_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(user_a, true),
            AccountMeta::new(user_a_share_ata, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(user_a_base_ata_recv, false),
            AccountMeta::new(vault_key, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let accounts3 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_a, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_a_share_ata, extract_account(&r1, &user_a_share_ata)),
        (share_mint_key, extract_account(&r2, &share_mint_key)),
        (vault_base_ata, extract_account(&r2, &vault_base_ata)),
        (user_a_base_ata_recv, create_token_account(&base_mint, &user_a, 0)),
        (vault_key, extract_account(&r2, &vault_key)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];
    let r3 = mollusk.process_and_validate_instruction(&ix3, &accounts3, &[Check::success()]);

    // User A: 0 shares, got 5M base back
    assert_eq!(read_u64(&extract_account(&r3, &user_a_share_ata).data, 64), 0);
    assert_eq!(read_u64(&extract_account(&r3, &user_a_base_ata_recv).data, 64), 5_000_000);
    // User B: 3M shares unchanged
    assert_eq!(read_u64(&extract_account(&r2, &user_b_share_ata).data, 64), 3_000_000);
    // Vault retains 3M base (for user B)
    assert_eq!(read_u64(&extract_account(&r3, &vault_base_ata).data, 64), 3_000_000);
    // Supply = 3M (user A's 5M burned)
    assert_eq!(read_u64(&extract_account(&r3, &share_mint_key).data, 36), 3_000_000);
}

// ═══════════════════════════════════════════════════════════════════
// Group 5: Fees + Multi-Step
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_deposit_collect_fees_then_withdraw() {
    let mollusk = setup_with_both_tokens();

    let admin = Pubkey::new_unique();
    let user = Pubkey::new_unique();
    let fee_receiver = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"fee-test");
    let share_mint_key = Pubkey::new_unique();
    let share_decimals: u8 = 6;
    let price: u64 = 1_000_000;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, price, &[], b"fee-test",
    );
    let fee_receiver_ata = Pubkey::new_unique();
    let user_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let user_share_ata = Pubkey::new_unique();

    // ── Step 1: DepositWithPrice(10M, price=1M) → 10M shares ───
    let ix1 = build_instruction(
        deposit_with_price_data(price, 10_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(user_share_ata, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let accounts1 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_base_ata, create_token_account(&base_mint, &user, 10_000_000)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_token2022_mint(&vault_key, share_decimals, 0, b"T", b"T", b"")),
        (user_share_ata, create_token2022_token_account(&share_mint_key, &user, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];
    let r1 = mollusk.process_and_validate_instruction(&ix1, &accounts1, &[Check::success()]);
    assert_eq!(read_u64(&extract_account(&r1, &user_share_ata).data, 64), 10_000_000);

    // ── Step 2: UpdateFees(mgmt=200bps) ─────────────────────────
    let ix2 = build_instruction(
        update_fees_data(0, 0, 200, 0, &fee_receiver),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
        ],
    );
    let accounts2 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, extract_account(&r1, &vault_key)),
    ];
    let r2 = mollusk.process_and_validate_instruction(&ix2, &accounts2, &[Check::success()]);

    // ── Step 3: CollectFees (first call — initialize timestamp) ─
    let last_ts: i64 = 1_000_000;
    let ix3 = build_instruction(
        collect_fees_data(),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(fee_receiver_ata, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
            AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
        ],
    );
    let accounts3 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, extract_account(&r2, &vault_key)),
        (share_mint_key, extract_account(&r1, &share_mint_key)),
        (fee_receiver_ata, create_token2022_token_account(&share_mint_key, &fee_receiver, 0)),
        mollusk_svm_programs_token::token2022::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(last_ts)),
    ];
    let r3 = mollusk.process_and_validate_instruction(&ix3, &accounts3, &[Check::success()]);

    // ── Step 4: CollectFees (1 year later → fee shares minted) ──
    let seconds_per_year: i64 = 31_557_600;
    let current_ts = last_ts + seconds_per_year;
    let ix4 = build_instruction(
        collect_fees_data(),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(fee_receiver_ata, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
            AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
        ],
    );
    let accounts4 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, extract_account(&r3, &vault_key)),
        (share_mint_key, extract_account(&r3, &share_mint_key)),
        (fee_receiver_ata, extract_account(&r3, &fee_receiver_ata)),
        mollusk_svm_programs_token::token2022::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(current_ts)),
    ];
    let r4 = mollusk.process_and_validate_instruction(&ix4, &accounts4, &[Check::success()]);

    // 2% of 10M = 200K fee shares minted
    let fee_shares = read_u64(&extract_account(&r4, &fee_receiver_ata).data, 64);
    assert_eq!(fee_shares, 200_000);

    // Total supply = 10M user + 200K fee = 10_200_000
    let total_supply = read_u64(&extract_account(&r4, &share_mint_key).data, 36);
    assert_eq!(total_supply, 10_200_000);

    // ── Step 5: WithdrawWithPrice(10M shares, user) ─────────────
    // User has 10M shares out of 10.2M total. At price=1M, gets 10M base.
    // But vault only has 10M base. This works because withdraw is share-based.
    let user_base_recv = Pubkey::new_unique();
    let ix5 = build_instruction(
        withdraw_with_price_data(price, 10_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_share_ata, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(user_base_recv, false),
            AccountMeta::new(vault_key, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let accounts5 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_share_ata, extract_account(&r1, &user_share_ata)),
        (share_mint_key, extract_account(&r4, &share_mint_key)),
        (vault_base_ata, extract_account(&r1, &vault_base_ata)),
        (user_base_recv, create_token_account(&base_mint, &user, 0)),
        (vault_key, extract_account(&r4, &vault_key)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];
    let r5 = mollusk.process_and_validate_instruction(&ix5, &accounts5, &[Check::success()]);

    // User gets 10M base (shares * price / 10^decimals = 10M * 1M / 1M = 10M)
    assert_eq!(read_u64(&extract_account(&r5, &user_base_recv).data, 64), 10_000_000);
    // User has 0 shares
    assert_eq!(read_u64(&extract_account(&r5, &user_share_ata).data, 64), 0);
    // Fee receiver still holds 200K shares (dilution is the fee mechanism)
    // Total supply decreased by burned user shares: 10.2M - 10M = 200K
    assert_eq!(read_u64(&extract_account(&r5, &share_mint_key).data, 36), 200_000);
}

#[test]
fn test_deposit_with_entry_fee_then_withdraw_with_exit_fee() {
    let mollusk = setup_with_both_tokens();

    let admin = Pubkey::new_unique();
    let user = Pubkey::new_unique();
    let fee_receiver = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"entry-exit");
    let share_mint_key = Pubkey::new_unique();
    let share_decimals: u8 = 6;
    let price: u64 = 1_000_000;

    let mut vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, price, &[], b"entry-exit",
    );
    // 500bps = 5% entry fee, 500bps = 5% exit fee
    set_vault_fees(&mut vault_data, 500, 500, 0, 0, &fee_receiver, price, 0);

    let (pd_key, _) = pending_deposit_pda(&vault_key, &user);
    let user_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let user_share_ata = Pubkey::new_unique();
    let fee_receiver_ata = Pubkey::new_unique();

    // ── Step 1: RequestDeposit(10M) — entry_fee_bps snapshotted ─
    let ix1 = build_instruction(
        request_deposit_data(10_000_000),
        vec![
            AccountMeta::new(user, true),
            AccountMeta::new(user_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pd_key, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
        ],
    );
    let accounts1 = vec![
        (user, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (user_base_ata, create_token_account(&base_mint, &user, 10_000_000)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (pd_key, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(1000)),
    ];
    let r1 = mollusk.process_and_validate_instruction(&ix1, &accounts1, &[Check::success()]);

    // Verify entry_fee_bps snapshotted in pending deposit
    let pending_data = extract_account(&r1, &pd_key);
    let snapshot_fee = u16::from_le_bytes(pending_data.data[2..4].try_into().unwrap());
    assert_eq!(snapshot_fee, 500);

    // ── Step 2: FulfillDeposit(price=1M) with fee_receiver ──────
    // 10M deposit, 5% entry fee → 500K fee shares, 9.5M user shares
    let ix2 = build_instruction(
        fulfill_deposit_data(price),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(pd_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(user_share_ata, false),
            AccountMeta::new(user, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
            AccountMeta::new(fee_receiver_ata, false),
        ],
    );
    let accounts2 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, extract_account(&r1, &vault_key)),
        (pd_key, extract_account(&r1, &pd_key)),
        (share_mint_key, create_token2022_mint(&vault_key, share_decimals, 0, b"T", b"T", b"")),
        (user_share_ata, create_token2022_token_account(&share_mint_key, &user, 0)),
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token2022::keyed_account(),
        (fee_receiver_ata, create_token2022_token_account(&share_mint_key, &fee_receiver, 0)),
    ];
    let r2 = mollusk.process_and_validate_instruction(&ix2, &accounts2, &[Check::success()]);

    // User shares: 10M * (1 - 0.05) = 9.5M
    let user_shares = read_u64(&extract_account(&r2, &user_share_ata).data, 64);
    assert_eq!(user_shares, 9_500_000);
    // Fee receiver: 500K shares
    let fee_shares = read_u64(&extract_account(&r2, &fee_receiver_ata).data, 64);
    assert_eq!(fee_shares, 500_000);

    // ── Step 3: RequestWithdraw(9.5M shares) ────────────────────
    let (pw_key, _) = pending_withdraw_pda(&vault_key, &user);
    let vault_share_ata = Pubkey::new_unique();
    let ix3 = build_instruction(
        request_withdraw_data(user_shares),
        vec![
            AccountMeta::new(user, true),
            AccountMeta::new(user_share_ata, false),
            AccountMeta::new_readonly(share_mint_key, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pw_key, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
            AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
            AccountMeta::new(vault_share_ata, false),
        ],
    );
    let accounts3 = vec![
        (user, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (user_share_ata, extract_account(&r2, &user_share_ata)),
        (share_mint_key, extract_account(&r2, &share_mint_key)),
        (vault_key, extract_account(&r2, &vault_key)),
        (pw_key, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token2022::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(2000)),
        (vault_share_ata, create_token2022_token_account(&share_mint_key, &vault_key, 0)),
    ];
    let r3 = mollusk.process_and_validate_instruction(&ix3, &accounts3, &[Check::success()]);

    // Verify exit_fee_bps snapshotted
    let pw_data = extract_account(&r3, &pw_key);
    let snapshot_exit_fee = u16::from_le_bytes(pw_data.data[2..4].try_into().unwrap());
    assert_eq!(snapshot_exit_fee, 500);

    // ── Step 4: FulfillWithdraw(price=1M) ───────────────────────
    // 9.5M shares at price=1M → 9.5M base before exit fee
    // 5% exit fee → 9.5M * 0.95 = 9_025_000 base returned
    let user_base_recv = Pubkey::new_unique();
    let ix4 = build_instruction(
        fulfill_withdraw_data(price),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(pw_key, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(user_base_recv, false),
            AccountMeta::new(user, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new(vault_share_ata, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let accounts4 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, extract_account(&r3, &vault_key)),
        (pw_key, extract_account(&r3, &pw_key)),
        (vault_base_ata, extract_account(&r1, &vault_base_ata)),
        (user_base_recv, create_token_account(&base_mint, &user, 0)),
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token::keyed_account(),
        (vault_share_ata, extract_account(&r3, &vault_share_ata)),
        (share_mint_key, extract_account(&r3, &share_mint_key)),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];
    let r4 = mollusk.process_and_validate_instruction(&ix4, &accounts4, &[Check::success()]);

    // User receives less than deposited due to entry + exit fees
    let base_received = read_u64(&extract_account(&r4, &user_base_recv).data, 64);
    // 9.5M shares * 1M price / 1M decimals = 9.5M base; minus 5% exit = 9_025_000
    assert_eq!(base_received, 9_025_000);
    // Vault retains exit fee: 10M - 9_025_000 = 975_000
    assert_eq!(read_u64(&extract_account(&r4, &vault_base_ata).data, 64), 975_000);
}

// ═══════════════════════════════════════════════════════════════════
// Group 6: Pause Interactions
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_deposit_pause_unpause_withdraw() {
    let mollusk = setup_with_both_tokens();

    let admin = Pubkey::new_unique();
    let user = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"pause-flow");
    let share_mint_key = Pubkey::new_unique();
    let share_decimals: u8 = 6;
    let price: u64 = 1_000_000;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, price, &[], b"pause-flow",
    );

    let user_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let user_share_ata = Pubkey::new_unique();

    // ── Step 1: DepositWithPrice(10M) ───────────────────────────
    let ix1 = build_instruction(
        deposit_with_price_data(price, 10_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(user_share_ata, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let accounts1 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_base_ata, create_token_account(&base_mint, &user, 10_000_000)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_token2022_mint(&vault_key, share_decimals, 0, b"T", b"T", b"")),
        (user_share_ata, create_token2022_token_account(&share_mint_key, &user, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];
    let r1 = mollusk.process_and_validate_instruction(&ix1, &accounts1, &[Check::success()]);

    // ── Step 2: PauseVault ──────────────────────────────────────
    let ix2 = build_instruction(
        pause_vault_data(),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
        ],
    );
    let accounts2 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, extract_account(&r1, &vault_key)),
    ];
    let r2 = mollusk.process_and_validate_instruction(&ix2, &accounts2, &[Check::success()]);
    assert_eq!(extract_account(&r2, &vault_key).data[13], 1); // paused

    // ── Step 3: RequestWithdraw — fails (VaultPaused) ───────────
    let (pw_key, _) = pending_withdraw_pda(&vault_key, &user);
    let vault_share_ata = Pubkey::new_unique();
    let ix3 = build_instruction(
        request_withdraw_data(10_000_000),
        vec![
            AccountMeta::new(user, true),
            AccountMeta::new(user_share_ata, false),
            AccountMeta::new_readonly(share_mint_key, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pw_key, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
            AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
            AccountMeta::new(vault_share_ata, false),
        ],
    );
    let accounts3 = vec![
        (user, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (user_share_ata, extract_account(&r1, &user_share_ata)),
        (share_mint_key, extract_account(&r1, &share_mint_key)),
        (vault_key, extract_account(&r2, &vault_key)),
        (pw_key, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token2022::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(2000)),
        (vault_share_ata, create_token2022_token_account(&share_mint_key, &vault_key, 0)),
    ];
    mollusk.process_and_validate_instruction(
        &ix3, &accounts3, &[Check::err(ProgramError::Custom(0x110))],
    );

    // ── Step 4: UnpauseVault ────────────────────────────────────
    let ix4 = build_instruction(
        unpause_vault_data(),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
        ],
    );
    let accounts4 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, extract_account(&r2, &vault_key)),
    ];
    let r4 = mollusk.process_and_validate_instruction(&ix4, &accounts4, &[Check::success()]);
    assert_eq!(extract_account(&r4, &vault_key).data[13], 0); // unpaused

    // ── Step 5: WithdrawWithPrice succeeds after unpause ────────
    let user_base_recv = Pubkey::new_unique();
    let ix5 = build_instruction(
        withdraw_with_price_data(price, 10_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_share_ata, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(user_base_recv, false),
            AccountMeta::new(vault_key, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let accounts5 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_share_ata, extract_account(&r1, &user_share_ata)),
        (share_mint_key, extract_account(&r1, &share_mint_key)),
        (vault_base_ata, extract_account(&r1, &vault_base_ata)),
        (user_base_recv, create_token_account(&base_mint, &user, 0)),
        (vault_key, extract_account(&r4, &vault_key)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];
    let r5 = mollusk.process_and_validate_instruction(&ix5, &accounts5, &[Check::success()]);

    assert_eq!(read_u64(&extract_account(&r5, &user_base_recv).data, 64), 10_000_000);
}

#[test]
fn test_pending_deposit_fulfilled_while_paused() {
    let mollusk = setup_with_both_tokens();

    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"paused-ful");
    let share_mint_key = Pubkey::new_unique();
    let share_decimals: u8 = 6;
    let price: u64 = 1_000_000;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, price, &[], b"paused-ful",
    );

    let (pd_key, _) = pending_deposit_pda(&vault_key, &depositor);
    let depositor_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let depositor_share_ata = Pubkey::new_unique();

    // ── Step 1: RequestDeposit(10M) ─────────────────────────────
    let ix1 = build_instruction(
        request_deposit_data(10_000_000),
        vec![
            AccountMeta::new(depositor, true),
            AccountMeta::new(depositor_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pd_key, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
        ],
    );
    let accounts1 = vec![
        (depositor, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, create_token_account(&base_mint, &depositor, 10_000_000)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (pd_key, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(1000)),
    ];
    let r1 = mollusk.process_and_validate_instruction(&ix1, &accounts1, &[Check::success()]);

    // ── Step 2: PauseVault ──────────────────────────────────────
    let ix2 = build_instruction(
        pause_vault_data(),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
        ],
    );
    let accounts2 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, extract_account(&r1, &vault_key)),
    ];
    let r2 = mollusk.process_and_validate_instruction(&ix2, &accounts2, &[Check::success()]);
    assert_eq!(extract_account(&r2, &vault_key).data[13], 1);

    // ── Step 3: FulfillDeposit while paused — admin op succeeds ─
    let ix3 = build_instruction(
        fulfill_deposit_data(price),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(pd_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(depositor_share_ata, false),
            AccountMeta::new(depositor, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let accounts3 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, extract_account(&r2, &vault_key)),
        (pd_key, extract_account(&r1, &pd_key)),
        (share_mint_key, create_token2022_mint(&vault_key, share_decimals, 0, b"T", b"T", b"")),
        (depositor_share_ata, create_token2022_token_account(&share_mint_key, &depositor, 0)),
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];
    let r3 = mollusk.process_and_validate_instruction(&ix3, &accounts3, &[Check::success()]);

    // Shares minted correctly even while paused
    assert_eq!(read_u64(&extract_account(&r3, &depositor_share_ata).data, 64), 10_000_000);
    // Pending PDA closed
    assert_eq!(extract_account(&r3, &pd_key).lamports, 0);
    // Vault still paused
    assert_eq!(extract_account(&r3, &vault_key).data[13], 1);
}

// ═══════════════════════════════════════════════════════════════════
// Group 7: Cancel + Retry
// ═══════════════════════════════════════════════════════════════════

#[test]
fn test_cancel_deposit_then_redeposit() {
    let mollusk = setup_with_both_tokens();

    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"cancel-re");
    let share_mint_key = Pubkey::new_unique();
    let share_decimals: u8 = 6;
    let price: u64 = 1_000_000;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, price, &[], b"cancel-re",
    );

    let (pd_key, _) = pending_deposit_pda(&vault_key, &depositor);
    let depositor_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let depositor_share_ata = Pubkey::new_unique();

    // ── Step 1: RequestDeposit(5M) ──────────────────────────────
    let created_at: i64 = 1000;
    let ix1 = build_instruction(
        request_deposit_data(5_000_000),
        vec![
            AccountMeta::new(depositor, true),
            AccountMeta::new(depositor_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pd_key, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
        ],
    );
    let accounts1 = vec![
        (depositor, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, create_token_account(&base_mint, &depositor, 15_000_000)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (pd_key, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(created_at)),
    ];
    let r1 = mollusk.process_and_validate_instruction(&ix1, &accounts1, &[Check::success()]);

    // Vault has 5M base, depositor has 10M remaining
    assert_eq!(read_u64(&extract_account(&r1, &vault_base_ata).data, 64), 5_000_000);

    // ── Step 2: CancelDeposit (after 48h expiry) ────────────────
    let cancel_time = created_at + 172_800 + 1; // 48h + 1s
    let ix2 = build_instruction(
        cancel_deposit_data(),
        vec![
            AccountMeta::new(depositor, true),
            AccountMeta::new(pd_key, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(depositor_base_ata, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
        ],
    );
    let accounts2 = vec![
        (depositor, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (pd_key, extract_account(&r1, &pd_key)),
        (vault_key, extract_account(&r1, &vault_key)),
        (vault_base_ata, extract_account(&r1, &vault_base_ata)),
        (depositor_base_ata, extract_account(&r1, &depositor_base_ata)),
        mollusk_svm_programs_token::token::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(cancel_time)),
    ];
    let r2 = mollusk.process_and_validate_instruction(&ix2, &accounts2, &[Check::success()]);

    // PDA closed, base tokens refunded
    assert_eq!(extract_account(&r2, &pd_key).lamports, 0);
    assert_eq!(read_u64(&extract_account(&r2, &vault_base_ata).data, 64), 0);
    assert_eq!(read_u64(&extract_account(&r2, &depositor_base_ata).data, 64), 15_000_000);

    // ── Step 3: RequestDeposit(10M) — new deposit succeeds ──────
    let ix3 = build_instruction(
        request_deposit_data(10_000_000),
        vec![
            AccountMeta::new(depositor, true),
            AccountMeta::new(depositor_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pd_key, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
        ],
    );
    let accounts3 = vec![
        (depositor, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, extract_account(&r2, &depositor_base_ata)),
        (vault_base_ata, extract_account(&r2, &vault_base_ata)),
        (vault_key, extract_account(&r2, &vault_key)),
        (pd_key, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(cancel_time + 100)),
    ];
    let r3 = mollusk.process_and_validate_instruction(&ix3, &accounts3, &[Check::success()]);

    // New pending deposit with 10M
    assert_eq!(read_u64(&extract_account(&r3, &pd_key).data, 72), 10_000_000);
    assert_eq!(read_u64(&extract_account(&r3, &vault_base_ata).data, 64), 10_000_000);

    // ── Step 4: FulfillDeposit → 10M shares ─────────────────────
    let ix4 = build_instruction(
        fulfill_deposit_data(price),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(pd_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(depositor_share_ata, false),
            AccountMeta::new(depositor, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let accounts4 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, extract_account(&r3, &vault_key)),
        (pd_key, extract_account(&r3, &pd_key)),
        (share_mint_key, create_token2022_mint(&vault_key, share_decimals, 0, b"T", b"T", b"")),
        (depositor_share_ata, create_token2022_token_account(&share_mint_key, &depositor, 0)),
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];
    let r4 = mollusk.process_and_validate_instruction(&ix4, &accounts4, &[Check::success()]);

    // Final: 10M shares (only from second deposit)
    assert_eq!(read_u64(&extract_account(&r4, &depositor_share_ata).data, 64), 10_000_000);
}
