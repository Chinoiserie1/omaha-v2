use mollusk_svm::Mollusk;
use solana_account::Account;
use solana_instruction::{AccountMeta, Instruction};
use solana_pubkey::Pubkey;

use omaha_vault::state::{VaultState, VAULT_DISCRIMINATOR};

/// SPL Token program ID (legacy — for base token operations).
pub const TOKEN_PROGRAM_ID: Pubkey =
    solana_pubkey::pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

/// SPL Token 2022 program ID (for share token operations).
pub const TOKEN_2022_PROGRAM_ID: Pubkey =
    solana_pubkey::pubkey!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

/// System program ID.
pub const SYSTEM_PROGRAM_ID: Pubkey =
    solana_pubkey::pubkey!("11111111111111111111111111111111");

/// The program ID matching `declare_id!` in lib.rs.
pub fn program_id() -> Pubkey {
    "5yY17NisfXbyjanUEBxrdKsSCuRiWcjzEt6LXGZqDiVR"
        .parse()
        .unwrap()
}

/// The program authority matching `PROGRAM_AUTHORITY` in lib.rs.
pub fn program_authority() -> Pubkey {
    "9hLNRfyFw32aU6xyKZHSUSJt3N2QC9oen8HDqPyJ3Ryf"
        .parse()
        .unwrap()
}

/// Create a Mollusk instance with the vault program loaded.
pub fn setup() -> Mollusk {
    let pid = program_id();
    Mollusk::new(&pid, "omaha_vault")
}

/// Create a Mollusk instance with vault + legacy SPL Token programs loaded.
pub fn setup_with_token() -> Mollusk {
    let mut mollusk = setup();
    mollusk_svm_programs_token::token::add_program(&mut mollusk);
    mollusk
}

/// Create a Mollusk instance with vault + Token 2022 programs loaded.
pub fn setup_with_token2022() -> Mollusk {
    let mut mollusk = setup();
    mollusk_svm_programs_token::token2022::add_program(&mut mollusk);
    mollusk
}

/// Create a Mollusk instance with vault + legacy SPL Token + Token 2022 programs loaded.
pub fn setup_with_both_tokens() -> Mollusk {
    let mut mollusk = setup();
    mollusk_svm_programs_token::token::add_program(&mut mollusk);
    mollusk_svm_programs_token::token2022::add_program(&mut mollusk);
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
///
/// Fee fields default to 0 (no fees). Use `set_vault_fees` to configure fees.
///
/// New layout (488 bytes):
///   [0]       discriminator
///   [1]       bump
///   [2]       share_decimals
///   [3]       num_owners
///   [4..6]    entry_fee_bps (u16 LE)
///   [6..8]    exit_fee_bps (u16 LE)
///   [8..10]   management_fee_bps (u16 LE)
///   [10..12]  performance_fee_bps (u16 LE)
///   [12..16]  _padding
///   [16..48]  admin
///   [48..80]  share_mint
///   [80..112] base_mint
///   [112..144] fee_receiver
///   [144..152] share_price (u64 LE)
///   [152..160] high_water_mark (u64 LE)
///   [160..168] last_fee_timestamp (i64 LE)
///   [168..488] owners (10 × 32 bytes)
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

    data[0] = VAULT_DISCRIMINATOR;
    data[1] = bump;
    data[2] = share_decimals;
    data[3] = owners.len() as u8;
    // fee BPS at [4..12] = 0 (no fees by default)
    // _padding at [12..16] = 0

    data[16..48].copy_from_slice(admin.as_ref());
    data[48..80].copy_from_slice(share_mint.as_ref());
    data[80..112].copy_from_slice(base_mint.as_ref());
    // fee_receiver at [112..144] = 0 (no fee receiver)
    data[144..152].copy_from_slice(&share_price.to_le_bytes());
    // high_water_mark at [152..160] defaults to share_price
    data[152..160].copy_from_slice(&share_price.to_le_bytes());
    // last_fee_timestamp at [160..168] = 0

    for (i, owner) in owners.iter().enumerate() {
        let offset = 168 + i * 32;
        data[offset..offset + 32].copy_from_slice(owner.as_ref());
    }

    data
}

