mod helpers;

use helpers::*;
use mollusk_svm::result::Check;
use solana_account::Account;
use solana_instruction::AccountMeta;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;

// ── PauseFactory (0x12) ──────────────────────────────────────────────

#[test]
fn test_pause_factory_by_owner_success() {
    let mollusk = setup();

    let owner = Pubkey::new_unique();
    let (factory_key, factory_bump) = factory_pda();

    let factory_data = create_factory_state_data(&owner, factory_bump, &[]);

    let instruction = build_instruction(
        pause_factory_data(),
        vec![
            AccountMeta::new_readonly(owner, true),      // owner (signer)
            AccountMeta::new(factory_key, false),         // factory_state (writable)
        ],
    );

    let accounts = vec![
        (owner, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (factory_key, make_factory_account(factory_data)),
    ];

    let result = mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );

    // Verify is_paused was set to 1 (offset 2)
    let factory_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == factory_key).unwrap().1.clone();
    assert_eq!(factory_account.data[2], 1);
}

#[test]
fn test_pause_factory_unauthorized() {
    let mollusk = setup();

    let owner = Pubkey::new_unique();
    let random = Pubkey::new_unique();
    let (factory_key, factory_bump) = factory_pda();

    let factory_data = create_factory_state_data(&owner, factory_bump, &[]);

    let instruction = build_instruction(
        pause_factory_data(),
        vec![
            AccountMeta::new_readonly(random, true),     // NOT owner
            AccountMeta::new(factory_key, false),
        ],
    );

    let accounts = vec![
        (random, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (factory_key, make_factory_account(factory_data)),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x100))], // Unauthorized
    );
}

#[test]
fn test_pause_factory_missing_signer() {
    let mollusk = setup();

    let owner = Pubkey::new_unique();
    let (factory_key, factory_bump) = factory_pda();

    let factory_data = create_factory_state_data(&owner, factory_bump, &[]);

    let instruction = build_instruction(
        pause_factory_data(),
        vec![
            AccountMeta::new_readonly(owner, false),     // NOT signer
            AccountMeta::new(factory_key, false),
        ],
    );

    let accounts = vec![
        (owner, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (factory_key, make_factory_account(factory_data)),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::MissingRequiredSignature)],
    );
}

#[test]
fn test_pause_factory_not_enough_accounts() {
    let mollusk = setup();

    let owner = Pubkey::new_unique();

    let instruction = build_instruction(
        pause_factory_data(),
        vec![
            AccountMeta::new_readonly(owner, true),  // only 1 account
        ],
    );

    let accounts = vec![
        (owner, Account::new(1_000_000_000, 0, &Pubkey::default())),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::NotEnoughAccountKeys)],
    );
}

#[test]
fn test_pause_factory_idempotent() {
    let mollusk = setup();

    let owner = Pubkey::new_unique();
    let (factory_key, factory_bump) = factory_pda();

    let mut factory_data = create_factory_state_data(&owner, factory_bump, &[]);
    set_factory_paused(&mut factory_data, true);

    let instruction = build_instruction(
        pause_factory_data(),
        vec![
            AccountMeta::new_readonly(owner, true),
            AccountMeta::new(factory_key, false),
        ],
    );

    let accounts = vec![
        (owner, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (factory_key, make_factory_account(factory_data)),
    ];

    let result = mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );

    let factory_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == factory_key).unwrap().1.clone();
    assert_eq!(factory_account.data[2], 1);
}

#[test]
fn test_pause_factory_invalid_discriminator() {
    let mollusk = setup();

    let owner = Pubkey::new_unique();
    let factory_key = Pubkey::new_unique();

    // Factory account with wrong discriminator
    let fake_data = vec![0u8; 400]; // discriminator 0x00 instead of 0xA4
    let fake_account = Account {
        lamports: 1_000_000_000,
        data: fake_data,
        owner: program_id(),
        executable: false,
        rent_epoch: 0,
    };

    let instruction = build_instruction(
        pause_factory_data(),
        vec![
            AccountMeta::new_readonly(owner, true),
            AccountMeta::new(factory_key, false),
        ],
    );

    let accounts = vec![
        (owner, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (factory_key, fake_account),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x112))], // InvalidFactory
    );
}

// ── UnpauseFactory (0x13) ────────────────────────────────────────────

