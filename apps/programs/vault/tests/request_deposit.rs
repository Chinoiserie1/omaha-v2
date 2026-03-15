mod helpers;

use helpers::*;
use mollusk_svm::program::keyed_account_for_system_program;
use mollusk_svm::result::Check;
use solana_account::Account;
use solana_instruction::AccountMeta;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;

use omaha_vault::state::PendingDeposit;

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
fn test_request_deposit_success() {
    let mollusk = setup_with_token();

    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");
    let share_mint_key = Pubkey::new_unique();
    let deposit_amount: u64 = 5_000_000;

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let (pending_key, _pending_bump) = pending_deposit_pda(&vault_key, &depositor);
    let depositor_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        request_deposit_data(deposit_amount),
        vec![
            AccountMeta::new(depositor, true),                    // depositor (signer, writable)
            AccountMeta::new(depositor_base_ata, false),          // depositor's base token
            AccountMeta::new(vault_base_ata, false),              // vault's base token
            AccountMeta::new_readonly(vault_key, false),          // vault_state
            AccountMeta::new(pending_key, false),                 // pending_deposit PDA
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),  // system_program
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),   // token_program
        ],
    );

    let accounts = vec![
        (depositor, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, create_token_account(&base_mint, &depositor, deposit_amount)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (pending_key, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    let result = mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );

    // Verify pending deposit PDA was created
    let pending_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == pending_key).unwrap().1.clone();
    assert_eq!(pending_account.data.len(), PendingDeposit::LEN);
    assert_eq!(pending_account.data[0], 0xA2); // PENDING_DEPOSIT_DISCRIMINATOR
    assert_eq!(pending_account.owner, program_id());

    // Verify stored depositor
    let stored_depositor = &pending_account.data[40..72];
    assert_eq!(stored_depositor, depositor.as_ref());

    // Verify stored amount
    let stored_amount = u64::from_le_bytes(pending_account.data[72..80].try_into().unwrap());
    assert_eq!(stored_amount, deposit_amount);

    // Verify base tokens transferred to vault
    let vault_base = result.resulting_accounts.iter()
        .find(|(k, _)| *k == vault_base_ata).unwrap().1.clone();
    let vault_base_amount = u64::from_le_bytes(vault_base.data[64..72].try_into().unwrap());
    assert_eq!(vault_base_amount, deposit_amount);
}

#[test]
fn test_request_deposit_zero_amount() {
    let mollusk = setup_with_token();

    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let (pending_key, _) = pending_deposit_pda(&vault_key, &depositor);
    let depositor_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        request_deposit_data(0), // zero amount
        vec![
            AccountMeta::new(depositor, true),
            AccountMeta::new(depositor_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pending_key, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (depositor, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, create_token_account(&base_mint, &depositor, 1_000_000)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (pending_key, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x102))], // InvalidAmount
    );
}

#[test]
fn test_request_deposit_missing_signer() {
    let mollusk = setup_with_token();

    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let (pending_key, _) = pending_deposit_pda(&vault_key, &depositor);
    let depositor_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        request_deposit_data(1_000_000),
        vec![
            AccountMeta::new(depositor, false),                   // NOT signer
            AccountMeta::new(depositor_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(pending_key, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (depositor, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, create_token_account(&base_mint, &depositor, 1_000_000)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (pending_key, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::MissingRequiredSignature)],
    );
}

#[test]
fn test_request_deposit_wrong_pending_pda() {
    let mollusk = setup_with_token();

    let admin = Pubkey::new_unique();
    let depositor = Pubkey::new_unique();
    let base_mint = Pubkey::new_unique();
    let (vault_key, bump) = vault_pda(b"test-vault");
    let share_mint_key = Pubkey::new_unique();

    let vault_data = create_vault_state_data(
        &admin, &base_mint, &share_mint_key, bump, 6, 1_000_000, &[], b"test-vault",
    );

    let wrong_pending_key = Pubkey::new_unique(); // wrong PDA
    let depositor_base_ata = Pubkey::new_unique();
    let vault_base_ata = Pubkey::new_unique();

    let instruction = build_instruction(
        request_deposit_data(1_000_000),
        vec![
            AccountMeta::new(depositor, true),
            AccountMeta::new(depositor_base_ata, false),
            AccountMeta::new(vault_base_ata, false),
            AccountMeta::new_readonly(vault_key, false),
            AccountMeta::new(wrong_pending_key, false),           // wrong PDA
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
    );

    let accounts = vec![
        (depositor, Account::new(10_000_000_000, 0, &Pubkey::default())),
        (depositor_base_ata, create_token_account(&base_mint, &depositor, 1_000_000)),
        (vault_base_ata, create_token_account(&base_mint, &vault_key, 0)),
        (vault_key, make_vault_account(vault_data)),
        (wrong_pending_key, Account::new(0, 0, &Pubkey::default())),
        keyed_account_for_system_program(),
        mollusk_svm_programs_token::token::keyed_account(),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::InvalidSeeds)],
    );
}
