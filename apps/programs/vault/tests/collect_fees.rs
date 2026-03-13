mod helpers;

use helpers::*;
use mollusk_svm::result::Check;
use solana_account::Account;
use solana_instruction::AccountMeta;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;

/// Create a packed SPL Mint account with a given supply.
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

#[test]
fn test_collect_fees_first_call_initializes_timestamp() {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();
    let fee_receiver = Pubkey::new_unique();
    let fee_receiver_ata = Pubkey::new_unique();

    let mut vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[],
    );
    // Set fee receiver and management fee, but last_fee_timestamp = 0
    set_vault_fees(&mut vault_data, 0, 0, 200, 0, &fee_receiver, 1_000_000, 0);

    let timestamp: i64 = 1_000_000;

    let instruction = build_instruction(
        collect_fees_data(timestamp),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(fee_receiver_ata, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_mint(&vault_key, 6, 100_000_000)),
        (fee_receiver_ata, create_token_account(&share_mint_key, &fee_receiver, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    let result = mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );

    // Verify timestamp was set (no fees minted on first call)
    let vault_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_key).unwrap().1.clone();
    let stored_ts = i64::from_le_bytes(vault_account.data[160..168].try_into().unwrap());
    assert_eq!(stored_ts, timestamp);

    // Fee receiver should still have 0 shares
    let fee_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == fee_receiver_ata).unwrap().1.clone();
    let fee_shares = u64::from_le_bytes(fee_account.data[64..72].try_into().unwrap());
    assert_eq!(fee_shares, 0);
}

#[test]
fn test_collect_fees_management_fee() {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();
    let fee_receiver = Pubkey::new_unique();
    let fee_receiver_ata = Pubkey::new_unique();

    let total_supply: u64 = 1_000_000_000; // 1000 shares (6 decimals)
    let mgmt_fee_bps: u16 = 200; // 2% annual
    let last_ts: i64 = 1_000_000;
    let seconds_per_year: i64 = 31_557_600;
    let current_ts: i64 = last_ts + seconds_per_year; // exactly 1 year later

    let mut vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[],
    );
    set_vault_fees(&mut vault_data, 0, 0, mgmt_fee_bps, 0, &fee_receiver, 1_000_000, last_ts);

    let instruction = build_instruction(
        collect_fees_data(current_ts),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(fee_receiver_ata, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_mint(&vault_key, 6, total_supply)),
        (fee_receiver_ata, create_token_account(&share_mint_key, &fee_receiver, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    // Expected: 1_000_000_000 * 200 / 10_000 = 20_000_000 shares (2% of supply)
    let expected_fee_shares: u64 = 20_000_000;

    let result = mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );

    // Verify fee shares were minted
    let fee_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == fee_receiver_ata).unwrap().1.clone();
    let fee_shares = u64::from_le_bytes(fee_account.data[64..72].try_into().unwrap());
    assert_eq!(fee_shares, expected_fee_shares);

    // Verify timestamp was updated
    let vault_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_key).unwrap().1.clone();
    let stored_ts = i64::from_le_bytes(vault_account.data[160..168].try_into().unwrap());
    assert_eq!(stored_ts, current_ts);
}

#[test]
fn test_collect_fees_performance_fee() {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();
    let fee_receiver = Pubkey::new_unique();
    let fee_receiver_ata = Pubkey::new_unique();

    let total_supply: u64 = 100_000_000; // 100 shares (6 decimals)
    let share_price: u64 = 2_000_000; // current price 2.0
    let hwm: u64 = 1_000_000; // HWM at 1.0 (price doubled)
    let perf_fee_bps: u16 = 2000; // 20% performance fee
    let last_ts: i64 = 1_000_000;
    let current_ts: i64 = last_ts + 100; // small time gap

    let mut vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, share_price, &[],
    );
    // Only performance fee, no management fee
    set_vault_fees(&mut vault_data, 0, 0, 0, perf_fee_bps, &fee_receiver, hwm, last_ts);

    let instruction = build_instruction(
        collect_fees_data(current_ts),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(fee_receiver_ata, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_mint(&vault_key, 6, total_supply)),
        (fee_receiver_ata, create_token_account(&share_mint_key, &fee_receiver, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    // Expected perf fee: (2M - 1M) * 100M * 2000 / (2M * 10000) = 10_000_000 shares
    let expected_fee_shares: u64 = 10_000_000;

    let result = mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );

    // Verify fee shares
    let fee_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == fee_receiver_ata).unwrap().1.clone();
    let fee_shares = u64::from_le_bytes(fee_account.data[64..72].try_into().unwrap());
    assert_eq!(fee_shares, expected_fee_shares);

    // Verify HWM was updated to current price
    let vault_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_key).unwrap().1.clone();
    let updated_hwm = u64::from_le_bytes(vault_account.data[152..160].try_into().unwrap());
    assert_eq!(updated_hwm, share_price);
}

#[test]
fn test_collect_fees_no_fee_receiver() {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();
    let fee_receiver_ata = Pubkey::new_unique();

    // No fee receiver set (all zeros)
    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[],
    );

    let instruction = build_instruction(
        collect_fees_data(1_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(fee_receiver_ata, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_mint(&vault_key, 6, 100_000_000)),
        (fee_receiver_ata, create_token_account(&share_mint_key, &admin, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x10C))], // NoFeesToCollect
    );
}

#[test]
fn test_collect_fees_unauthorized() {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let not_admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();
    let fee_receiver = Pubkey::new_unique();
    let fee_receiver_ata = Pubkey::new_unique();

    let mut vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[],
    );
    set_vault_fees(&mut vault_data, 0, 0, 200, 0, &fee_receiver, 1_000_000, 0);

    let instruction = build_instruction(
        collect_fees_data(1_000_000),
        vec![
            AccountMeta::new_readonly(not_admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(fee_receiver_ata, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (not_admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_mint(&vault_key, 6, 100_000_000)),
        (fee_receiver_ata, create_token_account(&share_mint_key, &fee_receiver, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x100))], // Unauthorized
    );
}

#[test]
fn test_collect_fees_price_below_hwm_no_perf_fee() {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();
    let fee_receiver = Pubkey::new_unique();
    let fee_receiver_ata = Pubkey::new_unique();

    let share_price: u64 = 800_000; // below HWM
    let hwm: u64 = 1_000_000;
    let last_ts: i64 = 1_000_000;
    let current_ts: i64 = last_ts + 100;

    let mut vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, share_price, &[],
    );
    // Only perf fee, no mgmt fee
    set_vault_fees(&mut vault_data, 0, 0, 0, 2000, &fee_receiver, hwm, last_ts);

    let instruction = build_instruction(
        collect_fees_data(current_ts),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(fee_receiver_ata, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_mint(&vault_key, 6, 100_000_000)),
        (fee_receiver_ata, create_token_account(&share_mint_key, &fee_receiver, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    let result = mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );

    // No fees minted (price below HWM, no mgmt fee)
    let fee_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == fee_receiver_ata).unwrap().1.clone();
    let fee_shares = u64::from_le_bytes(fee_account.data[64..72].try_into().unwrap());
    assert_eq!(fee_shares, 0);

    // HWM should NOT be updated (price is below)
    let vault_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_key).unwrap().1.clone();
    let stored_hwm = u64::from_le_bytes(vault_account.data[152..160].try_into().unwrap());
    assert_eq!(stored_hwm, hwm); // unchanged
}