#[test]
fn test_unpause_factory_by_owner_success() {
    let mollusk = setup();

    let owner = Pubkey::new_unique();
    let (factory_key, factory_bump) = factory_pda();

    let mut factory_data = create_factory_state_data(&owner, factory_bump, &[]);
    set_factory_paused(&mut factory_data, true);

    let instruction = build_instruction(
        unpause_factory_data(),
        vec![
            AccountMeta::new_readonly(owner, true),
            AccountMeta::new(factory_key, false),
        ],
    );

    let accounts = vec![
        (owner, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (factory_key, make_factory_account(factory_data)),
    ];

    let result = mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );

    // Verify is_paused cleared to 0
    let factory_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == factory_key).unwrap().1.clone();
    assert_eq!(factory_account.data[2], 0);
}

#[test]
fn test_unpause_factory_unauthorized() {
    let mollusk = setup();

    let owner = Pubkey::new_unique();
    let random = Pubkey::new_unique();
    let (factory_key, factory_bump) = factory_pda();

    let mut factory_data = create_factory_state_data(&owner, factory_bump, &[]);
    set_factory_paused(&mut factory_data, true);

    let instruction = build_instruction(
        unpause_factory_data(),
        vec![
            AccountMeta::new_readonly(random, true),
            AccountMeta::new(factory_key, false),
        ],
    );

    let accounts = vec![
        (random, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (factory_key, make_factory_account(factory_data)),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x100))], // Unauthorized
    );
}

#[test]
fn test_unpause_factory_idempotent() {
    let mollusk = setup();

    let owner = Pubkey::new_unique();
    let (factory_key, factory_bump) = factory_pda();

    // Already unpaused (default)
    let factory_data = create_factory_state_data(&owner, factory_bump, &[]);

    let instruction = build_instruction(
        unpause_factory_data(),
        vec![
            AccountMeta::new_readonly(owner, true),
            AccountMeta::new(factory_key, false),
        ],
    );

    let accounts = vec![
        (owner, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (factory_key, make_factory_account(factory_data)),
    ];

    let result = mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );

    let factory_account = result.resulting_accounts.iter()
        .find(|(k, _)| *k == factory_key).unwrap().1.clone();
    assert_eq!(factory_account.data[2], 0);
}

// ── Pause-Unpause Full Cycle ─────────────────────────────────────────

#[test]
fn test_factory_pause_unpause_cycle() {
    let mollusk = setup();

    let owner = Pubkey::new_unique();
    let (factory_key, factory_bump) = factory_pda();

    let factory_data = create_factory_state_data(&owner, factory_bump, &[]);

    // Step 1: Pause
    let pause_ix = build_instruction(
        pause_factory_data(),
        vec![
            AccountMeta::new_readonly(owner, true),
            AccountMeta::new(factory_key, false),
        ],
    );

    let pause_accounts = vec![
        (owner, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (factory_key, make_factory_account(factory_data)),
    ];

    let result = mollusk.process_and_validate_instruction(
        &pause_ix,
        &pause_accounts,
        &[Check::success()],
    );

    let paused_factory = result.resulting_accounts.iter()
        .find(|(k, _)| *k == factory_key).unwrap().1.clone();
    assert_eq!(paused_factory.data[2], 1);

    // Step 2: Unpause using the resulting state
    let unpause_ix = build_instruction(
        unpause_factory_data(),
        vec![
            AccountMeta::new_readonly(owner, true),
            AccountMeta::new(factory_key, false),
        ],
    );

    let unpause_accounts = vec![
        (owner, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (factory_key, paused_factory),
    ];

    let result = mollusk.process_and_validate_instruction(
        &unpause_ix,
        &unpause_accounts,
        &[Check::success()],
    );

    let unpaused_factory = result.resulting_accounts.iter()
        .find(|(k, _)| *k == factory_key).unwrap().1.clone();
    assert_eq!(unpaused_factory.data[2], 0);
}

// ── Factory Admin Cannot Pause (owner-only) ──────────────────────────

#[test]
fn test_pause_factory_admin_cannot_pause() {
    let mollusk = setup();

    let owner = Pubkey::new_unique();
    let factory_admin = Pubkey::new_unique();
    let (factory_key, factory_bump) = factory_pda();

    // Factory with an admin
    let factory_data = create_factory_state_data(&owner, factory_bump, &[factory_admin]);

    let instruction = build_instruction(
        pause_factory_data(),
        vec![
            AccountMeta::new_readonly(factory_admin, true),  // admin, NOT owner
            AccountMeta::new(factory_key, false),
        ],
    );

    let accounts = vec![
        (factory_admin, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (factory_key, make_factory_account(factory_data)),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x100))], // Unauthorized
    );
}
