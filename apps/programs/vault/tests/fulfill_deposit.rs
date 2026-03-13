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
fn test_fulfill_deposit_success() {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();

    let share_decimals: u8 = 6;
    let old_price: u64 = 1_000_000;
    let new_price: u64 = 2_000_000;
    let deposit_amount: u64 = 10_000_000; // 10 USDC

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, share_decimals, old_price, &[],
    );

    let (pending_key, pending_bump) = pending_deposit_pda(&vault_key, &depositor);
    let pending_data = create_pending_deposit_data(
        &vault_key, &depositor, pending_bump, deposit_amount,
    );

    let depositor_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        fulfill_deposit_data(new_price),
        vec![
            AccountMeta::new_readonly(admin, true),              // admin (signer)
            AccountMeta::new(vault_key, false),                   // vault_state (writable)
            AccountMeta::new(pending_key, false),                 // pending_deposit (writable)
            AccountMeta::new(share_mint_key, false),              // share_mint
            AccountMeta::new(depositor_share_ata, false),         // depositor's share token
            AccountMeta::new(depositor, false),                   // depositor (writable, NOT signer)
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),   // token_program
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (pending_key, make_pending_deposit_account(pending_data)),
        (share_mint_key, create_mint(&vault_key, share_decimals)),
        (depositor_share_ata, create_token_account(&share_mint_key, &depositor, 0)),
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    // shares = 10_000_000 * 10^6 / 2_000_000 = 5_000_000
    let expected_shares: u64 = 5_000_000;

    let result = mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );

    // Verify shares minted
    let depositor_shares = result.resulting_accounts.iter()
        .find(|(k, _)| *k == depositor_share_ata).unwrap().1.clone();
    let shares_amount = u64::from_le_bytes(depositor_shares.data[64..72].try_into().unwrap());
    assert_eq!(shares_amount, expected_shares);

    // Verify vault state price was updated
    let vault_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_key).unwrap().1.clone();
    let updated_price = u64::from_le_bytes(vault_account.data[104..112].try_into().unwrap());
    assert_eq!(updated_price, new_price);

    // Verify pending deposit was closed (lamports = 0)
    let pending_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == pending_key).unwrap().1.clone();
    assert_eq!(pending_account.lamports, 0);
}

#[test]
fn test_fulfill_deposit_unauthorized() {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let not_admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[],
    );

    let (pending_key, pending_bump) = pending_deposit_pda(&vault_key, &depositor);
    let pending_data = create_pending_deposit_data(
        &vault_key, &depositor, pending_bump, 5_000_000,
    );

    let depositor_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        fulfill_deposit_data(2_000_000),
        vec![
            AccountMeta::new_readonly(not_admin, true),           // NOT admin
            AccountMeta::new(vault_key, false),
            AccountMeta::new(pending_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(depositor_share_ata, false),
            AccountMeta::new(depositor, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (not_admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (pending_key, make_pending_deposit_account(pending_data)),
        (share_mint_key, create_mint(&vault_key, 6)),
        (depositor_share_ata, create_token_account(&share_mint_key, &depositor, 0)),
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x100))], // Unauthorized
    );
}

#[test]
fn test_fulfill_deposit_wrong_depositor() {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let wrong_depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[],
    );

    let (pending_key, pending_bump) = pending_deposit_pda(&vault_key, &depositor);
    let pending_data = create_pending_deposit_data(
        &vault_key, &depositor, pending_bump, 5_000_000,
    );

    let depositor_share_ata = Pubkey::new_unique();

    // Pass wrong_depositor instead of depositor
    let instruction = build_instruction(
        fulfill_deposit_data(2_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(pending_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(depositor_share_ata, false),
            AccountMeta::new(wrong_depositor, false),             // wrong depositor
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (pending_key, make_pending_deposit_account(pending_data)),
        (share_mint_key, create_mint(&vault_key, 6)),
        (depositor_share_ata, create_token_account(&share_mint_key, &wrong_depositor, 0)),
        (wrong_depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::InvalidAccountData)],
    );
}

#[test]
fn test_fulfill_deposit_wrong_vault() {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let other_base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let (other_vault_key, other_bump) = vault_pda(&admin, &other_base_mint);
    let share_mint_key = Pubkey::new_unique();

    // Pending deposit belongs to vault_key
    let (pending_key, pending_bump) = pending_deposit_pda(&vault_key, &depositor);
    let pending_data = create_pending_deposit_data(
        &vault_key, &depositor, pending_bump, 5_000_000,
    );

    // But we pass other_vault_key
    let other_vault_data = create_vault_state_data(
        &admin, &other_base_mint, &share_mint_key, other_bump, 6, 1_000_000, &[],
    );

    let depositor_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        fulfill_deposit_data(2_000_000),
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(other_vault_key, false),             // wrong vault
            AccountMeta::new(pending_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(depositor_share_ata, false),
            AccountMeta::new(depositor, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (other_vault_key, make_vault_account(other_vault_data)),
        (pending_key, make_pending_deposit_account(pending_data)),
        (share_mint_key, create_mint(&other_vault_key, 6)),
        (depositor_share_ata, create_token_account(&share_mint_key, &depositor, 0)),
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::InvalidAccountData)],
    );
}

#[test]
fn test_fulfill_deposit_zero_price() {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[],
    );

    let (pending_key, pending_bump) = pending_deposit_pda(&vault_key, &depositor);
    let pending_data = create_pending_deposit_data(
        &vault_key, &depositor, pending_bump, 5_000_000,
    );

    let depositor_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        fulfill_deposit_data(0), // zero price
        vec![
            AccountMeta::new_readonly(admin, true),
            AccountMeta::new(vault_key, false),
            AccountMeta::new(pending_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(depositor_share_ata, false),
            AccountMeta::new(depositor, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (pending_key, make_pending_deposit_account(pending_data)),
        (share_mint_key, create_mint(&vault_key, 6)),
        (depositor_share_ata, create_token_account(&share_mint_key, &depositor, 0)),
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x101))], // InvalidSharePrice
    );
}

#[test]
fn test_fulfill_deposit_missing_admin_signer() {
    let mollusk = setup_with_token();
    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(&admin, &base_mint);
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[],
    );

    let (pending_key, pending_bump) = pending_deposit_pda(&vault_key, &depositor);
    let pending_data = create_pending_deposit_data(
        &vault_key, &depositor, pending_bump, 5_000_000,
    );

    let depositor_share_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        fulfill_deposit_data(2_000_000),
        vec![
            AccountMeta::new_readonly(admin, false),              // NOT signer
            AccountMeta::new(vault_key, false),
            AccountMeta::new(pending_key, false),
            AccountMeta::new(share_mint_key, false),
            AccountMeta::new(depositor_share_ata, false),
            AccountMeta::new(depositor, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (vault_key, make_vault_account(vault_data)),
        (pending_key, make_pending_deposit_account(pending_data)),
        (share_mint_key, create_mint(&vault_key, 6)),
        (depositor_share_ata, create_token_account(&share_mint_key, &depositor, 0)),
        (depositor, Account::new(1_000_000_000, 0, &Pubkey::default())),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::MissingRequiredSignature)],
    );
}
