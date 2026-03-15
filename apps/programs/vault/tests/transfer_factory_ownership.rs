mod helpers;

use helpers::*;
use mollusk_svm::result::Check;
use solana_account::Account;
use solana_instruction::AccountMeta;
use solana_program_error::ProgramError;
use solana_pubkey::Pubkey;

// ── TransferFactoryOwnership (0x10) ─────────────────────────────────

#[test]
fn test_transfer_ownership_success() {
    let mollusk = setup();
    let owner = Pubkey::new_unique();
    let new_owner = Pubkey::new_unique();
    let (factory_key, bump) = factory_pda();

    let factory_data = create_factory_state_data(&owner, bump, &[]);

    let instruction = build_instruction(
        transfer_factory_ownership_data(&new_owner),
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

    // Verify pending_owner was set in the resulting account data
    let factory_account = &result.resulting_accounts[1].1;
    let pending = &factory_account.data[40..72];
    assert_eq!(pending, new_owner.as_ref(), "pending_owner should be set to new_owner");

    // Verify owner is unchanged
    let current_owner = &factory_account.data[8..40];
    assert_eq!(current_owner, owner.as_ref(), "owner should remain unchanged");
}

#[test]
fn test_transfer_ownership_unauthorized_stranger() {
    let mollusk = setup();
    let owner = Pubkey::new_unique();
    let stranger = Pubkey::new_unique();
    let new_owner = Pubkey::new_unique();
    let (factory_key, bump) = factory_pda();

    let factory_data = create_factory_state_data(&owner, bump, &[]);

    let instruction = build_instruction(
        transfer_factory_ownership_data(&new_owner),
        vec![
            AccountMeta::new_readonly(stranger, true), // not the owner
            AccountMeta::new(factory_key, false),
        ],
    );

    let accounts = vec![
        (stranger, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (factory_key, make_factory_account(factory_data)),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x100))], // Unauthorized
    );
}

