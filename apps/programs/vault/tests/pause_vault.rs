mod helpers;

use helpers::*;
use mollusk_svm::program::keyed_account_for_system_program;
use mollusk_svm::result::Check;
use solana_account::Account;
use solana_instruction::AccountMeta;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;

// ── PauseVault (0x16) ────────────────────────────────────────────────

#[test]
fn test_pause_vault_by_admin_success() {
    let mollusk = setup();

    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"pause-test");

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[], b"pause-test",
    );

    let instruction = build_instruction(
        pause_vault_data(),
        vec![
            AccountMeta::new_readonly(admin, true),     // authority (signer)
            AccountMeta::new(vault_key, false),          // vault_state (writable)
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

    // Verify is_paused was set to 1 (offset 13)
    let vault_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_key).unwrap().1.clone();
    assert_eq!(vault_account.data[13], 1);
}

#[test]
fn test_pause_vault_by_factory_owner_success() {
    let mollusk = setup();

    let vault_admin = Pubkey::new_unique();
    let factory_owner = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"pause-factory");
    let (factory_key, factory_bump) = factory_pda();

    let vault_data = create_vault_state_data(
        &vault_admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[], b"pause-factory",
    );
    let factory_data = create_factory_state_data(&factory_owner, factory_bump, &[]);

    let instruction = build_instruction(
        pause_vault_data(),
        vec![
            AccountMeta::new_readonly(factory_owner, true),  // authority (factory owner, signer)
            AccountMeta::new(vault_key, false),               // vault_state (writable)
            AccountMeta::new_readonly(factory_key, false),    // factory_state (optional, read-only)
        ],
    );

    let accounts = vec![
        (factory_owner, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (factory_key, make_factory_account(factory_data)),
    ];

    let result = mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );

    // Verify is_paused was set to 1
    let vault_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_key).unwrap().1.clone();
    assert_eq!(vault_account.data[13], 1);
}

#[test]
fn test_pause_vault_unauthorized_random_signer() {
    let mollusk = setup();

    let admin = Pubkey::new_unique();
    let random = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"pause-unauth");

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[], b"pause-unauth",
    );

    // Random signer without factory_state → Unauthorized
    let instruction = build_instruction(
        pause_vault_data(),
        vec![
            AccountMeta::new_readonly(random, true),
            AccountMeta::new(vault_key, false),
        ],
    );

    let accounts = vec![
        (random, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x100))], // Unauthorized
    );
}

#[test]
fn test_pause_vault_unauthorized_with_factory_not_owner() {
    let mollusk = setup();

    let vault_admin = Pubkey::new_unique();
    let factory_owner = Pubkey::new_unique();
    let random = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"pause-fo");
    let (factory_key, factory_bump) = factory_pda();

    let vault_data = create_vault_state_data(
        &vault_admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[], b"pause-fo",
    );
    let factory_data = create_factory_state_data(&factory_owner, factory_bump, &[]);

    // Random signer with factory_state but is neither vault admin nor factory owner
    let instruction = build_instruction(
        pause_vault_data(),
        vec![
            AccountMeta::new_readonly(random, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new_readonly(factory_key, false),
        ],
    );

    let accounts = vec![
        (random, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (factory_key, make_factory_account(factory_data)),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x100))], // Unauthorized
    );
}

#[test]
fn test_pause_vault_missing_signer() {
    let mollusk = setup();

    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"pause-nosig");

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[], b"pause-nosig",
    );

    let instruction = build_instruction(
        pause_vault_data(),
        vec![
            AccountMeta::new_readonly(admin, false),  // NOT signer
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
fn test_pause_vault_not_enough_accounts() {
    let mollusk = setup();

    let admin = Pubkey::new_unique();

    let instruction = build_instruction(
        pause_vault_data(),
        vec![
            AccountMeta::new_readonly(admin, true),  // only 1 account
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::NotEnoughAccountKeys)],
    );
}

#[test]
fn test_pause_vault_idempotent() {
    let mollusk = setup();

    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"pause-idem");

    let mut vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[], b"pause-idem",
    );
    // Already paused
    set_vault_paused(&mut vault_data, true);

    let instruction = build_instruction(
        pause_vault_data(),
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

    // Still paused
    let vault_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_key).unwrap().1.clone();
    assert_eq!(vault_account.data[13], 1);
}

// ── UnpauseVault (0x17) ──────────────────────────────────────────────

