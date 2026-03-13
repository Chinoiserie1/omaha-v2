use mollusk_svm::Mollusk;
use solana_account::Account;
use solana_instruction::{AccountMeta, Instruction};
use solana_pubkey::Pubkey;

use omaha_vault::state::{VaultState, VAULT_DISCRIMINATOR};

/// SPL Token program ID.
pub const TOKEN_PROGRAM_ID: Pubkey =
    solana_pubkey::pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

/// System program ID.
pub const SYSTEM_PROGRAM_ID: Pubkey =
    solana_pubkey::pubkey!("11111111111111111111111111111111");

/// The program ID matching `declare_id!` in lib.rs.
pub fn program_id() -> Pubkey {
    "5yY17NisfXbyjanUEBxrdKsSCuRiWcjzEt6LXGZqDiVR"
        .parse()
        .unwrap()
}

/// Create a Mollusk instance with the vault program loaded.
pub fn setup() -> Mollusk {
    let pid = program_id();
    Mollusk::new(&pid, "omaha_vault")
}

/// Create a Mollusk instance with vault + SPL Token programs loaded.
pub fn setup_with_token() -> Mollusk {
    let mut mollusk = setup();
    mollusk_svm_programs_token::token::add_program(&mut mollusk);
    mollusk
}

/// Derive vault PDA: seeds = ["vault", admin, base_mint].
pub fn vault_pda(admin: &Pubkey, base_mint: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"vault", admin.as_ref(), base_mint.as_ref()],
        &program_id(),
    )
}

/// Derive share mint PDA: seeds = ["share_mint", vault_state].
pub fn share_mint_pda(vault_state: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"share_mint", vault_state.as_ref()],
        &program_id(),
    )
}

/// Create raw VaultState bytes with the given parameters.
pub fn create_vault_state_data(
    admin: &Pubkey,
    base_mint: &Pubkey,
    share_mint: &Pubkey,
    bump: u8,
    share_decimals: u8,
    share_price: u64,
    owners: &[Pubkey],
) -> Vec<u8> {
    let mut data = vec![0u8; VaultState::LEN];

    data[0] = VAULT_DISCRIMINATOR; // discriminator
    data[1] = bump;
    data[2] = share_decimals;
    data[3] = owners.len() as u8;
    // _padding at [4..8] = zeroed

    data[8..40].copy_from_slice(admin.as_ref());
    data[40..72].copy_from_slice(share_mint.as_ref());
    data[72..104].copy_from_slice(base_mint.as_ref());
    data[104..112].copy_from_slice(&share_price.to_le_bytes());

    for (i, owner) in owners.iter().enumerate() {
        let offset = 112 + i * 32;
        data[offset..offset + 32].copy_from_slice(owner.as_ref());
    }

    data
}

/// Create a vault state account owned by the program with the given data.
pub fn make_vault_account(data: Vec<u8>) -> Account {
    Account {
        lamports: 1_000_000_000,
        data,
        owner: program_id(),
        executable: false,
        rent_epoch: 0,
    }
}

/// Build an instruction for the vault program.
pub fn build_instruction(
    data: Vec<u8>,
    account_metas: Vec<AccountMeta>,
) -> Instruction {
    Instruction::new_with_bytes(program_id(), &data, account_metas)
}

/// Build Initialize instruction data: [disc=0x00] [share_decimals: u8] [share_price: u64 LE].
pub fn initialize_data(share_decimals: u8, share_price: u64) -> Vec<u8> {
    let mut data = vec![0x00, share_decimals];
    data.extend_from_slice(&share_price.to_le_bytes());
    data
}

/// Build Withdraw instruction data: [disc=0x02] [shares: u64 LE].
pub fn withdraw_data(shares: u64) -> Vec<u8> {
    let mut data = vec![0x02];
    data.extend_from_slice(&shares.to_le_bytes());
    data
}

/// Build SetSharePrice instruction data: [disc=0x03] [price: u64 LE].
pub fn set_share_price_data(price: u64) -> Vec<u8> {
    let mut data = vec![0x03];
    data.extend_from_slice(&price.to_le_bytes());
    data
}

/// Build Execute instruction data: [disc=0x04] [target_data...].
pub fn execute_data(target_data: &[u8]) -> Vec<u8> {
    let mut data = vec![0x04];
    data.extend_from_slice(target_data);
    data
}

/// Build AddOwner instruction data: [disc=0x05] [owner: 32 bytes].
pub fn add_owner_data(owner: &Pubkey) -> Vec<u8> {
    let mut data = vec![0x05];
    data.extend_from_slice(owner.as_ref());
    data
}

/// Build RemoveOwner instruction data: [disc=0x06] [owner: 32 bytes].
pub fn remove_owner_data(owner: &Pubkey) -> Vec<u8> {
    let mut data = vec![0x06];
    data.extend_from_slice(owner.as_ref());
    data
}

/// Build DepositWithPrice instruction data: [disc=0x07] [price: u64 LE] [amount: u64 LE].
pub fn deposit_with_price_data(price: u64, amount: u64) -> Vec<u8> {
    let mut data = vec![0x07];
    data.extend_from_slice(&price.to_le_bytes());
    data.extend_from_slice(&amount.to_le_bytes());
    data
}

/// Build RequestDeposit instruction data: [disc=0x08] [amount: u64 LE].
pub fn request_deposit_data(amount: u64) -> Vec<u8> {
    let mut data = vec![0x08];
    data.extend_from_slice(&amount.to_le_bytes());
    data
}

/// Build FulfillDeposit instruction data: [disc=0x09] [price: u64 LE].
pub fn fulfill_deposit_data(price: u64) -> Vec<u8> {
    let mut data = vec![0x09];
    data.extend_from_slice(&price.to_le_bytes());
    data
}

/// Derive pending deposit PDA: seeds = ["pending_deposit", vault_state, depositor].
pub fn pending_deposit_pda(vault_state: &Pubkey, depositor: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"pending_deposit", vault_state.as_ref(), depositor.as_ref()],
        &program_id(),
    )
}

/// Create raw PendingDeposit bytes with the given parameters.
pub fn create_pending_deposit_data(
    vault_state: &Pubkey,
    depositor: &Pubkey,
    bump: u8,
    amount: u64,
) -> Vec<u8> {
    use omaha_vault::state::PendingDeposit;

    let mut data = vec![0u8; PendingDeposit::LEN];

    data[0] = 2; // PENDING_DEPOSIT_DISCRIMINATOR
    data[1] = bump;
    // _padding at [2..8] = zeroed
    data[8..40].copy_from_slice(vault_state.as_ref());
    data[40..72].copy_from_slice(depositor.as_ref());
    data[72..80].copy_from_slice(&amount.to_le_bytes());

    data
}

/// Create a pending deposit account owned by the program with the given data.
pub fn make_pending_deposit_account(data: Vec<u8>) -> Account {
    Account {
        lamports: 1_000_000_000,
        data,
        owner: program_id(),
        executable: false,
        rent_epoch: 0,
    }
}