#[test]
fn test_transfer_ownership_unauthorized_admin_not_owner() {
    let mollusk = setup();
    let owner = Pubkey::new_unique();
    let factory_admin = Pubkey::new_unique();
    let new_owner = Pubkey::new_unique();
    let (factory_key, bump) = factory_pda();

    // factory_admin is in the admins list, but is NOT the owner
    let factory_data = create_factory_state_data(&owner, bump, &[factory_admin]);

    let instruction = build_instruction(
        transfer_factory_ownership_data(&new_owner),
        vec![
            AccountMeta::new_readonly(factory_admin, true), // admin, not owner
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
        &[Check::err(ProgramError::Custom(0x100))], // Unauthorized — only owner, not admin
    );
}

#[test]
fn test_transfer_ownership_zero_pubkey_rejected() {
    let mollusk = setup();
    let owner = Pubkey::new_unique();
    let (factory_key, bump) = factory_pda();

    let factory_data = create_factory_state_data(&owner, bump, &[]);

    let instruction = build_instruction(
        transfer_factory_ownership_data(&Pubkey::default()), // zero pubkey
        vec![
            AccountMeta::new_readonly(owner, true),
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
        &[Check::err(ProgramError::Custom(0x119))], // ZeroPubkey
    );
}

#[test]
fn test_transfer_ownership_overwrites_previous_pending() {
    let mollusk = setup();
    let owner = Pubkey::new_unique();
    let first_candidate = Pubkey::new_unique();
    let second_candidate = Pubkey::new_unique();
    let (factory_key, bump) = factory_pda();

    // Factory already has a pending_owner set
    let mut factory_data = create_factory_state_data(&owner, bump, &[]);
    set_factory_pending_owner(&mut factory_data, &first_candidate);

    // Owner changes their mind, proposes a different address
    let instruction = build_instruction(
        transfer_factory_ownership_data(&second_candidate),
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

    // Verify pending_owner is now the second candidate, not the first
    let factory_account = &result.resulting_accounts[1].1;
    let pending = &factory_account.data[40..72];
    assert_eq!(pending, second_candidate.as_ref(), "pending_owner should be overwritten");
}

#[test]
fn test_transfer_ownership_insufficient_data() {
    let mollusk = setup();
    let owner = Pubkey::new_unique();
    let (factory_key, bump) = factory_pda();

    let factory_data = create_factory_state_data(&owner, bump, &[]);

    // Only 16 bytes of pubkey (need 32)
    let mut data = vec![0x10];
    data.extend_from_slice(&[1u8; 16]);

    let instruction = build_instruction(
        data,
        vec![
            AccountMeta::new_readonly(owner, true),
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
        &[Check::err(ProgramError::InvalidInstructionData)],
    );
}

// ── AcceptFactoryOwnership (0x11) ───────────────────────────────────

#[test]
fn test_accept_ownership_success() {
    let mollusk = setup();
    let current_owner = Pubkey::new_unique();
    let new_owner = Pubkey::new_unique();
    let (factory_key, bump) = factory_pda();

    let mut factory_data = create_factory_state_data(&current_owner, bump, &[]);
    set_factory_pending_owner(&mut factory_data, &new_owner);

    let instruction = build_instruction(
        accept_factory_ownership_data(),
        vec![
            AccountMeta::new_readonly(new_owner, true),
            AccountMeta::new(factory_key, false),
        ],
    );

    let accounts = vec![
        (new_owner, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (factory_key, make_factory_account(factory_data)),
    ];

    let result = mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::success()],
    );

    let factory_account = &result.resulting_accounts[1].1;

    // Verify owner is now new_owner
    let owner_bytes = &factory_account.data[8..40];
    assert_eq!(owner_bytes, new_owner.as_ref(), "owner should be the new_owner");

    // Verify pending_owner is cleared
    let pending = &factory_account.data[40..72];
    assert_eq!(pending, &[0u8; 32], "pending_owner should be cleared");
}

#[test]
fn test_accept_ownership_no_pending_transfer() {
    let mollusk = setup();
    let current_owner = Pubkey::new_unique();
    let random_signer = Pubkey::new_unique();
    let (factory_key, bump) = factory_pda();

    // No pending_owner set (all zeros)
    let factory_data = create_factory_state_data(&current_owner, bump, &[]);

    let instruction = build_instruction(
        accept_factory_ownership_data(),
        vec![
            AccountMeta::new_readonly(random_signer, true),
            AccountMeta::new(factory_key, false),
        ],
    );

    let accounts = vec![
        (random_signer, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (factory_key, make_factory_account(factory_data)),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x11A))], // NoPendingOwner
    );
}

#[test]
fn test_accept_ownership_wrong_signer() {
    let mollusk = setup();
    let current_owner = Pubkey::new_unique();
    let intended_new_owner = Pubkey::new_unique();
    let wrong_signer = Pubkey::new_unique();
    let (factory_key, bump) = factory_pda();

    let mut factory_data = create_factory_state_data(&current_owner, bump, &[]);
    set_factory_pending_owner(&mut factory_data, &intended_new_owner);

    let instruction = build_instruction(
        accept_factory_ownership_data(),
        vec![
            AccountMeta::new_readonly(wrong_signer, true), // not the pending owner
            AccountMeta::new(factory_key, false),
        ],
    );

    let accounts = vec![
        (wrong_signer, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (factory_key, make_factory_account(factory_data)),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x11B))], // InvalidPendingOwner
    );
}