#[test]
fn test_unpause_vault_by_admin_success() {
    let mollusk = setup();

    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"unpause-test");

    let mut vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[], b"unpause-test",
    );
    set_vault_paused(&mut vault_data, true);

    let instruction = build_instruction(
        unpause_vault_data(),
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

    // Verify is_paused was cleared to 0
    let vault_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_key).unwrap().1.clone();
    assert_eq!(vault_account.data[13], 0);
}

#[test]
fn test_unpause_vault_by_factory_owner_success() {
    let mollusk = setup();

    let vault_admin = Pubkey::new_unique();
    let factory_owner = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"unp-factory");
    let (factory_key, factory_bump) = factory_pda();

    let mut vault_data = create_vault_state_data(
        &vault_admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[], b"unp-factory",
    );
    set_vault_paused(&mut vault_data, true);
    let factory_data = create_factory_state_data(&factory_owner, factory_bump, &[]);

    let instruction = build_instruction(
        unpause_vault_data(),
        vec![
            AccountMeta::new_readonly(factory_owner, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new_readonly(factory_key, false),
        ],
    );

    let accounts = vec![
        (factory_owner, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (factory_key, make_factory_account(factory_data)),
    ];

    let result = mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );

    let vault_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_key).unwrap().1.clone();
    assert_eq!(vault_account.data[13], 0);
}

#[test]
fn test_unpause_vault_unauthorized() {
    let mollusk = setup();

    let admin = Pubkey::new_unique();
    let random = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"unp-unauth");

    let mut vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[], b"unp-unauth",
    );
    set_vault_paused(&mut vault_data, true);

    let instruction = build_instruction(
        unpause_vault_data(),
        vec![
            AccountMeta::new_readonly(random, true),
            AccountMeta::new(vault_key, false),
        ],
    );

    let accounts = vec![
        (random, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x100))], // Unauthorized
    );
}

#[test]
fn test_unpause_vault_idempotent() {
    let mollusk = setup();

    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"unp-idem");

    // Already unpaused (default)
    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[], b"unp-idem",
    );

    let instruction = build_instruction(
        unpause_vault_data(),
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

    let vault_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_key).unwrap().1.clone();
    assert_eq!(vault_account.data[13], 0);
}

// ── Pause Blocks User Operations ─────────────────────────────────────

/// Create a packed SPL Token account (legacy token program).
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
fn test_paused_vault_blocks_request_deposit() {
    let mollusk = setup_with_token();

    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"paused-dep");
    let share_mint_key = Pubkey::new_unique();

    let mut vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[], b"paused-dep",
    );
    set_vault_paused(&mut vault_data, true);

    let (pending_key, _) = pending_deposit_pda(&vault_key, &depositor);
    let depositor_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();

    let instruction = build_instruction(
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

    let accounts = vec![
        (depositor, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, create_token_account(&base_mint, &depositor, 5_000_000)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (pending_key, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(1000)),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x110))], // VaultPaused
    );
}

#[test]
fn test_paused_vault_blocks_request_withdraw() {
    let mollusk = setup_with_token2022();

    let admin = Pubkey::new_unique();
    let withdrawer = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"paused-wd");
    let share_mint_key = Pubkey::new_unique();

    let mut vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[], b"paused-wd",
    );
    set_vault_paused(&mut vault_data, true);

    let (pending_key, _) = pending_withdraw_pda(&vault_key, &withdrawer);
    let withdrawer_share_ata = Pubkey::new_unique();
    let vault_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        request_withdraw_data(3_000_000),
        vec![
            AccountMeta::new(withdrawer, true),
            AccountMeta::new(withdrawer_share_ata, false),
            AccountMeta::new_readonly(share_mint_key, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pending_key, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_2022_PROGRAM_ID, false),
            AccountMeta::new_readonly(CLOCK_SYSVAR_ID, false),
            AccountMeta::new(vault_share_ata, false),
        ],
    );

    let accounts = vec![
        (withdrawer, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (withdrawer_share_ata, create_token2022_token_account(&share_mint_key, &withdrawer, 3_000_000)),
        (share_mint_key, create_token2022_mint(&vault_key, 6, 3_000_000, b"Share", b"SHR", b"")),
        (vault_key, make_vault_account(vault_data)),
        (pending_key, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token2022::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(1000)),
        (vault_share_ata, create_token2022_token_account(&share_mint_key, &vault_key, 0)),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x110))], // VaultPaused
    );
}