/// Set fee parameters on raw vault state data.
pub fn set_vault_fees(
    data: &mut [u8],
    entry_fee_bps: u16,
    exit_fee_bps: u16,
    management_fee_bps: u16,
    performance_fee_bps: u16,
    fee_receiver: &Pubkey,
    high_water_mark: u64,
    last_fee_timestamp: i64,
) {
    data[4..6].copy_from_slice(&entry_fee_bps.to_le_bytes());
    data[6..8].copy_from_slice(&exit_fee_bps.to_le_bytes());
    data[8..10].copy_from_slice(&management_fee_bps.to_le_bytes());
    data[10..12].copy_from_slice(&performance_fee_bps.to_le_bytes());
    data[112..144].copy_from_slice(fee_receiver.as_ref());
    data[152..160].copy_from_slice(&high_water_mark.to_le_bytes());
    data[160..168].copy_from_slice(&last_fee_timestamp.to_le_bytes());
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

/// Build Initialize instruction data:
/// [disc=0x00] [share_decimals: u8] [share_price: u64 LE] [name_len: u16] [name] [symbol_len: u16] [symbol] [uri_len: u16] [uri]
pub fn initialize_data(
    share_decimals: u8,
    share_price: u64,
    name: &[u8],
    symbol: &[u8],
    uri: &[u8],
) -> Vec<u8> {
    let mut data = vec![0x00, share_decimals];
    data.extend_from_slice(&share_price.to_le_bytes());
    data.extend_from_slice(&(name.len() as u16).to_le_bytes());
    data.extend_from_slice(name);
    data.extend_from_slice(&(symbol.len() as u16).to_le_bytes());
    data.extend_from_slice(symbol);
    data.extend_from_slice(&(uri.len() as u16).to_le_bytes());
    data.extend_from_slice(uri);
    data
}

/// Build WithdrawWithPrice instruction data: [disc=0x0A] [price: u64 LE] [shares: u64 LE].
pub fn withdraw_with_price_data(price: u64, shares: u64) -> Vec<u8> {
    let mut data = vec![0x0A];
    data.extend_from_slice(&price.to_le_bytes());
    data.extend_from_slice(&shares.to_le_bytes());
    data
}

/// Build RequestWithdraw instruction data: [disc=0x0B] [shares: u64 LE].
pub fn request_withdraw_data(shares: u64) -> Vec<u8> {
    let mut data = vec![0x0B];
    data.extend_from_slice(&shares.to_le_bytes());
    data
}

/// Build FulfillWithdraw instruction data: [disc=0x0C] [price: u64 LE].
pub fn fulfill_withdraw_data(price: u64) -> Vec<u8> {
    let mut data = vec![0x0C];
    data.extend_from_slice(&price.to_le_bytes());
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

/// Build AddOwner instruction data: [disc=0x01] [owner: 32 bytes].
pub fn add_owner_data(owner: &Pubkey) -> Vec<u8> {
    let mut data = vec![0x01];
    data.extend_from_slice(owner.as_ref());
    data
}

/// Build RemoveOwner instruction data: [disc=0x02] [owner: 32 bytes].
pub fn remove_owner_data(owner: &Pubkey) -> Vec<u8> {
    let mut data = vec![0x02];
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

/// Build UpdateFees instruction data:
/// [disc=0x05] [entry: u16] [exit: u16] [mgmt: u16] [perf: u16] [receiver: 32].
pub fn update_fees_data(
    entry_fee_bps: u16,
    exit_fee_bps: u16,
    management_fee_bps: u16,
    performance_fee_bps: u16,
    fee_receiver: &Pubkey,
) -> Vec<u8> {
    let mut data = vec![0x05];
    data.extend_from_slice(&entry_fee_bps.to_le_bytes());
    data.extend_from_slice(&exit_fee_bps.to_le_bytes());
    data.extend_from_slice(&management_fee_bps.to_le_bytes());
    data.extend_from_slice(&performance_fee_bps.to_le_bytes());
    data.extend_from_slice(fee_receiver.as_ref());
    data
}

/// Build CollectFees instruction data: [disc=0x06] [timestamp: i64 LE].
pub fn collect_fees_data(current_timestamp: i64) -> Vec<u8> {
    let mut data = vec![0x06];
    data.extend_from_slice(&current_timestamp.to_le_bytes());
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

    data[0] = 0xA2; // PENDING_DEPOSIT_DISCRIMINATOR
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

/// Derive pending withdraw PDA: seeds = ["pending_withdraw", vault_state, withdrawer].
pub fn pending_withdraw_pda(vault_state: &Pubkey, withdrawer: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"pending_withdraw", vault_state.as_ref(), withdrawer.as_ref()],
        &program_id(),
    )
}

/// Create raw PendingWithdraw bytes with the given parameters.
pub fn create_pending_withdraw_data(
    vault_state: &Pubkey,
    withdrawer: &Pubkey,
    bump: u8,
    shares: u64,
) -> Vec<u8> {
    use omaha_vault::state::PendingWithdraw;

    let mut data = vec![0u8; PendingWithdraw::LEN];

    data[0] = 0xA3; // PENDING_WITHDRAW_DISCRIMINATOR
    data[1] = bump;
    // _padding at [2..8] = zeroed
    data[8..40].copy_from_slice(vault_state.as_ref());
    data[40..72].copy_from_slice(withdrawer.as_ref());
    data[72..80].copy_from_slice(&shares.to_le_bytes());

    data
}

/// Create a pending withdraw account owned by the program with the given data.
pub fn make_pending_withdraw_account(data: Vec<u8>) -> Account {
    Account {
        lamports: 1_000_000_000,
        data,
        owner: program_id(),
        executable: false,
        rent_epoch: 0,
    }
}

/// Create a Token 2022 mint account (no extensions, legacy-compatible 82-byte format).
///
/// Token 2022 accepts the standard 82-byte mint layout (same as legacy SPL Token)
/// when the account has no extensions. No AccountType byte needed.
pub fn create_token2022_mint(
    authority: &Pubkey,
    decimals: u8,
    supply: u64,
    _name: &[u8],
    _symbol: &[u8],
    _uri: &[u8],
) -> Account {
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
        owner: TOKEN_2022_PROGRAM_ID,
        executable: false,
        rent_epoch: 0,
    }
}

/// Create a Token 2022 token account (ATA) for share tokens.
///
/// Token 2022 accepts the standard 165-byte token account layout (same as legacy
/// SPL Token) when the account has no extensions. No AccountType byte needed.
pub fn create_token2022_token_account(
    mint: &Pubkey,
    owner: &Pubkey,
    amount: u64,
) -> Account {
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
        owner: TOKEN_2022_PROGRAM_ID,
        executable: false,
        rent_epoch: 0,
    }
}
