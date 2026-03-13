mod helpers;

use helpers::*;
use mollusk_svm::result::Check;
use solana_account::Account;
use solana_instruction::AccountMeta;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;

use omaha_vault::state::VaultState;

/// Create a packed SPL Mint account.
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
fn test_deposit_success() {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();

    let share_decimals: u8 = 6;
    let share_price: u64 = 1_000_000; // 1:1 ratio at 6 decimals
    let deposit_amount: u64 = 5_000_000; // 5 USDC (6 decimals)

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, share_price, &[],
    );

    let depositor_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let depositor_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        deposit_data(deposit_amount),
        vec![
            AccountMeta::new_readonly(depositor, true),          // depositor (signer)
            AccountMeta::new(depositor_base_ata, false),          // depositor's base token
            AccountMeta::new(vault_base_ata, false),              // vault's base token
            AccountMeta::new_readonly(vault_key, false),          // vault_state
            AccountMeta::new(share_mint_key, false),              // share_mint
            AccountMeta::new(depositor_share_ata, false),         // depositor's share token
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),   // token_program
        ],
    );

    let accounts = vec![
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, create_token_account(&base_mint, &depositor, deposit_amount)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_mint(&vault_key, share_decimals)),
        (depositor_share_ata, create_token_account(&share_mint_key, &depositor, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    // shares_to_mint = 5_000_000 * 10^6 / 1_000_000 = 5_000_000 shares
    let expected_shares: u64 = 5_000_000;

    let result = mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );

    // Verify depositor's base tokens decreased
    let depositor_base = result.resulting_accounts.iter()
        .find(|(k, _)| *k == depositor_base_ata).unwrap().1.clone();
    let depositor_base_amount = u64::from_le_bytes(depositor_base.data[64..72].try_into().unwrap());
    assert_eq!(depositor_base_amount, 0);

    // Verify vault received base tokens
    let vault_base = result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_base_ata).unwrap().1.clone();
    let vault_base_amount = u64::from_le_bytes(vault_base.data[64..72].try_into().unwrap());
    assert_eq!(vault_base_amount, deposit_amount);

    // Verify shares minted
    let depositor_shares = result.resulting_accounts.iter()
        .find(|(k, _)| *k == depositor_share_ata).unwrap().1.clone();
    let shares_amount = u64::from_le_bytes(depositor_shares.data[64..72].try_into().unwrap());
    assert_eq!(shares_amount, expected_shares);
}

#[test]
fn test_deposit_share_math_fractional() {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();

    let share_decimals: u8 = 6;
    let share_price: u64 = 2_000_000; // 2x price — 1 USDC = 0.5 shares
    let deposit_amount: u64 = 1_000_000; // 1 USDC

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, share_price, &[],
    );

    let depositor_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let depositor_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        deposit_data(deposit_amount),
        vec![
            AccountMeta::new_readonly(depositor, true),
            AccountMeta::new(depositor_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(depositor_share_ata, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, create_token_account(&base_mint, &depositor, deposit_amount)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_mint(&vault_key, share_decimals)),
        (depositor_share_ata, create_token_account(&share_mint_key, &depositor, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    // shares_to_mint = 1_000_000 * 10^6 / 2_000_000 = 500_000 shares
    let result = mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );

    let depositor_shares = result.resulting_accounts.iter()
        .find(|(k, _)| *k == depositor_share_ata).unwrap().1.clone();
    let shares_amount = u64::from_le_bytes(depositor_shares.data[64..72].try_into().unwrap());
    assert_eq!(shares_amount, 500_000);
}

#[test]
fn test_deposit_zero_amount() {
    let mollusk = setup_with_token();
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
        deposit_data(0), // zero amount
        vec![
            AccountMeta::new_readonly(depositor, true),
            AccountMeta::new(depositor_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(depositor_share_ata, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, create_token_account(&base_mint, &depositor, 1_000_000)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_mint(&vault_key, 6)),
        (depositor_share_ata, create_token_account(&share_mint_key, &depositor, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x102))], // InvalidAmount
    );
}

#[test]
fn test_deposit_missing_signer() {
    let mollusk = setup_with_token();
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
        deposit_data(1_000_000),
        vec![
            AccountMeta::new_readonly(depositor, false), // NOT signer
            AccountMeta::new(depositor_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(depositor_share_ata, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, create_token_account(&base_mint, &depositor, 1_000_000)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (share_mint_key, create_mint(&vault_key, 6)),
        (depositor_share_ata, create_token_account(&share_mint_key, &depositor, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::MissingRequiredSignature)],
    );
}

#[test]
fn test_deposit_wrong_share_mint() {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();
    let wrong_share_mint = Pubkey::new_unique(); // mismatched

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[],
    );

    let depositor_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();
    let depositor_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        deposit_data(1_000_000),
        vec![
            AccountMeta::new_readonly(depositor, true),
            AccountMeta::new(depositor_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(wrong_share_mint, false), // wrong mint
            AccountMeta::new(depositor_share_ata, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, create_token_account(&base_mint, &depositor, 1_000_000)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (wrong_share_mint, create_mint(&vault_key, 6)),
        (depositor_share_ata, create_token_account(&wrong_share_mint, &depositor, 0)),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::InvalidAccountData)],
    );
}
