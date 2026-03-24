use core::mem::MaybeUninit;

use pinocchio::{
    account_info::AccountInfo,
    cpi,
    instruction::{AccountMeta, Instruction, Seed, Signer},
    program_error::ProgramError,
    ProgramResult,
};

use crate::error::VaultError;
use crate::state::{VaultState, VAULT_DISCRIMINATOR};

/// Generic CPI passthrough — vault PDA signs any instruction to any program.
///
/// This is the core feature: the vault can interact with any Solana program
/// (Jupiter, SPL Token, DeFi protocols, etc.) as a signer.
///
/// Accounts:
///   0. `[signer]`    operator           — must be admin or owner
///   1. `[]`          vault_state        — vault config PDA
///   2. `[]`          target_program     — the program to CPI into
///   3..N             remaining_accounts — forwarded to the target program
///
/// Data:
///   [0]    discriminator (0x04)
///   [1..]  target_instruction_data — passed verbatim to target program
///
/// The vault PDA signs the CPI via invoke_signed. Any account in
/// remaining_accounts that matches the vault PDA address will be marked
/// as a signer in the CPI. No artificial account cap — the Solana runtime
/// enforces the transaction-level limit (64 accounts with ALTs).
pub struct Execute<'a> {
    operator: &'a AccountInfo,
    vault_state: &'a AccountInfo,
    target_program: &'a AccountInfo,
    remaining_accounts: &'a [AccountInfo],
    target_data: &'a [u8],
}

impl<'a> Execute<'a> {
    pub const DISCRIMINATOR: u8 = 4;

    pub fn process(self) -> ProgramResult {
        // Read vault state for authorization and bump
        let data = self.vault_state.try_borrow_data()?;
        let state: &VaultState = bytemuck::from_bytes(&data[..VaultState::LEN]);

        // Authorization: must be admin or owner
        if !state.is_authorized(self.operator.key()) {
            return Err(VaultError::Unauthorized.into());
        }

        let vault_bump = state.bump;
        let vn_len = state.vault_name_len as usize;
        let vault_name = state.vault_name;
        let vault_state_key = *self.vault_state.key();

        // Drop borrow before CPI
        drop(data);

        // Build account metas for the target instruction.
        // If an account's pubkey matches vault_state, mark it as signer
        // (since the vault PDA will sign via invoke_signed).
        // No artificial cap — Solana runtime limits v0 transactions to 64
        // accounts total, so remaining_accounts can never exceed ~61.
        // The stack arrays are sized to 64 (the physical maximum).
        const MAX_ACCOUNTS: usize = 64;
        let num_remaining = self.remaining_accounts.len();

        let mut metas_storage: [MaybeUninit<AccountMeta>; MAX_ACCOUNTS] =
            unsafe { MaybeUninit::uninit().assume_init() };

        for i in 0..num_remaining {
            let acc = &self.remaining_accounts[i];
            let is_vault_signer = *acc.key() == vault_state_key;
            let is_signer = is_vault_signer || acc.is_signer();
            metas_storage[i] = MaybeUninit::new(match (acc.is_writable(), is_signer) {
                (true, true) => AccountMeta::writable_signer(acc.key()),
                (true, false) => AccountMeta::writable(acc.key()),
                (false, true) => AccountMeta::readonly_signer(acc.key()),
                (false, false) => AccountMeta::readonly(acc.key()),
            });
        }
        let metas = unsafe {
            core::slice::from_raw_parts(
                metas_storage.as_ptr() as *const AccountMeta,
                num_remaining,
            )
        };

        // Build account refs slice
        let mut refs_storage: [MaybeUninit<&AccountInfo>; MAX_ACCOUNTS] =
            unsafe { MaybeUninit::uninit().assume_init() };
        for i in 0..num_remaining {
            refs_storage[i] = MaybeUninit::new(&self.remaining_accounts[i]);
        }
        let account_refs = unsafe {
            core::slice::from_raw_parts(
                refs_storage.as_ptr() as *const &AccountInfo,
                num_remaining,
            )
        };

        let ix = Instruction {
            program_id: self.target_program.key(),
            accounts: metas,
            data: self.target_data,
        };

        // Build signer seeds for vault PDA
        let vault_bump_bytes = [vault_bump];
        let seeds: [Seed; 3] = [
            Seed::from(b"vault" as &[u8]),
            Seed::from(&vault_name[..vn_len]),
            Seed::from(&vault_bump_bytes),
        ];
        let signers: [Signer; 1] = [Signer::from(&seeds)];

        cpi::slice_invoke_signed(&ix, account_refs, &signers)
    }
}

impl<'a> TryFrom<(&'a [u8], &'a [AccountInfo])> for Execute<'a> {
    type Error = ProgramError;

    fn try_from(
        (data, accounts): (&'a [u8], &'a [AccountInfo]),
    ) -> Result<Self, Self::Error> {
        if accounts.len() < 3 {
            return Err(ProgramError::NotEnoughAccountKeys);
        }

        let operator = &accounts[0];
        let vault_state = &accounts[1];
        let target_program = &accounts[2];
        let remaining_accounts = &accounts[3..];

        if !operator.is_signer() {
            return Err(ProgramError::MissingRequiredSignature);
        }
        if !vault_state.is_owned_by(&crate::ID) {
            return Err(ProgramError::IllegalOwner);
        }
        if !target_program.executable() {
            return Err(ProgramError::InvalidAccountData);
        }

        {
            let vdata = vault_state.try_borrow_data()?;
            if vdata.len() < VaultState::LEN || vdata[0] != VAULT_DISCRIMINATOR {
                return Err(VaultError::InvalidDiscriminator.into());
            }
        }

        // Everything after the discriminator byte is the target instruction data
        let target_data = data;

        Ok(Self {
            operator,
            vault_state,
            target_program,
            remaining_accounts,
            target_data,
        })
    }
}
