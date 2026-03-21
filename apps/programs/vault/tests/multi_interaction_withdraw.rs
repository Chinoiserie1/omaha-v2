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
// Group 1: Sequential Withdrawals (same user, same vault)
// ═══════════════════════════════════════════════════════════════════

/// User deposits 10M, then withdraws 5M, then withdraws remaining 5M
/// via the async request/fulfill flow.
#[test]
fn test_user_withdraws_twice_same_vault() {
    let mollusk = setup_with_both_tokens();

    let admin = Pubkey::new_unique();
    let user = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"wd-twice");
    let share_mint_key = Pubkey::new_unique();
    let share_decimals: u8 = 6;
    let price: u64 = 1_000_000;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, price, &[], b"wd-twice",
    );

    let user_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let user_share_ata = Pubkey::new_unique();

    // ── Step 1: DepositWithPrice(10M) → 10M shares ─────────────
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

    // ── Step 2: RequestWithdraw(5M shares) ──────────────────────
    let (pw_key, _) = pending_withdraw_pda(&vault_key, &user);
    let vault_share_ata = Pubkey::new_unique();
    let ix2 = build_instruction(
        request_withdraw_data(5_000_000),
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
    let accounts2 = vec![
        (user, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (user_share_ata, extract_account(&r1, &user_share_ata)),
        (share_mint_key, extract_account(&r1, &share_mint_key)),
        (vault_key, extract_account(&r1, &vault_key)),
        (pw_key, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token2022::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(1000)),
        (vault_share_ata, create_token2022_token_account(&share_mint_key, &vault_key, 0)),
    ];
    let r2 = mollusk.process_and_validate_instruction(&ix2, &accounts2, &[Check::success()]);
    // User has 5M shares remaining, 5M escrowed
    assert_eq!(read_u64(&extract_account(&r2, &user_share_ata).data, 64), 5_000_000);

    // ── Step 3: FulfillWithdraw(price=1M) → 5M base returned ───
    let user_base_recv = Pubkey::new_unique();
    let ix3 = build_instruction(
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
    let accounts3 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, extract_account(&r2, &vault_key)),
        (pw_key, extract_account(&r2, &pw_key)),
        (vault_base_ata, extract_account(&r1, &vault_base_ata)),
        (user_base_recv, create_token_account(&base_mint, &user, 0)),
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token::keyed_account(),
        (vault_share_ata, extract_account(&r2, &vault_share_ata)),
        (share_mint_key, extract_account(&r2, &share_mint_key)),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];
    let r3 = mollusk.process_and_validate_instruction(&ix3, &accounts3, &[Check::success()]);
    assert_eq!(read_u64(&extract_account(&r3, &user_base_recv).data, 64), 5_000_000);
    assert_eq!(extract_account(&r3, &pw_key).lamports, 0); // PDA closed

    // ── Step 4: RequestWithdraw(5M shares) — new pending PDA ────
    let ix4 = build_instruction(
        request_withdraw_data(5_000_000),
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
    let accounts4 = vec![
        (user, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (user_share_ata, extract_account(&r2, &user_share_ata)), // still has 5M
        (share_mint_key, extract_account(&r3, &share_mint_key)),
        (vault_key, extract_account(&r3, &vault_key)),
        (pw_key, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token2022::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(2000)),
        (vault_share_ata, create_token2022_token_account(&share_mint_key, &vault_key, 0)),
    ];
    let r4 = mollusk.process_and_validate_instruction(&ix4, &accounts4, &[Check::success()]);

    // ── Step 5: FulfillWithdraw → remaining 5M base returned ────
    let user_base_recv2 = Pubkey::new_unique();
    let ix5 = build_instruction(
        fulfill_withdraw_data(price),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(pw_key, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new(user_base_recv2, false),
            AccountMeta::new(user, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new(vault_share_ata, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let accounts5 = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, extract_account(&r4, &vault_key)),
        (pw_key, extract_account(&r4, &pw_key)),
        (vault_base_ata, extract_account(&r3, &vault_base_ata)),
        (user_base_recv2, create_token_account(&base_mint, &user, 0)),
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token::keyed_account(),
        (vault_share_ata, extract_account(&r4, &vault_share_ata)),
        (share_mint_key, extract_account(&r4, &share_mint_key)),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ];
    let r5 = mollusk.process_and_validate_instruction(&ix5, &accounts5, &[Check::success()]);

    // All 10M withdrawn in two batches
    assert_eq!(read_u64(&extract_account(&r5, &user_base_recv2).data, 64), 5_000_000);
    assert_eq!(read_u64(&extract_account(&r5, &vault_base_ata).data, 64), 0);
    assert_eq!(read_u64(&extract_account(&r5, &share_mint_key).data, 36), 0); // supply = 0
    assert_eq!(extract_account(&r5, &pw_key).lamports, 0);
}

/// Second pending withdraw on same vault fails because PDA already exists.
#[test]
fn test_user_second_pending_withdraw_fails() {
    let mollusk = setup_with_both_tokens();

    let admin = Pubkey::new_unique();
    let user = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"dup-wd");
    let share_mint_key = Pubkey::new_unique();
    let share_decimals: u8 = 6;
    let price: u64 = 1_000_000;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, price, &[], b"dup-wd",
    );
    let user_share_ata = Pubkey::new_unique();

    // ── Step 1: DepositWithPrice(10M) ───────────────────────────
    let user_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
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

    // ── Step 2: RequestWithdraw(3M) — succeeds ─────────────────
    let (pw_key, _) = pending_withdraw_pda(&vault_key, &user);
    let vault_share_ata = Pubkey::new_unique();
    let ix2 = build_instruction(
        request_withdraw_data(3_000_000),
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
    let accounts2 = vec![
        (user, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (user_share_ata, extract_account(&r1, &user_share_ata)),
        (share_mint_key, extract_account(&r1, &share_mint_key)),
        (vault_key, extract_account(&r1, &vault_key)),
        (pw_key, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token2022::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(1000)),
        (vault_share_ata, create_token2022_token_account(&share_mint_key, &vault_key, 0)),
    ];
    let r2 = mollusk.process_and_validate_instruction(&ix2, &accounts2, &[Check::success()]);

    // ── Step 3: RequestWithdraw(5M) without fulfilling — fails ──
    let ix3 = build_instruction(
        request_withdraw_data(5_000_000),
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
        (pw_key, extract_account(&r2, &pw_key)), // already initialized!
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token2022::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(2000)),
        (vault_share_ata, extract_account(&r2, &vault_share_ata)),
    ];
    mollusk.process_and_validate_instruction(
        &ix3, &accounts3, &[Check::err(ProgramError::Custom(0))],
    );
}

// ═══════════════════════════════════════════════════════════════════
// Group 2: Multiple Vaults (same user withdrawing)
// ═══════════════════════════════════════════════════════════════════

/// User withdraws from two different vaults independently.
#[test]
fn test_user_withdraws_from_two_vaults() {
    let mollusk = setup_with_both_tokens();

    let admin = Pubkey::new_unique();
    let user = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let price: u64 = 1_000_000;
    let share_decimals: u8 = 6;

    // Vault A: deposit 5M
    let (vault_a, bump_a) = vault_pda(b"wdv-a");
    let share_mint_a = Pubkey::new_unique();
    let vault_a_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_a, bump_a, share_decimals, price, &[], b"wdv-a",
    );
    let user_base_a = Pubkey::new_unique();
    let vault_base_a = Pubkey::new_unique();
    let user_share_a = Pubkey::new_unique();

    // Vault B: deposit 3M
    let (vault_b, bump_b) = vault_pda(b"wdv-b");
    let share_mint_b = Pubkey::new_unique();
    let vault_b_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_b, bump_b, share_decimals, price, &[], b"wdv-b",
    );
    let user_base_b = Pubkey::new_unique();
    let vault_base_b = Pubkey::new_unique();
    let user_share_b = Pubkey::new_unique();

    // ── Deposit into both vaults ────────────────────────────────
    let dep_a = build_instruction(
        deposit_with_price_data(price, 5_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_base_a, false),
            AccountMeta::new(vault_base_a, false),
            AccountMeta::new(vault_a, false),
            AccountMeta::new(share_mint_a, false),
            AccountMeta::new(user_share_a, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let ra = mollusk.process_and_validate_instruction(&dep_a, &vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_base_a, create_token_account(&base_mint, &user, 5_000_000)),
        (vault_base_a, create_token_account(&base_mint, &vault_a, 0)),
        (vault_a, make_vault_account(vault_a_data)),
        (share_mint_a, create_token2022_mint(&vault_a, share_decimals, 0, b"A", b"A", b"")),
        (user_share_a, create_token2022_token_account(&share_mint_a, &user, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ], &[Check::success()]);

    let dep_b = build_instruction(
        deposit_with_price_data(price, 3_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_base_b, false),
            AccountMeta::new(vault_base_b, false),
            AccountMeta::new(vault_b, false),
            AccountMeta::new(share_mint_b, false),
            AccountMeta::new(user_share_b, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let rb = mollusk.process_and_validate_instruction(&dep_b, &vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_base_b, create_token_account(&base_mint, &user, 3_000_000)),
        (vault_base_b, create_token_account(&base_mint, &vault_b, 0)),
        (vault_b, make_vault_account(vault_b_data)),
        (share_mint_b, create_token2022_mint(&vault_b, share_decimals, 0, b"B", b"B", b"")),
        (user_share_b, create_token2022_token_account(&share_mint_b, &user, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ], &[Check::success()]);

    // ── Withdraw from vault A (all 5M shares) ───────────────────
    let recv_a = Pubkey::new_unique();
    let wd_a = build_instruction(
        withdraw_with_price_data(price, 5_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_share_a, false),
            AccountMeta::new(share_mint_a, false),
            AccountMeta::new(vault_base_a, false),
            AccountMeta::new(recv_a, false),
            AccountMeta::new(vault_a, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let rwa = mollusk.process_and_validate_instruction(&wd_a, &vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_share_a, extract_account(&ra, &user_share_a)),
        (share_mint_a, extract_account(&ra, &share_mint_a)),
        (vault_base_a, extract_account(&ra, &vault_base_a)),
        (recv_a, create_token_account(&base_mint, &user, 0)),
        (vault_a, extract_account(&ra, &vault_a)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ], &[Check::success()]);

    // ── Withdraw from vault B (all 3M shares) ───────────────────
    let recv_b = Pubkey::new_unique();
    let wd_b = build_instruction(
        withdraw_with_price_data(price, 3_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_share_b, false),
            AccountMeta::new(share_mint_b, false),
            AccountMeta::new(vault_base_b, false),
            AccountMeta::new(recv_b, false),
            AccountMeta::new(vault_b, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let rwb = mollusk.process_and_validate_instruction(&wd_b, &vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_share_b, extract_account(&rb, &user_share_b)),
        (share_mint_b, extract_account(&rb, &share_mint_b)),
        (vault_base_b, extract_account(&rb, &vault_base_b)),
        (recv_b, create_token_account(&base_mint, &user, 0)),
        (vault_b, extract_account(&rb, &vault_b)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ], &[Check::success()]);

    // Vault A: empty
    assert_eq!(read_u64(&extract_account(&rwa, &recv_a).data, 64), 5_000_000);
    assert_eq!(read_u64(&extract_account(&rwa, &vault_base_a).data, 64), 0);
    // Vault B: empty
    assert_eq!(read_u64(&extract_account(&rwb, &recv_b).data, 64), 3_000_000);
    assert_eq!(read_u64(&extract_account(&rwb, &vault_base_b).data, 64), 0);
}

// ═══════════════════════════════════════════════════════════════════
// Group 3: Multiple Users Withdrawing
// ═══════════════════════════════════════════════════════════════════

/// Two users both request withdrawals from the same vault simultaneously.
#[test]
fn test_two_users_withdraw_same_vault() {
    let mollusk = setup_with_both_tokens();

    let admin = Pubkey::new_unique();
    let user_a = Pubkey::new_unique();
    let user_b = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"2u-wd");
    let share_mint_key = Pubkey::new_unique();
    let share_decimals: u8 = 6;
    let price: u64 = 1_000_000;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, price, &[], b"2u-wd",
    );

    // ── Deposit for both users ──────────────────────────────────
    let ua_base = Pubkey::new_unique();
    let ub_base = Pubkey::new_unique();
    let vault_base = Pubkey::new_unique();
    let ua_share = Pubkey::new_unique();
    let ub_share = Pubkey::new_unique();

    // User A deposits 5M
    let d1 = build_instruction(
        deposit_with_price_data(price, 5_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(user_a, true),
            AccountMeta::new(ua_base, false),
            AccountMeta::new(vault_base, false),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(ua_share, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let r1 = mollusk.process_and_validate_instruction(&d1, &vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_a, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (ua_base, create_token_account(&base_mint, &user_a, 5_000_000)),
        (vault_base, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_token2022_mint(&vault_key, share_decimals, 0, b"T", b"T", b"")),
        (ua_share, create_token2022_token_account(&share_mint_key, &user_a, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ], &[Check::success()]);

    // User B deposits 3M
    let d2 = build_instruction(
        deposit_with_price_data(price, 3_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(user_b, true),
            AccountMeta::new(ub_base, false),
            AccountMeta::new(vault_base, false),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(ub_share, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let r2 = mollusk.process_and_validate_instruction(&d2, &vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_b, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (ub_base, create_token_account(&base_mint, &user_b, 3_000_000)),
        (vault_base, extract_account(&r1, &vault_base)),
        (vault_key, extract_account(&r1, &vault_key)),
        (share_mint_key, extract_account(&r1, &share_mint_key)),
        (ub_share, create_token2022_token_account(&share_mint_key, &user_b, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ], &[Check::success()]);

    // ── User A: RequestWithdraw(5M) ─────────────────────────────
    let (pw_a, _) = pending_withdraw_pda(&vault_key, &user_a);
    let vault_share_ata = Pubkey::new_unique();
    let rw1 = build_instruction(
        request_withdraw_data(5_000_000),
        vec![
            AccountMeta::new(user_a, true),
            AccountMeta::new(ua_share, false),
            AccountMeta::new_readonly(share_mint_key, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pw_a, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
            AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
            AccountMeta::new(vault_share_ata, false),
        ],
    );
    let r3 = mollusk.process_and_validate_instruction(&rw1, &vec![
        (user_a, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (ua_share, extract_account(&r1, &ua_share)),
        (share_mint_key, extract_account(&r2, &share_mint_key)),
        (vault_key, extract_account(&r2, &vault_key)),
        (pw_a, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token2022::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(1000)),
        (vault_share_ata, create_token2022_token_account(&share_mint_key, &vault_key, 0)),
    ], &[Check::success()]);

    // ── User B: RequestWithdraw(3M) — different PDA ─────────────
    let (pw_b, _) = pending_withdraw_pda(&vault_key, &user_b);
    let rw2 = build_instruction(
        request_withdraw_data(3_000_000),
        vec![
            AccountMeta::new(user_b, true),
            AccountMeta::new(ub_share, false),
            AccountMeta::new_readonly(share_mint_key, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pw_b, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
            AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
            AccountMeta::new(vault_share_ata, false),
        ],
    );
    let r4 = mollusk.process_and_validate_instruction(&rw2, &vec![
        (user_b, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (ub_share, extract_account(&r2, &ub_share)),
        (share_mint_key, extract_account(&r3, &share_mint_key)),
        (vault_key, extract_account(&r3, &vault_key)),
        (pw_b, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token2022::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(1000)),
        (vault_share_ata, extract_account(&r3, &vault_share_ata)),
    ], &[Check::success()]);

    // Both pending PDAs exist simultaneously
    assert_eq!(extract_account(&r3, &pw_a).data[0], 0xA3);
    assert_eq!(extract_account(&r4, &pw_b).data[0], 0xA3);
    // Escrow holds 5M + 3M = 8M
    assert_eq!(read_u64(&extract_account(&r4, &vault_share_ata).data, 64), 8_000_000);

    // ── Fulfill user A ──────────────────────────────────────────
    let recv_a = Pubkey::new_unique();
    let fw1 = build_instruction(
        fulfill_withdraw_data(price),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(pw_a, false),
            AccountMeta::new(vault_base, false),
            AccountMeta::new(recv_a, false),
            AccountMeta::new(user_a, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new(vault_share_ata, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let r5 = mollusk.process_and_validate_instruction(&fw1, &vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, extract_account(&r4, &vault_key)),
        (pw_a, extract_account(&r3, &pw_a)),
        (vault_base, extract_account(&r2, &vault_base)),
        (recv_a, create_token_account(&base_mint, &user_a, 0)),
        (user_a, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token::keyed_account(),
        (vault_share_ata, extract_account(&r4, &vault_share_ata)),
        (share_mint_key, extract_account(&r4, &share_mint_key)),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ], &[Check::success()]);

    assert_eq!(read_u64(&extract_account(&r5, &recv_a).data, 64), 5_000_000);

    // ── Fulfill user B ──────────────────────────────────────────
    let recv_b = Pubkey::new_unique();
    let fw2 = build_instruction(
        fulfill_withdraw_data(price),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(pw_b, false),
            AccountMeta::new(vault_base, false),
            AccountMeta::new(recv_b, false),
            AccountMeta::new(user_b, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new(vault_share_ata, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let r6 = mollusk.process_and_validate_instruction(&fw2, &vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, extract_account(&r5, &vault_key)),
        (pw_b, extract_account(&r4, &pw_b)),
        (vault_base, extract_account(&r5, &vault_base)),
        (recv_b, create_token_account(&base_mint, &user_b, 0)),
        (user_b, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token::keyed_account(),
        (vault_share_ata, extract_account(&r5, &vault_share_ata)),
        (share_mint_key, extract_account(&r5, &share_mint_key)),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ], &[Check::success()]);

    assert_eq!(read_u64(&extract_account(&r6, &recv_b).data, 64), 3_000_000);
    assert_eq!(read_u64(&extract_account(&r6, &vault_base).data, 64), 0);
    assert_eq!(read_u64(&extract_account(&r6, &share_mint_key).data, 36), 0);
}

// ═══════════════════════════════════════════════════════════════════
// Group 4: Partial Withdrawals
// ═══════════════════════════════════════════════════════════════════

/// User deposits 10M, withdraws 3M, then withdraws remaining 7M (atomic).
#[test]
fn test_partial_withdraw_then_full_withdraw() {
    let mollusk = setup_with_both_tokens();

    let admin = Pubkey::new_unique();
    let user = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"part-wd");
    let share_mint_key = Pubkey::new_unique();
    let share_decimals: u8 = 6;
    let price: u64 = 1_000_000;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, price, &[], b"part-wd",
    );

    let user_base = Pubkey::new_unique();
    let vault_base = Pubkey::new_unique();
    let user_share = Pubkey::new_unique();

    // ── Deposit 10M ─────────────────────────────────────────────
    let d1 = build_instruction(
        deposit_with_price_data(price, 10_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_base, false),
            AccountMeta::new(vault_base, false),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(user_share, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let r1 = mollusk.process_and_validate_instruction(&d1, &vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_base, create_token_account(&base_mint, &user, 10_000_000)),
        (vault_base, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_token2022_mint(&vault_key, share_decimals, 0, b"T", b"T", b"")),
        (user_share, create_token2022_token_account(&share_mint_key, &user, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ], &[Check::success()]);

    // ── Withdraw 3M shares (atomic) ─────────────────────────────
    let recv1 = Pubkey::new_unique();
    let w1 = build_instruction(
        withdraw_with_price_data(price, 3_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_share, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(vault_base, false),
            AccountMeta::new(recv1, false),
            AccountMeta::new(vault_key, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let r2 = mollusk.process_and_validate_instruction(&w1, &vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_share, extract_account(&r1, &user_share)),
        (share_mint_key, extract_account(&r1, &share_mint_key)),
        (vault_base, extract_account(&r1, &vault_base)),
        (recv1, create_token_account(&base_mint, &user, 0)),
        (vault_key, extract_account(&r1, &vault_key)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ], &[Check::success()]);

    assert_eq!(read_u64(&extract_account(&r2, &user_share).data, 64), 7_000_000);
    assert_eq!(read_u64(&extract_account(&r2, &vault_base).data, 64), 7_000_000);

    // ── Withdraw remaining 7M shares ────────────────────────────
    let recv2 = Pubkey::new_unique();
    let w2 = build_instruction(
        withdraw_with_price_data(price, 7_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_share, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(vault_base, false),
            AccountMeta::new(recv2, false),
            AccountMeta::new(vault_key, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ],
    );
    let r3 = mollusk.process_and_validate_instruction(&w2, &vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (user_share, extract_account(&r2, &user_share)),
        (share_mint_key, extract_account(&r2, &share_mint_key)),
        (vault_base, extract_account(&r2, &vault_base)),
        (recv2, create_token_account(&base_mint, &user, 0)),
        (vault_key, extract_account(&r2, &vault_key)),
        mollusk_svm_programs_token::token::keyed_account(),
        mollusk_svm_programs_token::token2022::keyed_account(),
    ], &[Check::success()]);

    assert_eq!(read_u64(&extract_account(&r3, &user_share).data, 64), 0);
    assert_eq!(read_u64(&extract_account(&r3, &vault_base).data, 64), 0);
    assert_eq!(read_u64(&extract_account(&r3, &share_mint_key).data, 36), 0);
}

/// Two users make partial withdrawals — vault balance tracking is correct.
#[test]
fn test_two_users_partial_withdraw_balance_tracking() {
    let mollusk = setup_with_both_tokens();

    let admin = Pubkey::new_unique();
    let user_a = Pubkey::new_unique();
    let user_b = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"2u-part");
    let share_mint_key = Pubkey::new_unique();
    let share_decimals: u8 = 6;
    let price: u64 = 1_000_000;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, price, &[], b"2u-part",
    );

    let ua_base = Pubkey::new_unique();
    let ub_base = Pubkey::new_unique();
    let vault_base = Pubkey::new_unique();
    let ua_share = Pubkey::new_unique();
    let ub_share = Pubkey::new_unique();

    // User A: deposit 5M
    let r1 = mollusk.process_and_validate_instruction(
        &build_instruction(deposit_with_price_data(price, 5_000_000), vec![
            AccountMeta::new_readonly(admin, true), AccountMeta::new_readonly(user_a, true),
            AccountMeta::new(ua_base, false), AccountMeta::new(vault_base, false),
            AccountMeta::new(vault_key, false), AccountMeta::new(share_mint_key, false),
            AccountMeta::new(ua_share, false), AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ]),
        &vec![
            (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user_a, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (ua_base, create_token_account(&base_mint, &user_a, 5_000_000)),
            (vault_base, create_token_account(&base_mint, &vault_key, 0)),
            (vault_key, make_vault_account(vault_data)),
            (share_mint_key, create_token2022_mint(&vault_key, share_decimals, 0, b"T", b"T", b"")),
            (ua_share, create_token2022_token_account(&share_mint_key, &user_a, 0)),
            mollusk_svm_programs_token::token::keyed_account(),
            mollusk_svm_programs_token::token2022::keyed_account(),
        ],
        &[Check::success()],
    );

    // User B: deposit 3M
    let r2 = mollusk.process_and_validate_instruction(
        &build_instruction(deposit_with_price_data(price, 3_000_000), vec![
            AccountMeta::new_readonly(admin, true), AccountMeta::new_readonly(user_b, true),
            AccountMeta::new(ub_base, false), AccountMeta::new(vault_base, false),
            AccountMeta::new(vault_key, false), AccountMeta::new(share_mint_key, false),
            AccountMeta::new(ub_share, false), AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ]),
        &vec![
            (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user_b, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (ub_base, create_token_account(&base_mint, &user_b, 3_000_000)),
            (vault_base, extract_account(&r1, &vault_base)),
            (vault_key, extract_account(&r1, &vault_key)),
            (share_mint_key, extract_account(&r1, &share_mint_key)),
            (ub_share, create_token2022_token_account(&share_mint_key, &user_b, 0)),
            mollusk_svm_programs_token::token::keyed_account(),
            mollusk_svm_programs_token::token2022::keyed_account(),
        ],
        &[Check::success()],
    );
    // Vault = 8M base, supply = 8M shares
    assert_eq!(read_u64(&extract_account(&r2, &vault_base).data, 64), 8_000_000);

    // User A: partial withdraw 2M shares
    let recv_a = Pubkey::new_unique();
    let r3 = mollusk.process_and_validate_instruction(
        &build_instruction(withdraw_with_price_data(price, 2_000_000), vec![
            AccountMeta::new_readonly(admin, true), AccountMeta::new_readonly(user_a, true),
            AccountMeta::new(ua_share, false), AccountMeta::new(share_mint_key, false),
            AccountMeta::new(vault_base, false), AccountMeta::new(recv_a, false),
            AccountMeta::new(vault_key, false), AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ]),
        &vec![
            (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user_a, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (ua_share, extract_account(&r1, &ua_share)),
            (share_mint_key, extract_account(&r2, &share_mint_key)),
            (vault_base, extract_account(&r2, &vault_base)),
            (recv_a, create_token_account(&base_mint, &user_a, 0)),
            (vault_key, extract_account(&r2, &vault_key)),
            mollusk_svm_programs_token::token::keyed_account(),
            mollusk_svm_programs_token::token2022::keyed_account(),
        ],
        &[Check::success()],
    );
    assert_eq!(read_u64(&extract_account(&r3, &ua_share).data, 64), 3_000_000); // 5-2=3
    assert_eq!(read_u64(&extract_account(&r3, &vault_base).data, 64), 6_000_000); // 8-2=6

    // User B: partial withdraw 1M shares
    let recv_b = Pubkey::new_unique();
    let r4 = mollusk.process_and_validate_instruction(
        &build_instruction(withdraw_with_price_data(price, 1_000_000), vec![
            AccountMeta::new_readonly(admin, true), AccountMeta::new_readonly(user_b, true),
            AccountMeta::new(ub_share, false), AccountMeta::new(share_mint_key, false),
            AccountMeta::new(vault_base, false), AccountMeta::new(recv_b, false),
            AccountMeta::new(vault_key, false), AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ]),
        &vec![
            (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user_b, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (ub_share, extract_account(&r2, &ub_share)),
            (share_mint_key, extract_account(&r3, &share_mint_key)),
            (vault_base, extract_account(&r3, &vault_base)),
            (recv_b, create_token_account(&base_mint, &user_b, 0)),
            (vault_key, extract_account(&r3, &vault_key)),
            mollusk_svm_programs_token::token::keyed_account(),
            mollusk_svm_programs_token::token2022::keyed_account(),
        ],
        &[Check::success()],
    );

    assert_eq!(read_u64(&extract_account(&r4, &ub_share).data, 64), 2_000_000); // 3-1=2
    assert_eq!(read_u64(&extract_account(&r4, &vault_base).data, 64), 5_000_000); // 6-1=5
    assert_eq!(read_u64(&extract_account(&r4, &share_mint_key).data, 36), 5_000_000); // 8-2-1=5
}

// ═══════════════════════════════════════════════════════════════════
// Group 5: Price Changes Between Sequential Withdrawals
// ═══════════════════════════════════════════════════════════════════

/// First async withdraw at price 1M, second at price 2M.
#[test]
fn test_sequential_async_withdraws_different_prices() {
    let mollusk = setup_with_both_tokens();

    let admin = Pubkey::new_unique();
    let user = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"wd-prices");
    let share_mint_key = Pubkey::new_unique();
    let share_decimals: u8 = 6;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, 1_000_000, &[], b"wd-prices",
    );

    let user_base = Pubkey::new_unique();
    let vault_base = Pubkey::new_unique();
    let user_share = Pubkey::new_unique();

    // Deposit 10M at price 1M → 10M shares; vault needs 30M base (for 2x price later)
    let r1 = mollusk.process_and_validate_instruction(
        &build_instruction(deposit_with_price_data(1_000_000, 10_000_000), vec![
            AccountMeta::new_readonly(admin, true), AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_base, false), AccountMeta::new(vault_base, false),
            AccountMeta::new(vault_key, false), AccountMeta::new(share_mint_key, false),
            AccountMeta::new(user_share, false), AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ]),
        &vec![
            (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user_base, create_token_account(&base_mint, &user, 10_000_000)),
            (vault_base, create_token_account(&base_mint, &vault_key, 0)),
            (vault_key, make_vault_account(vault_data)),
            (share_mint_key, create_token2022_mint(&vault_key, share_decimals, 0, b"T", b"T", b"")),
            (user_share, create_token2022_token_account(&share_mint_key, &user, 0)),
            mollusk_svm_programs_token::token::keyed_account(),
            mollusk_svm_programs_token::token2022::keyed_account(),
        ],
        &[Check::success()],
    );

    // ── Async withdraw #1: 5M shares at price 1M → 5M base ─────
    let (pw_key, _) = pending_withdraw_pda(&vault_key, &user);
    let vault_share_ata = Pubkey::new_unique();
    let r2 = mollusk.process_and_validate_instruction(
        &build_instruction(request_withdraw_data(5_000_000), vec![
            AccountMeta::new(user, true), AccountMeta::new(user_share, false),
            AccountMeta::new_readonly(share_mint_key, false), AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pw_key, false), AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false), AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
            AccountMeta::new(vault_share_ata, false),
        ]),
        &vec![
            (user, Account::new(10_000_000_000, 0, &Pubkey::default())),
            (user_share, extract_account(&r1, &user_share)),
            (share_mint_key, extract_account(&r1, &share_mint_key)),
            (vault_key, extract_account(&r1, &vault_key)),
            (pw_key, Account::new(0, 0, &Pubkey::default())),
            keyed_account_for_system_program(),
            mollusk_svm_programs_token::token2022::keyed_account(),
            (CLOCK_SYSVAR_ID, create_clock_account(1000)),
            (vault_share_ata, create_token2022_token_account(&share_mint_key, &vault_key, 0)),
        ],
        &[Check::success()],
    );

    let recv1 = Pubkey::new_unique();
    let r3 = mollusk.process_and_validate_instruction(
        &build_instruction(fulfill_withdraw_data(1_000_000), vec![
            AccountMeta::new_readonly(admin, true), AccountMeta::new(vault_key, false),
            AccountMeta::new(pw_key, false), AccountMeta::new(vault_base, false),
            AccountMeta::new(recv1, false), AccountMeta::new(user, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false), AccountMeta::new(vault_share_ata, false),
            AccountMeta::new(share_mint_key, false), AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ]),
        &vec![
            (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (vault_key, extract_account(&r2, &vault_key)),
            (pw_key, extract_account(&r2, &pw_key)),
            (vault_base, extract_account(&r1, &vault_base)),
            (recv1, create_token_account(&base_mint, &user, 0)),
            (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
            mollusk_svm_programs_token::token::keyed_account(),
            (vault_share_ata, extract_account(&r2, &vault_share_ata)),
            (share_mint_key, extract_account(&r2, &share_mint_key)),
            mollusk_svm_programs_token::token2022::keyed_account(),
        ],
        &[Check::success()],
    );
    assert_eq!(read_u64(&extract_account(&r3, &recv1).data, 64), 5_000_000);

    // ── Async withdraw #2: 5M shares at price 2M → 10M base ────
    // Simulate vault gained value (set vault_base to 15M for the test)
    let mut vault_base_boosted = extract_account(&r3, &vault_base);
    vault_base_boosted.data[64..72].copy_from_slice(&15_000_000u64.to_le_bytes());

    let r4 = mollusk.process_and_validate_instruction(
        &build_instruction(request_withdraw_data(5_000_000), vec![
            AccountMeta::new(user, true), AccountMeta::new(user_share, false),
            AccountMeta::new_readonly(share_mint_key, false), AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pw_key, false), AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false), AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
            AccountMeta::new(vault_share_ata, false),
        ]),
        &vec![
            (user, Account::new(10_000_000_000, 0, &Pubkey::default())),
            (user_share, extract_account(&r2, &user_share)), // still has 5M
            (share_mint_key, extract_account(&r3, &share_mint_key)),
            (vault_key, extract_account(&r3, &vault_key)),
            (pw_key, Account::new(0, 0, &Pubkey::default())),
            keyed_account_for_system_program(),
            mollusk_svm_programs_token::token2022::keyed_account(),
            (CLOCK_SYSVAR_ID, create_clock_account(2000)),
            (vault_share_ata, create_token2022_token_account(&share_mint_key, &vault_key, 0)),
        ],
        &[Check::success()],
    );

    let recv2 = Pubkey::new_unique();
    let r5 = mollusk.process_and_validate_instruction(
        &build_instruction(fulfill_withdraw_data(2_000_000), vec![
            AccountMeta::new_readonly(admin, true), AccountMeta::new(vault_key, false),
            AccountMeta::new(pw_key, false), AccountMeta::new(vault_base, false),
            AccountMeta::new(recv2, false), AccountMeta::new(user, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false), AccountMeta::new(vault_share_ata, false),
            AccountMeta::new(share_mint_key, false), AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ]),
        &vec![
            (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (vault_key, extract_account(&r4, &vault_key)),
            (pw_key, extract_account(&r4, &pw_key)),
            (vault_base, vault_base_boosted),
            (recv2, create_token_account(&base_mint, &user, 0)),
            (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
            mollusk_svm_programs_token::token::keyed_account(),
            (vault_share_ata, extract_account(&r4, &vault_share_ata)),
            (share_mint_key, extract_account(&r4, &share_mint_key)),
            mollusk_svm_programs_token::token2022::keyed_account(),
        ],
        &[Check::success()],
    );

    // 5M shares * 2M price / 1M = 10M base
    assert_eq!(read_u64(&extract_account(&r5, &recv2).data, 64), 10_000_000);
    assert_eq!(read_u64(&extract_account(&r5, &vault_key).data, 208), 2_000_000);
}

// ═══════════════════════════════════════════════════════════════════
// Group 6: Withdraw Fees (Async Exit Fee)
// ═══════════════════════════════════════════════════════════════════

/// Async withdraw with exit fee — fee is snapshotted and applied correctly.
#[test]
fn test_async_withdraw_with_exit_fee() {
    let mollusk = setup_with_both_tokens();

    let admin = Pubkey::new_unique();
    let user = Pubkey::new_unique();
    let fee_receiver = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"wd-fee");
    let share_mint_key = Pubkey::new_unique();
    let share_decimals: u8 = 6;
    let price: u64 = 1_000_000;

    let mut vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, price, &[], b"wd-fee",
    );
    // 10% exit fee = 1000 BPS
    set_vault_fees(&mut vault_data, 0, 1000, 0, 0, &fee_receiver, price, 0);

    let user_base = Pubkey::new_unique();
    let vault_base = Pubkey::new_unique();
    let user_share = Pubkey::new_unique();

    // ── Deposit 10M ─────────────────────────────────────────────
    let r1 = mollusk.process_and_validate_instruction(
        &build_instruction(deposit_with_price_data(price, 10_000_000), vec![
            AccountMeta::new_readonly(admin, true), AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_base, false), AccountMeta::new(vault_base, false),
            AccountMeta::new(vault_key, false), AccountMeta::new(share_mint_key, false),
            AccountMeta::new(user_share, false), AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ]),
        &vec![
            (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user_base, create_token_account(&base_mint, &user, 10_000_000)),
            (vault_base, create_token_account(&base_mint, &vault_key, 0)),
            (vault_key, make_vault_account(vault_data)),
            (share_mint_key, create_token2022_mint(&vault_key, share_decimals, 0, b"T", b"T", b"")),
            (user_share, create_token2022_token_account(&share_mint_key, &user, 0)),
            mollusk_svm_programs_token::token::keyed_account(),
            mollusk_svm_programs_token::token2022::keyed_account(),
        ],
        &[Check::success()],
    );

    // ── RequestWithdraw(10M) — exit_fee_bps=1000 snapshotted ────
    let (pw_key, _) = pending_withdraw_pda(&vault_key, &user);
    let vault_share_ata = Pubkey::new_unique();
    let r2 = mollusk.process_and_validate_instruction(
        &build_instruction(request_withdraw_data(10_000_000), vec![
            AccountMeta::new(user, true), AccountMeta::new(user_share, false),
            AccountMeta::new_readonly(share_mint_key, false), AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pw_key, false), AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false), AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
            AccountMeta::new(vault_share_ata, false),
        ]),
        &vec![
            (user, Account::new(10_000_000_000, 0, &Pubkey::default())),
            (user_share, extract_account(&r1, &user_share)),
            (share_mint_key, extract_account(&r1, &share_mint_key)),
            (vault_key, extract_account(&r1, &vault_key)),
            (pw_key, Account::new(0, 0, &Pubkey::default())),
            keyed_account_for_system_program(),
            mollusk_svm_programs_token::token2022::keyed_account(),
            (CLOCK_SYSVAR_ID, create_clock_account(1000)),
            (vault_share_ata, create_token2022_token_account(&share_mint_key, &vault_key, 0)),
        ],
        &[Check::success()],
    );

    // Verify exit_fee_bps snapshot
    let pw = extract_account(&r2, &pw_key);
    assert_eq!(u16::from_le_bytes(pw.data[2..4].try_into().unwrap()), 1000);

    // ── FulfillWithdraw(price=1M) ───────────────────────────────
    // 10M shares * 1M / 1M = 10M base; 10% exit fee → 9M returned
    let recv = Pubkey::new_unique();
    let r3 = mollusk.process_and_validate_instruction(
        &build_instruction(fulfill_withdraw_data(price), vec![
            AccountMeta::new_readonly(admin, true), AccountMeta::new(vault_key, false),
            AccountMeta::new(pw_key, false), AccountMeta::new(vault_base, false),
            AccountMeta::new(recv, false), AccountMeta::new(user, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false), AccountMeta::new(vault_share_ata, false),
            AccountMeta::new(share_mint_key, false), AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ]),
        &vec![
            (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (vault_key, extract_account(&r2, &vault_key)),
            (pw_key, extract_account(&r2, &pw_key)),
            (vault_base, extract_account(&r1, &vault_base)),
            (recv, create_token_account(&base_mint, &user, 0)),
            (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
            mollusk_svm_programs_token::token::keyed_account(),
            (vault_share_ata, extract_account(&r2, &vault_share_ata)),
            (share_mint_key, extract_account(&r2, &share_mint_key)),
            mollusk_svm_programs_token::token2022::keyed_account(),
        ],
        &[Check::success()],
    );

    // User gets 9M (10M minus 10% exit fee)
    assert_eq!(read_u64(&extract_account(&r3, &recv).data, 64), 9_000_000);
    // Vault retains 1M (exit fee stays in vault)
    assert_eq!(read_u64(&extract_account(&r3, &vault_base).data, 64), 1_000_000);
}

// ═══════════════════════════════════════════════════════════════════
// Group 7: Withdraw + Pause
// ═══════════════════════════════════════════════════════════════════

/// Admin can fulfill a pending withdrawal even while vault is paused.
#[test]
fn test_pending_withdraw_fulfilled_while_paused() {
    let mollusk = setup_with_both_tokens();

    let admin = Pubkey::new_unique();
    let user = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"pw-pause");
    let share_mint_key = Pubkey::new_unique();
    let share_decimals: u8 = 6;
    let price: u64 = 1_000_000;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, price, &[], b"pw-pause",
    );
    let user_base = Pubkey::new_unique();
    let vault_base = Pubkey::new_unique();
    let user_share = Pubkey::new_unique();

    // ── Deposit 10M ─────────────────────────────────────────────
    let r1 = mollusk.process_and_validate_instruction(
        &build_instruction(deposit_with_price_data(price, 10_000_000), vec![
            AccountMeta::new_readonly(admin, true), AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_base, false), AccountMeta::new(vault_base, false),
            AccountMeta::new(vault_key, false), AccountMeta::new(share_mint_key, false),
            AccountMeta::new(user_share, false), AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ]),
        &vec![
            (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user_base, create_token_account(&base_mint, &user, 10_000_000)),
            (vault_base, create_token_account(&base_mint, &vault_key, 0)),
            (vault_key, make_vault_account(vault_data)),
            (share_mint_key, create_token2022_mint(&vault_key, share_decimals, 0, b"T", b"T", b"")),
            (user_share, create_token2022_token_account(&share_mint_key, &user, 0)),
            mollusk_svm_programs_token::token::keyed_account(),
            mollusk_svm_programs_token::token2022::keyed_account(),
        ],
        &[Check::success()],
    );

    // ── RequestWithdraw(10M) ────────────────────────────────────
    let (pw_key, _) = pending_withdraw_pda(&vault_key, &user);
    let vault_share_ata = Pubkey::new_unique();
    let r2 = mollusk.process_and_validate_instruction(
        &build_instruction(request_withdraw_data(10_000_000), vec![
            AccountMeta::new(user, true), AccountMeta::new(user_share, false),
            AccountMeta::new_readonly(share_mint_key, false), AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pw_key, false), AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false), AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
            AccountMeta::new(vault_share_ata, false),
        ]),
        &vec![
            (user, Account::new(10_000_000_000, 0, &Pubkey::default())),
            (user_share, extract_account(&r1, &user_share)),
            (share_mint_key, extract_account(&r1, &share_mint_key)),
            (vault_key, extract_account(&r1, &vault_key)),
            (pw_key, Account::new(0, 0, &Pubkey::default())),
            keyed_account_for_system_program(),
            mollusk_svm_programs_token::token2022::keyed_account(),
            (CLOCK_SYSVAR_ID, create_clock_account(1000)),
            (vault_share_ata, create_token2022_token_account(&share_mint_key, &vault_key, 0)),
        ],
        &[Check::success()],
    );

    // ── Pause vault ─────────────────────────────────────────────
    let r3 = mollusk.process_and_validate_instruction(
        &build_instruction(pause_vault_data(), vec![
            AccountMeta::new_readonly(admin, true), AccountMeta::new(vault_key, false),
        ]),
        &vec![
            (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (vault_key, extract_account(&r2, &vault_key)),
        ],
        &[Check::success()],
    );
    assert_eq!(extract_account(&r3, &vault_key).data[13], 1);

    // ── FulfillWithdraw while paused — admin op succeeds ────────
    let recv = Pubkey::new_unique();
    let r4 = mollusk.process_and_validate_instruction(
        &build_instruction(fulfill_withdraw_data(price), vec![
            AccountMeta::new_readonly(admin, true), AccountMeta::new(vault_key, false),
            AccountMeta::new(pw_key, false), AccountMeta::new(vault_base, false),
            AccountMeta::new(recv, false), AccountMeta::new(user, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false), AccountMeta::new(vault_share_ata, false),
            AccountMeta::new(share_mint_key, false), AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ]),
        &vec![
            (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (vault_key, extract_account(&r3, &vault_key)),
            (pw_key, extract_account(&r2, &pw_key)),
            (vault_base, extract_account(&r1, &vault_base)),
            (recv, create_token_account(&base_mint, &user, 0)),
            (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
            mollusk_svm_programs_token::token::keyed_account(),
            (vault_share_ata, extract_account(&r2, &vault_share_ata)),
            (share_mint_key, extract_account(&r2, &share_mint_key)),
            mollusk_svm_programs_token::token2022::keyed_account(),
        ],
        &[Check::success()],
    );

    assert_eq!(read_u64(&extract_account(&r4, &recv).data, 64), 10_000_000);
    assert_eq!(extract_account(&r4, &pw_key).lamports, 0);
    assert_eq!(extract_account(&r4, &vault_key).data[13], 1); // still paused
}

// ═══════════════════════════════════════════════════════════════════
// Group 8: Cancel Withdraw + Retry
// ═══════════════════════════════════════════════════════════════════

/// Cancel an expired pending withdraw, then create a new one and fulfill it.
#[test]
fn test_cancel_withdraw_then_rewithdraw() {
    let mollusk = setup_with_both_tokens();

    let admin = Pubkey::new_unique();
    let user = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"cw-retry");
    let share_mint_key = Pubkey::new_unique();
    let share_decimals: u8 = 6;
    let price: u64 = 1_000_000;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, price, &[], b"cw-retry",
    );
    let user_base = Pubkey::new_unique();
    let vault_base = Pubkey::new_unique();
    let user_share = Pubkey::new_unique();

    // ── Deposit 10M ─────────────────────────────────────────────
    let r1 = mollusk.process_and_validate_instruction(
        &build_instruction(deposit_with_price_data(price, 10_000_000), vec![
            AccountMeta::new_readonly(admin, true), AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_base, false), AccountMeta::new(vault_base, false),
            AccountMeta::new(vault_key, false), AccountMeta::new(share_mint_key, false),
            AccountMeta::new(user_share, false), AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ]),
        &vec![
            (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user_base, create_token_account(&base_mint, &user, 10_000_000)),
            (vault_base, create_token_account(&base_mint, &vault_key, 0)),
            (vault_key, make_vault_account(vault_data)),
            (share_mint_key, create_token2022_mint(&vault_key, share_decimals, 0, b"T", b"T", b"")),
            (user_share, create_token2022_token_account(&share_mint_key, &user, 0)),
            mollusk_svm_programs_token::token::keyed_account(),
            mollusk_svm_programs_token::token2022::keyed_account(),
        ],
        &[Check::success()],
    );

    // ── RequestWithdraw(5M) ─────────────────────────────────────
    let (pw_key, _) = pending_withdraw_pda(&vault_key, &user);
    let vault_share_ata = Pubkey::new_unique();
    let created_at: i64 = 1000;
    let r2 = mollusk.process_and_validate_instruction(
        &build_instruction(request_withdraw_data(5_000_000), vec![
            AccountMeta::new(user, true), AccountMeta::new(user_share, false),
            AccountMeta::new_readonly(share_mint_key, false), AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pw_key, false), AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false), AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
            AccountMeta::new(vault_share_ata, false),
        ]),
        &vec![
            (user, Account::new(10_000_000_000, 0, &Pubkey::default())),
            (user_share, extract_account(&r1, &user_share)),
            (share_mint_key, extract_account(&r1, &share_mint_key)),
            (vault_key, extract_account(&r1, &vault_key)),
            (pw_key, Account::new(0, 0, &Pubkey::default())),
            keyed_account_for_system_program(),
            mollusk_svm_programs_token::token2022::keyed_account(),
            (CLOCK_SYSVAR_ID, create_clock_account(created_at)),
            (vault_share_ata, create_token2022_token_account(&share_mint_key, &vault_key, 0)),
        ],
        &[Check::success()],
    );
    // 5M escrowed, user has 5M remaining
    assert_eq!(read_u64(&extract_account(&r2, &user_share).data, 64), 5_000_000);

    // ── CancelWithdraw (after 48h) — shares returned ────────────
    let cancel_time = created_at + 172_800 + 1;
    let r3 = mollusk.process_and_validate_instruction(
        &build_instruction(cancel_withdraw_data(), vec![
            AccountMeta::new(user, true), AccountMeta::new(pw_key, false),
            AccountMeta::new_readonly(vault_key, false), AccountMeta::new(vault_share_ata, false),
            AccountMeta::new(user_share, false), AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
            AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
        ]),
        &vec![
            (user, Account::new(10_000_000_000, 0, &Pubkey::default())),
            (pw_key, extract_account(&r2, &pw_key)),
            (vault_key, extract_account(&r2, &vault_key)),
            (vault_share_ata, extract_account(&r2, &vault_share_ata)),
            (user_share, extract_account(&r2, &user_share)),
            mollusk_svm_programs_token::token2022::keyed_account(),
            (CLOCK_SYSVAR_ID, create_clock_account(cancel_time)),
        ],
        &[Check::success()],
    );

    // PDA closed, shares returned to user
    assert_eq!(extract_account(&r3, &pw_key).lamports, 0);
    assert_eq!(read_u64(&extract_account(&r3, &user_share).data, 64), 10_000_000);
    assert_eq!(read_u64(&extract_account(&r3, &vault_share_ata).data, 64), 0);

    // ── RequestWithdraw(10M) — new request succeeds ─────────────
    let r4 = mollusk.process_and_validate_instruction(
        &build_instruction(request_withdraw_data(10_000_000), vec![
            AccountMeta::new(user, true), AccountMeta::new(user_share, false),
            AccountMeta::new_readonly(share_mint_key, false), AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pw_key, false), AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false), AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
            AccountMeta::new(vault_share_ata, false),
        ]),
        &vec![
            (user, Account::new(10_000_000_000, 0, &Pubkey::default())),
            (user_share, extract_account(&r3, &user_share)),
            (share_mint_key, extract_account(&r2, &share_mint_key)), // not in cancel result
            (vault_key, extract_account(&r3, &vault_key)),
            (pw_key, Account::new(0, 0, &Pubkey::default())),
            keyed_account_for_system_program(),
            mollusk_svm_programs_token::token2022::keyed_account(),
            (CLOCK_SYSVAR_ID, create_clock_account(cancel_time + 100)),
            (vault_share_ata, extract_account(&r3, &vault_share_ata)),
        ],
        &[Check::success()],
    );
    assert_eq!(read_u64(&extract_account(&r4, &pw_key).data, 72), 10_000_000);

    // ── FulfillWithdraw → 10M base returned ─────────────────────
    let recv = Pubkey::new_unique();
    let r5 = mollusk.process_and_validate_instruction(
        &build_instruction(fulfill_withdraw_data(price), vec![
            AccountMeta::new_readonly(admin, true), AccountMeta::new(vault_key, false),
            AccountMeta::new(pw_key, false), AccountMeta::new(vault_base, false),
            AccountMeta::new(recv, false), AccountMeta::new(user, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false), AccountMeta::new(vault_share_ata, false),
            AccountMeta::new(share_mint_key, false), AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ]),
        &vec![
            (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (vault_key, extract_account(&r4, &vault_key)),
            (pw_key, extract_account(&r4, &pw_key)),
            (vault_base, extract_account(&r1, &vault_base)),
            (recv, create_token_account(&base_mint, &user, 0)),
            (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
            mollusk_svm_programs_token::token::keyed_account(),
            (vault_share_ata, extract_account(&r4, &vault_share_ata)),
            (share_mint_key, extract_account(&r4, &share_mint_key)),
            mollusk_svm_programs_token::token2022::keyed_account(),
        ],
        &[Check::success()],
    );

    assert_eq!(read_u64(&extract_account(&r5, &recv).data, 64), 10_000_000);
    assert_eq!(read_u64(&extract_account(&r5, &vault_base).data, 64), 0);
}

// ═══════════════════════════════════════════════════════════════════
// Group 9: Withdraw All → Redeposit (Empty Vault Cycle)
// ═══════════════════════════════════════════════════════════════════

/// Withdraw all → supply drops to 0 → deposit again into empty vault.
#[test]
fn test_withdraw_all_then_redeposit() {
    let mollusk = setup_with_both_tokens();

    let admin = Pubkey::new_unique();
    let user = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"wd-redep");
    let share_mint_key = Pubkey::new_unique();
    let share_decimals: u8 = 6;
    let price: u64 = 1_000_000;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, price, &[], b"wd-redep",
    );
    let user_base = Pubkey::new_unique();
    let vault_base = Pubkey::new_unique();
    let user_share = Pubkey::new_unique();

    // ── Deposit 10M ─────────────────────────────────────────────
    let r1 = mollusk.process_and_validate_instruction(
        &build_instruction(deposit_with_price_data(price, 10_000_000), vec![
            AccountMeta::new_readonly(admin, true), AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_base, false), AccountMeta::new(vault_base, false),
            AccountMeta::new(vault_key, false), AccountMeta::new(share_mint_key, false),
            AccountMeta::new(user_share, false), AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ]),
        &vec![
            (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user_base, create_token_account(&base_mint, &user, 10_000_000)),
            (vault_base, create_token_account(&base_mint, &vault_key, 0)),
            (vault_key, make_vault_account(vault_data)),
            (share_mint_key, create_token2022_mint(&vault_key, share_decimals, 0, b"T", b"T", b"")),
            (user_share, create_token2022_token_account(&share_mint_key, &user, 0)),
            mollusk_svm_programs_token::token::keyed_account(),
            mollusk_svm_programs_token::token2022::keyed_account(),
        ],
        &[Check::success()],
    );

    // ── Withdraw all 10M ────────────────────────────────────────
    let recv = Pubkey::new_unique();
    let r2 = mollusk.process_and_validate_instruction(
        &build_instruction(withdraw_with_price_data(price, 10_000_000), vec![
            AccountMeta::new_readonly(admin, true), AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_share, false), AccountMeta::new(share_mint_key, false),
            AccountMeta::new(vault_base, false), AccountMeta::new(recv, false),
            AccountMeta::new(vault_key, false), AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ]),
        &vec![
            (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user_share, extract_account(&r1, &user_share)),
            (share_mint_key, extract_account(&r1, &share_mint_key)),
            (vault_base, extract_account(&r1, &vault_base)),
            (recv, create_token_account(&base_mint, &user, 0)),
            (vault_key, extract_account(&r1, &vault_key)),
            mollusk_svm_programs_token::token::keyed_account(),
            mollusk_svm_programs_token::token2022::keyed_account(),
        ],
        &[Check::success()],
    );

    // Empty vault
    assert_eq!(read_u64(&extract_account(&r2, &share_mint_key).data, 36), 0);
    assert_eq!(read_u64(&extract_account(&r2, &vault_base).data, 64), 0);

    // ── Redeposit 5M into empty vault ───────────────────────────
    let user_base2 = Pubkey::new_unique();
    let r3 = mollusk.process_and_validate_instruction(
        &build_instruction(deposit_with_price_data(price, 5_000_000), vec![
            AccountMeta::new_readonly(admin, true), AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_base2, false), AccountMeta::new(vault_base, false),
            AccountMeta::new(vault_key, false), AccountMeta::new(share_mint_key, false),
            AccountMeta::new(user_share, false), AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ]),
        &vec![
            (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user_base2, create_token_account(&base_mint, &user, 5_000_000)),
            (vault_base, extract_account(&r2, &vault_base)),
            (vault_key, extract_account(&r2, &vault_key)),
            (share_mint_key, extract_account(&r2, &share_mint_key)),
            (user_share, extract_account(&r2, &user_share)),
            mollusk_svm_programs_token::token::keyed_account(),
            mollusk_svm_programs_token::token2022::keyed_account(),
        ],
        &[Check::success()],
    );

    // Fresh deposit works on empty vault
    assert_eq!(read_u64(&extract_account(&r3, &user_share).data, 64), 5_000_000);
    assert_eq!(read_u64(&extract_account(&r3, &vault_base).data, 64), 5_000_000);
    assert_eq!(read_u64(&extract_account(&r3, &share_mint_key).data, 36), 5_000_000);
}

// ═══════════════════════════════════════════════════════════════════
// Group 10: Withdraw Depletes Vault — Second Fails
// ═══════════════════════════════════════════════════════════════════

/// First user withdraws all base, second user's withdraw fails with InsufficientFunds.
#[test]
fn test_withdraw_depletes_vault_second_fails() {
    let mollusk = setup_with_both_tokens();

    let admin = Pubkey::new_unique();
    let user_a = Pubkey::new_unique();
    let user_b = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"deplete");
    let share_mint_key = Pubkey::new_unique();
    let share_decimals: u8 = 6;
    let price: u64 = 1_000_000;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, price, &[], b"deplete",
    );

    let ua_base = Pubkey::new_unique();
    let ub_base = Pubkey::new_unique();
    let vault_base = Pubkey::new_unique();
    let ua_share = Pubkey::new_unique();
    let ub_share = Pubkey::new_unique();

    // User A deposits 5M
    let r1 = mollusk.process_and_validate_instruction(
        &build_instruction(deposit_with_price_data(price, 5_000_000), vec![
            AccountMeta::new_readonly(admin, true), AccountMeta::new_readonly(user_a, true),
            AccountMeta::new(ua_base, false), AccountMeta::new(vault_base, false),
            AccountMeta::new(vault_key, false), AccountMeta::new(share_mint_key, false),
            AccountMeta::new(ua_share, false), AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ]),
        &vec![
            (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user_a, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (ua_base, create_token_account(&base_mint, &user_a, 5_000_000)),
            (vault_base, create_token_account(&base_mint, &vault_key, 0)),
            (vault_key, make_vault_account(vault_data)),
            (share_mint_key, create_token2022_mint(&vault_key, share_decimals, 0, b"T", b"T", b"")),
            (ua_share, create_token2022_token_account(&share_mint_key, &user_a, 0)),
            mollusk_svm_programs_token::token::keyed_account(),
            mollusk_svm_programs_token::token2022::keyed_account(),
        ],
        &[Check::success()],
    );

    // User B deposits 3M
    let r2 = mollusk.process_and_validate_instruction(
        &build_instruction(deposit_with_price_data(price, 3_000_000), vec![
            AccountMeta::new_readonly(admin, true), AccountMeta::new_readonly(user_b, true),
            AccountMeta::new(ub_base, false), AccountMeta::new(vault_base, false),
            AccountMeta::new(vault_key, false), AccountMeta::new(share_mint_key, false),
            AccountMeta::new(ub_share, false), AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ]),
        &vec![
            (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user_b, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (ub_base, create_token_account(&base_mint, &user_b, 3_000_000)),
            (vault_base, extract_account(&r1, &vault_base)),
            (vault_key, extract_account(&r1, &vault_key)),
            (share_mint_key, extract_account(&r1, &share_mint_key)),
            (ub_share, create_token2022_token_account(&share_mint_key, &user_b, 0)),
            mollusk_svm_programs_token::token::keyed_account(),
            mollusk_svm_programs_token::token2022::keyed_account(),
        ],
        &[Check::success()],
    );
    // Vault = 8M base

    // User A withdraws all 5M at price 2M → needs 10M base (but vault only has 8M)
    // This should fail with InsufficientFunds
    let recv_a = Pubkey::new_unique();
    mollusk.process_and_validate_instruction(
        &build_instruction(withdraw_with_price_data(2_000_000, 5_000_000), vec![
            AccountMeta::new_readonly(admin, true), AccountMeta::new_readonly(user_a, true),
            AccountMeta::new(ua_share, false), AccountMeta::new(share_mint_key, false),
            AccountMeta::new(vault_base, false), AccountMeta::new(recv_a, false),
            AccountMeta::new(vault_key, false), AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ]),
        &vec![
            (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user_a, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (ua_share, extract_account(&r1, &ua_share)),
            (share_mint_key, extract_account(&r2, &share_mint_key)),
            (vault_base, extract_account(&r2, &vault_base)),
            (recv_a, create_token_account(&base_mint, &user_a, 0)),
            (vault_key, extract_account(&r2, &vault_key)),
            mollusk_svm_programs_token::token::keyed_account(),
            mollusk_svm_programs_token::token2022::keyed_account(),
        ],
        &[Check::err(ProgramError::Custom(0x107))], // InsufficientFunds
    );

    // User A withdraws at original price (5M shares * 1M / 1M = 5M base) — succeeds
    let recv_a2 = Pubkey::new_unique();
    let r3 = mollusk.process_and_validate_instruction(
        &build_instruction(withdraw_with_price_data(price, 5_000_000), vec![
            AccountMeta::new_readonly(admin, true), AccountMeta::new_readonly(user_a, true),
            AccountMeta::new(ua_share, false), AccountMeta::new(share_mint_key, false),
            AccountMeta::new(vault_base, false), AccountMeta::new(recv_a2, false),
            AccountMeta::new(vault_key, false), AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ]),
        &vec![
            (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user_a, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (ua_share, extract_account(&r1, &ua_share)),
            (share_mint_key, extract_account(&r2, &share_mint_key)),
            (vault_base, extract_account(&r2, &vault_base)),
            (recv_a2, create_token_account(&base_mint, &user_a, 0)),
            (vault_key, extract_account(&r2, &vault_key)),
            mollusk_svm_programs_token::token::keyed_account(),
            mollusk_svm_programs_token::token2022::keyed_account(),
        ],
        &[Check::success()],
    );

    // Vault has 3M remaining (User B's deposit)
    assert_eq!(read_u64(&extract_account(&r3, &vault_base).data, 64), 3_000_000);

    // User B tries to withdraw at 2M price (3M shares * 2M / 1M = 6M, but only 3M available)
    let recv_b = Pubkey::new_unique();
    mollusk.process_and_validate_instruction(
        &build_instruction(withdraw_with_price_data(2_000_000, 3_000_000), vec![
            AccountMeta::new_readonly(admin, true), AccountMeta::new_readonly(user_b, true),
            AccountMeta::new(ub_share, false), AccountMeta::new(share_mint_key, false),
            AccountMeta::new(vault_base, false), AccountMeta::new(recv_b, false),
            AccountMeta::new(vault_key, false), AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ]),
        &vec![
            (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user_b, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (ub_share, extract_account(&r2, &ub_share)),
            (share_mint_key, extract_account(&r3, &share_mint_key)),
            (vault_base, extract_account(&r3, &vault_base)),
            (recv_b, create_token_account(&base_mint, &user_b, 0)),
            (vault_key, extract_account(&r3, &vault_key)),
            mollusk_svm_programs_token::token::keyed_account(),
            mollusk_svm_programs_token::token2022::keyed_account(),
        ],
        &[Check::err(ProgramError::Custom(0x107))], // InsufficientFunds
    );
}

// ═══════════════════════════════════════════════════════════════════
// Group 11: Mixed Deposit → Partial Withdraw → Deposit → Full Withdraw
// ═══════════════════════════════════════════════════════════════════

/// Deposit(10M) → Withdraw(3M) → Deposit(5M) → Withdraw(all 12M).
#[test]
fn test_deposit_partial_withdraw_deposit_full_withdraw() {
    let mollusk = setup_with_both_tokens();

    let admin = Pubkey::new_unique();
    let user = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"mix-flow");
    let share_mint_key = Pubkey::new_unique();
    let share_decimals: u8 = 6;
    let price: u64 = 1_000_000;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, price, &[], b"mix-flow",
    );
    let user_base = Pubkey::new_unique();
    let vault_base = Pubkey::new_unique();
    let user_share = Pubkey::new_unique();

    // ── Deposit 10M → 10M shares ────────────────────────────────
    let r1 = mollusk.process_and_validate_instruction(
        &build_instruction(deposit_with_price_data(price, 10_000_000), vec![
            AccountMeta::new_readonly(admin, true), AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_base, false), AccountMeta::new(vault_base, false),
            AccountMeta::new(vault_key, false), AccountMeta::new(share_mint_key, false),
            AccountMeta::new(user_share, false), AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ]),
        &vec![
            (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user_base, create_token_account(&base_mint, &user, 10_000_000)),
            (vault_base, create_token_account(&base_mint, &vault_key, 0)),
            (vault_key, make_vault_account(vault_data)),
            (share_mint_key, create_token2022_mint(&vault_key, share_decimals, 0, b"T", b"T", b"")),
            (user_share, create_token2022_token_account(&share_mint_key, &user, 0)),
            mollusk_svm_programs_token::token::keyed_account(),
            mollusk_svm_programs_token::token2022::keyed_account(),
        ],
        &[Check::success()],
    );

    // ── Withdraw 3M shares → 3M base ───────────────────────────
    let recv1 = Pubkey::new_unique();
    let r2 = mollusk.process_and_validate_instruction(
        &build_instruction(withdraw_with_price_data(price, 3_000_000), vec![
            AccountMeta::new_readonly(admin, true), AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_share, false), AccountMeta::new(share_mint_key, false),
            AccountMeta::new(vault_base, false), AccountMeta::new(recv1, false),
            AccountMeta::new(vault_key, false), AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ]),
        &vec![
            (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user_share, extract_account(&r1, &user_share)),
            (share_mint_key, extract_account(&r1, &share_mint_key)),
            (vault_base, extract_account(&r1, &vault_base)),
            (recv1, create_token_account(&base_mint, &user, 0)),
            (vault_key, extract_account(&r1, &vault_key)),
            mollusk_svm_programs_token::token::keyed_account(),
            mollusk_svm_programs_token::token2022::keyed_account(),
        ],
        &[Check::success()],
    );
    assert_eq!(read_u64(&extract_account(&r2, &user_share).data, 64), 7_000_000);
    assert_eq!(read_u64(&extract_account(&r2, &vault_base).data, 64), 7_000_000);

    // ── Deposit 5M more → 5M more shares (total 12M) ───────────
    let user_base2 = Pubkey::new_unique();
    let r3 = mollusk.process_and_validate_instruction(
        &build_instruction(deposit_with_price_data(price, 5_000_000), vec![
            AccountMeta::new_readonly(admin, true), AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_base2, false), AccountMeta::new(vault_base, false),
            AccountMeta::new(vault_key, false), AccountMeta::new(share_mint_key, false),
            AccountMeta::new(user_share, false), AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ]),
        &vec![
            (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user_base2, create_token_account(&base_mint, &user, 5_000_000)),
            (vault_base, extract_account(&r2, &vault_base)),
            (vault_key, extract_account(&r2, &vault_key)),
            (share_mint_key, extract_account(&r2, &share_mint_key)),
            (user_share, extract_account(&r2, &user_share)),
            mollusk_svm_programs_token::token::keyed_account(),
            mollusk_svm_programs_token::token2022::keyed_account(),
        ],
        &[Check::success()],
    );
    assert_eq!(read_u64(&extract_account(&r3, &user_share).data, 64), 12_000_000);
    assert_eq!(read_u64(&extract_account(&r3, &vault_base).data, 64), 12_000_000);

    // ── Withdraw all 12M ────────────────────────────────────────
    let recv2 = Pubkey::new_unique();
    let r4 = mollusk.process_and_validate_instruction(
        &build_instruction(withdraw_with_price_data(price, 12_000_000), vec![
            AccountMeta::new_readonly(admin, true), AccountMeta::new_readonly(user, true),
            AccountMeta::new(user_share, false), AccountMeta::new(share_mint_key, false),
            AccountMeta::new(vault_base, false), AccountMeta::new(recv2, false),
            AccountMeta::new(vault_key, false), AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
        ]),
        &vec![
            (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (user_share, extract_account(&r3, &user_share)),
            (share_mint_key, extract_account(&r3, &share_mint_key)),
            (vault_base, extract_account(&r3, &vault_base)),
            (recv2, create_token_account(&base_mint, &user, 0)),
            (vault_key, extract_account(&r3, &vault_key)),
            mollusk_svm_programs_token::token::keyed_account(),
            mollusk_svm_programs_token::token2022::keyed_account(),
        ],
        &[Check::success()],
    );

    assert_eq!(read_u64(&extract_account(&r4, &user_share).data, 64), 0);
    assert_eq!(read_u64(&extract_account(&r4, &vault_base).data, 64), 0);
    assert_eq!(read_u64(&extract_account(&r4, &share_mint_key).data, 36), 0);
    assert_eq!(read_u64(&extract_account(&r4, &recv2).data, 64), 12_000_000);
}