#[test]
fn test_accept_ownership_current_owner_cannot_accept() {
    let mollusk = setup();
    let current_owner = Pubkey::new_unique();
    let new_owner = Pubkey::new_unique();
    let (factory_key, bump) = factory_pda();

    let mut factory_data = create_factory_state_data(&current_owner, bump, &[]);
    set_factory_pending_owner(&mut factory_data, &new_owner);

    // Current owner tries to accept (but pending_owner is new_owner)
    let instruction = build_instruction(
        accept_factory_ownership_data(),
        vec![
            AccountMeta::new_readonly(current_owner, true),
            AccountMeta::new(factory_key, false),
        ],
    );

    let accounts = vec![
        (current_owner, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (factory_key, make_factory_account(factory_data)),
    ];

    mollusk.process_and_validate_instruction(
        &instruction,
        &accounts,
        &[Check::err(ProgramError::Custom(0x11B))], // InvalidPendingOwner
    );
}

// ── Full 2-step flow ────────────────────────────────────────────────

#[test]
fn test_full_ownership_transfer_flow() {
    let mollusk = setup();
    let original_owner = Pubkey::new_unique();
    let new_owner = Pubkey::new_unique();
    let (factory_key, bump) = factory_pda();

    let factory_data = create_factory_state_data(&original_owner, bump, &[]);

    // Step 1: Original owner proposes transfer
    let transfer_ix = build_instruction(
        transfer_factory_ownership_data(&new_owner),
        vec![
            AccountMeta::new_readonly(original_owner, true),
            AccountMeta::new(factory_key, false),
        ],
    );

    let accounts = vec![
        (original_owner, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (factory_key, make_factory_account(factory_data)),
    ];

    let result = mollusk.process_and_validate_instruction(
        &transfer_ix,
        &accounts,
        &[Check::success()],
    );

    // Step 2: New owner accepts — use the resulting factory account from step 1
    let updated_factory_account = result.resulting_accounts[1].1.clone();

    let accept_ix = build_instruction(
        accept_factory_ownership_data(),
        vec![
            AccountMeta::new_readonly(new_owner, true),
            AccountMeta::new(factory_key, false),
        ],
    );

    let accounts_step2 = vec![
        (new_owner, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (factory_key, updated_factory_account),
    ];

    let result2 = mollusk.process_and_validate_instruction(
        &accept_ix,
        &accounts_step2,
        &[Check::success()],
    );

    let final_factory = &result2.resulting_accounts[1].1;

    // Verify ownership transferred
    assert_eq!(&final_factory.data[8..40], new_owner.as_ref(), "owner should be new_owner");
    assert_eq!(&final_factory.data[40..72], &[0u8; 32], "pending_owner should be cleared");

    // Step 3: Verify old owner can no longer propose transfers
    let another_candidate = Pubkey::new_unique();
    let old_owner_ix = build_instruction(
        transfer_factory_ownership_data(&another_candidate),
        vec![
            AccountMeta::new_readonly(original_owner, true),
            AccountMeta::new(factory_key, false),
        ],
    );

    let accounts_step3 = vec![
        (original_owner, Account::new(1_000_000_000, 0, &Pubkey::default())),
        (factory_key, result2.resulting_accounts[1].1.clone()),
    ];

    mollusk.process_and_validate_instruction(
        &old_owner_ix,
        &accounts_step3,
        &[Check::err(ProgramError::Custom(0x100))], // Unauthorized — no longer owner
    );
}

#[test]
fn test_new_owner_can_operate_after_transfer() {
    let mollusk = setup();
    let original_owner = Pubkey::new_unique();
    let new_owner = Pubkey::new_unique();
    let new_admin = Pubkey::new_unique();
    let (factory_key, bump) = factory_pda();

    // Set up factory with pending_owner already set (simulates step 1 done)
    let mut factory_data = create_factory_state_data(&original_owner, bump, &[]);
    set_factory_pending_owner(&mut factory_data, &new_owner);

    // Accept ownership
    let accept_ix = build_instruction(
        accept_factory_ownership_data(),
        vec![
            AccountMeta::new_readonly(new_owner, true),
            AccountMeta::new(factory_key, false),
        ],
    );

    let result = mollusk.process_and_validate_instruction(
        &accept_ix,
        &[
            (new_owner, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (factory_key, make_factory_account(factory_data)),
        ],
        &[Check::success()],
    );

    // New owner adds a factory admin — proves they have full ownership
    let add_admin_ix = build_instruction(
        add_factory_admin_data(&new_admin),
        vec![
            AccountMeta::new_readonly(new_owner, true),
            AccountMeta::new(factory_key, false),
        ],
    );

    mollusk.process_and_validate_instruction(
        &add_admin_ix,
        &[
            (new_owner, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (factory_key, result.resulting_accounts[1].1.clone()),
        ],
        &[Check::success()],
    );
}

#[test]
fn test_old_owner_loses_all_access_after_transfer() {
    let mollusk = setup();
    let original_owner = Pubkey::new_unique();
    let new_owner = Pubkey::new_unique();
    let some_admin = Pubkey::new_unique();
    let (factory_key, bump) = factory_pda();

    // Factory with one admin, pending_owner already set
    let mut factory_data = create_factory_state_data(&original_owner, bump, &[some_admin]);
    set_factory_pending_owner(&mut factory_data, &new_owner);

    // Accept ownership
    let accept_ix = build_instruction(
        accept_factory_ownership_data(),
        vec![
            AccountMeta::new_readonly(new_owner, true),
            AccountMeta::new(factory_key, false),
        ],
    );

    let result = mollusk.process_and_validate_instruction(
        &accept_ix,
        &[
            (new_owner, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (factory_key, make_factory_account(factory_data)),
        ],
        &[Check::success()],
    );

    let transferred_factory = result.resulting_accounts[1].1.clone();

    // ── Old owner tries AddFactoryAdmin → Unauthorized ──
    let add_ix = build_instruction(
        add_factory_admin_data(&Pubkey::new_unique()),
        vec![
            AccountMeta::new_readonly(original_owner, true),
            AccountMeta::new(factory_key, false),
        ],
    );
    mollusk.process_and_validate_instruction(
        &add_ix,
        &[
            (original_owner, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (factory_key, transferred_factory.clone()),
        ],
        &[Check::err(ProgramError::Custom(0x100))], // Unauthorized
    );

    // ── Old owner tries RemoveFactoryAdmin → Unauthorized ──
    let remove_ix = build_instruction(
        remove_factory_admin_data(&some_admin),
        vec![
            AccountMeta::new_readonly(original_owner, true),
            AccountMeta::new(factory_key, false),
        ],
    );
    mollusk.process_and_validate_instruction(
        &remove_ix,
        &[
            (original_owner, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (factory_key, transferred_factory.clone()),
        ],
        &[Check::err(ProgramError::Custom(0x100))], // Unauthorized
    );

    // ── Old owner tries TransferFactoryOwnership → Unauthorized ──
    let transfer_ix = build_instruction(
        transfer_factory_ownership_data(&Pubkey::new_unique()),
        vec![
            AccountMeta::new_readonly(original_owner, true),
            AccountMeta::new(factory_key, false),
        ],
    );
    mollusk.process_and_validate_instruction(
        &transfer_ix,
        &[
            (original_owner, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (factory_key, transferred_factory.clone()),
        ],
        &[Check::err(ProgramError::Custom(0x100))], // Unauthorized
    );

    // ── Old owner tries PauseFactory → Unauthorized ──
    let pause_ix = build_instruction(
        vec![0x12], // PauseFactory discriminator
        vec![
            AccountMeta::new_readonly(original_owner, true),
            AccountMeta::new(factory_key, false),
        ],
    );
    mollusk.process_and_validate_instruction(
        &pause_ix,
        &[
            (original_owner, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (factory_key, transferred_factory.clone()),
        ],
        &[Check::err(ProgramError::Custom(0x100))], // Unauthorized
    );

    // ── Old owner tries UnpauseFactory → Unauthorized ──
    let unpause_ix = build_instruction(
        vec![0x13], // UnpauseFactory discriminator
        vec![
            AccountMeta::new_readonly(original_owner, true),
            AccountMeta::new(factory_key, false),
        ],
    );
    mollusk.process_and_validate_instruction(
        &unpause_ix,
        &[
            (original_owner, Account::new(1_000_000_000, 0, &Pubkey::default())),
            (factory_key, transferred_factory.clone()),
        ],
        &[Check::err(ProgramError::Custom(0x100))], // Unauthorized
    );
}