#[test]
fn test_paused_vault_allows_set_share_price() {
    let mollusk = setup();

    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"paused-sp");

    let mut vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[], b"paused-sp",
    );
    set_vault_paused(&mut vault_data, true);

    let new_price: u64 = 2_000_000;

    let instruction = build_instruction(
        set_share_price_data(new_price),
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

    // Admin operations work even when paused
    let vault_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_key).unwrap().1.clone();
    let price = u64::from_le_bytes(vault_account.data[208..216].try_into().unwrap());
    assert_eq!(price, new_price);
    assert_eq!(vault_account.data[13], 1); // still paused
}

#[test]
fn test_paused_vault_allows_add_operator() {
    let mollusk = setup();

    let admin = Pubkey::new_unique();
    let operator = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"paused-op");

    let mut vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[], b"paused-op",
    );
    set_vault_paused(&mut vault_data, true);

    let instruction = build_instruction(
        add_operator_data(&operator),
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

    // Operator added while paused
    let vault_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_key).unwrap().1.clone();
    assert_eq!(vault_account.data[3], 1); // num_operators = 1
    assert_eq!(vault_account.data[13], 1); // still paused
}

// ── Unpause Restores User Operations ─────────────────────────────────

#[test]
fn test_unpause_then_request_deposit_succeeds() {
    let mollusk = setup_with_token();

    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"unp-dep");
    let share_mint_key = Pubkey::new_unique();
    let deposit_amount: u64 = 5_000_000;

    // Start paused, then unpause
    let mut vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[], b"unp-dep",
    );
    set_vault_paused(&mut vault_data, true);

    // Step 1: Unpause
    let unpause_ix = build_instruction(
        unpause_vault_data(),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
        ],
    );

    let unpause_accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
    ];

    let result = mollusk.process_and_validate_instruction(
        &unpause_ix,
        &unpause_accounts,
        &[Check::success()],
    );

    // Get the updated vault state after unpause
    let updated_vault = result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_key).unwrap().1.clone();
    assert_eq!(updated_vault.data[13], 0); // unpaused

    // Step 2: Deposit should succeed on the unpaused vault
    let (pending_key, _) = pending_deposit_pda(&vault_key, &depositor);
    let depositor_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();

    let deposit_ix = build_instruction(
        request_deposit_data(deposit_amount),
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

    let deposit_accounts = vec![
        (depositor, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, create_token_account(&base_mint, &depositor, deposit_amount)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, updated_vault),
        (pending_key, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token::keyed_account(),
        (CLOCK_SYSVAR_ID, create_clock_account(1000)),
    ];

    mollusk.process_and_validate_instruction(
        &deposit_ix,
        &deposit_accounts,
        &[Check::success()],
    );
}

// ── Invalid Factory Account ──────────────────────────────────────────

#[test]
fn test_pause_vault_invalid_factory_discriminator() {
    let mollusk = setup();

    let vault_admin = Pubkey::new_unique();
    let random = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"bad-factory");

    let vault_data = create_vault_state_data(
        &vault_admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[], b"bad-factory",
    );

    // Pass a fake factory account with wrong data
    let fake_factory_key = Pubkey::new_unique();
    let fake_factory_data = vec![0u8; 400]; // wrong discriminator (0x00 instead of 0xA4)
    let fake_factory_account = Account {
        lamports: 1_000_000_000,
        data: fake_factory_data,
        owner: program_id(),
        executable: false,
        rent_epoch: 0,
    };

    let instruction = build_instruction(
        pause_vault_data(),
        vec![
            AccountMeta::new_readonly(random, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new_readonly(fake_factory_key, false),
        ],
    );

    let accounts = vec![
        (random, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (fake_factory_key, fake_factory_account),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x105))], // InvalidDiscriminator
    );
}

#[test]
fn test_pause_vault_factory_wrong_owner() {
    let mollusk = setup();

    let vault_admin = Pubkey::new_unique();
    let random = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let share_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"wrong-own");

    let vault_data = create_vault_state_data(
        &vault_admin, &base_mint, &share_mint, bump, 6, 1_000_000, &[], b"wrong-own",
    );

    // Factory account owned by wrong program
    let fake_factory_key = Pubkey::new_unique();
    let fake_factory_account = Account {
        lamports: 1_000_000_000,
        data: vec![0u8; 400],
        owner: Pubkey::new_unique(), // wrong owner
        executable: false,
        rent_epoch: 0,
    };

    let instruction = build_instruction(
        pause_vault_data(),
        vec![
            AccountMeta::new_readonly(random, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new_readonly(fake_factory_key, false),
        ],
    );

    let accounts = vec![
        (random, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (fake_factory_key, fake_factory_account),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x112))], // InvalidFactory
    );
}
