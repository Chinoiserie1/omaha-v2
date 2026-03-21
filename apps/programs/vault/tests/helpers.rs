use mollusk_svm::Mollusk;
use solana_account::Account;
use solana_instruction::{AccountMeta, Instruction};
use solana_pubkey::Pubkey;

use omaha_vault::state::{VaultState, FactoryState, PendingDeposit, PendingWithdraw,
    VAULT_DISCRIMINATOR, FACTORY_DISCRIMINATOR, PENDING_DEPOSIT_DISCRIMINATOR,
    PENDING_WITHDRAW_DISCRIMINATOR};

/// SPL Token program ID (legacy — for base token operations).
pub const TOKEN_PROGRAM_ID: Pubkey =
    solana_pubkey::pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

/// SPL Token 2022 program ID (for share token operations).
pub const TOKEN_2022_PROGRAM_ID: Pubkey =
    solana_pubkey::pubkey!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

/// System program ID.
pub const SYSTEM_PROGRAM_ID: Pubkey =
    solana_pubkey::pubkey!("11111111111111111111111111111111");

/// Clock sysvar ID.
pub const CLOCK_SYSVAR_ID: Pubkey =
    solana_pubkey::pubkey!("SysvarC1ock11111111111111111111111111111111");

/// The program ID matching `declare_id!` in lib.rs.
pub fn program_id() -> Pubkey {
    "2jPr4HDqnzyHdEvwxJxq7NAmt67mEnmHyxhHtV1Cwz8C"
        .parse()
        .unwrap()
}

/// The program authority matching `PROGRAM_AUTHORITY` in lib.rs.
pub fn program_authority() -> Pubkey {
    "FZdLXHrkoFVyLcsmQ88TS3w9XKqkku1jFhpMaLkrNCqw"
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

// ── PDA Derivation ──────────────────────────────────────────────────

/// Derive factory PDA: seeds = ["factory"].
pub fn factory_pda() -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"factory"], &program_id())
}

/// Derive vault PDA: seeds = ["vault", vault_name].
pub fn vault_pda(vault_name: &[u8]) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"vault", vault_name],
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

/// Derive pending deposit PDA: seeds = ["pending_deposit", vault_state, depositor].
pub fn pending_deposit_pda(vault_state: &Pubkey, depositor: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"pending_deposit", vault_state.as_ref(), depositor.as_ref()],
        &program_id(),
    )
}

/// Derive pending withdraw PDA: seeds = ["pending_withdraw", vault_state, withdrawer].
pub fn pending_withdraw_pda(vault_state: &Pubkey, withdrawer: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"pending_withdraw", vault_state.as_ref(), withdrawer.as_ref()],
        &program_id(),
    )
}

// ── Account Builders ────────────────────────────────────────────────

/// Create raw FactoryState bytes.
///
/// Layout (400 bytes):
///   [0]       discriminator (0xA4)
///   [1]       bump
///   [2]       is_paused
///   [3]       num_admins
///   [4..8]    _padding
///   [8..40]   owner
///   [40..72]  pending_owner
///   [72..80]  vault_count (u64 LE)
///   [80..400] admins (10 × 32 bytes)
pub fn create_factory_state_data(
    owner: &Pubkey,
    bump: u8,
    admins: &[Pubkey],
) -> Vec<u8> {
    let mut data = vec![0u8; FactoryState::LEN];

    data[0] = FACTORY_DISCRIMINATOR;
    data[1] = bump;
    // is_paused = 0, num_admins set below
    data[3] = admins.len() as u8;
    data[8..40].copy_from_slice(owner.as_ref());
    // pending_owner at [40..72] = 0
    // vault_count at [72..80] = 0

    for (i, admin) in admins.iter().enumerate() {
        let offset = 80 + i * 32;
        data[offset..offset + 32].copy_from_slice(admin.as_ref());
    }

    data
}

/// Create raw VaultState bytes with the given parameters.
///
/// Layout (584 bytes):
///   [0]         discriminator (0xA1)
///   [1]         bump
///   [2]         share_decimals
///   [3]         num_operators
///   [4..6]      entry_fee_bps (u16 LE)
///   [6..8]      exit_fee_bps (u16 LE)
///   [8..10]     management_fee_bps (u16 LE)
///   [10..12]    performance_fee_bps (u16 LE)
///   [12]        vault_name_len
///   [13]        is_paused
///   [14..16]    _padding
///   [16..48]    admin
///   [48..80]    pending_admin
///   [80..112]   share_mint
///   [112..144]  base_mint
///   [144..176]  fee_receiver
///   [176..208]  factory
///   [208..216]  share_price (u64 LE)
///   [216..224]  high_water_mark (u64 LE)
///   [224..232]  last_fee_timestamp (i64 LE)
///   [232..552]  operators (10 × 32 bytes)
///   [552..584]  vault_name (32 bytes)
pub fn create_vault_state_data(
    admin: &Pubkey,
    base_mint: &Pubkey,
    share_mint: &Pubkey,
    bump: u8,
    share_decimals: u8,
    share_price: u64,
    operators: &[Pubkey],
    vault_name: &[u8],
) -> Vec<u8> {
    let mut data = vec![0u8; VaultState::LEN];

    data[0] = VAULT_DISCRIMINATOR;
    data[1] = bump;
    data[2] = share_decimals;
    data[3] = operators.len() as u8;
    // fee BPS at [4..12] = 0 (no fees by default)
    data[12] = vault_name.len() as u8;
    // is_paused at [13] = 0
    // _padding at [14..16] = 0

    data[16..48].copy_from_slice(admin.as_ref());
    // pending_admin at [48..80] = 0
    data[80..112].copy_from_slice(share_mint.as_ref());
    data[112..144].copy_from_slice(base_mint.as_ref());
    // fee_receiver at [144..176] = 0
    // factory at [176..208] = 0
    data[208..216].copy_from_slice(&share_price.to_le_bytes());
    // high_water_mark defaults to share_price
    data[216..224].copy_from_slice(&share_price.to_le_bytes());
    // last_fee_timestamp at [224..232] = 0

    for (i, operator) in operators.iter().enumerate() {
        let offset = 232 + i * 32;
        data[offset..offset + 32].copy_from_slice(operator.as_ref());
    }

    // vault_name at [552..584]
    let vn_len = vault_name.len().min(32);
    data[552..552 + vn_len].copy_from_slice(&vault_name[..vn_len]);

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
    data[144..176].copy_from_slice(fee_receiver.as_ref());
    data[216..224].copy_from_slice(&high_water_mark.to_le_bytes());
    data[224..232].copy_from_slice(&last_fee_timestamp.to_le_bytes());
}

/// Set factory reference on raw vault state data.
pub fn set_vault_factory(data: &mut [u8], factory: &Pubkey) {
    data[176..208].copy_from_slice(factory.as_ref());
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

/// Create a factory state account owned by the program with the given data.
pub fn make_factory_account(data: Vec<u8>) -> Account {
    Account {
        lamports: 1_000_000_000,
        data,
        owner: program_id(),
        executable: false,
        rent_epoch: 0,
    }
}

// ── Instruction Data Builders ───────────────────────────────────────

/// Build an instruction for the vault program.
pub fn build_instruction(
    data: Vec<u8>,
    account_metas: Vec<AccountMeta>,
) -> Instruction {
    Instruction::new_with_bytes(program_id(), &data, account_metas)
}

/// Build Initialize instruction data.
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

/// Build AddOperator instruction data: [disc=0x01] [operator: 32 bytes].
pub fn add_operator_data(operator: &Pubkey) -> Vec<u8> {
    let mut data = vec![0x01];
    data.extend_from_slice(operator.as_ref());
    data
}

/// Build RemoveOperator instruction data: [disc=0x02] [operator: 32 bytes].
pub fn remove_operator_data(operator: &Pubkey) -> Vec<u8> {
    let mut data = vec![0x02];
    data.extend_from_slice(operator.as_ref());
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

/// Build UpdateFees instruction data.
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

/// Build CollectFees instruction data: [disc=0x06] (no data — uses clock sysvar).
pub fn collect_fees_data() -> Vec<u8> {
    vec![0x06]
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

/// Build InitializeFactory instruction data: [disc=0x0D].
pub fn initialize_factory_data() -> Vec<u8> {
    vec![0x0D]
}

/// Build AddFactoryAdmin instruction data: [disc=0x0E] [admin: 32 bytes].
pub fn add_factory_admin_data(admin: &Pubkey) -> Vec<u8> {
    let mut data = vec![0x0E];
    data.extend_from_slice(admin.as_ref());
    data
}

/// Build RemoveFactoryAdmin instruction data: [disc=0x0F] [admin: 32 bytes].
pub fn remove_factory_admin_data(admin: &Pubkey) -> Vec<u8> {
    let mut data = vec![0x0F];
    data.extend_from_slice(admin.as_ref());
    data
}

/// Build TransferFactoryOwnership instruction data: [disc=0x10] [new_owner: 32 bytes].
pub fn transfer_factory_ownership_data(new_owner: &Pubkey) -> Vec<u8> {
    let mut data = vec![0x10];
    data.extend_from_slice(new_owner.as_ref());
    data
}

/// Build AcceptFactoryOwnership instruction data: [disc=0x11].
pub fn accept_factory_ownership_data() -> Vec<u8> {
    vec![0x11]
}

/// Set pending_owner on raw factory state data.
pub fn set_factory_pending_owner(data: &mut [u8], pending_owner: &Pubkey) {
    data[40..72].copy_from_slice(pending_owner.as_ref());
}

/// Build TransferVaultAdmin instruction data: [disc=0x14] [new_admin: 32 bytes].
pub fn transfer_vault_admin_data(new_admin: &Pubkey) -> Vec<u8> {
    let mut data = vec![0x14];
    data.extend_from_slice(new_admin.as_ref());
    data
}

/// Build AcceptVaultAdmin instruction data: [disc=0x15].
pub fn accept_vault_admin_data() -> Vec<u8> {
    vec![0x15]
}

/// Build PauseVault instruction data: [disc=0x16].
pub fn pause_vault_data() -> Vec<u8> {
    vec![0x16]
}

/// Build UnpauseVault instruction data: [disc=0x17].
pub fn unpause_vault_data() -> Vec<u8> {
    vec![0x17]
}

/// Build PauseFactory instruction data: [disc=0x12].
pub fn pause_factory_data() -> Vec<u8> {
    vec![0x12]
}

/// Build UnpauseFactory instruction data: [disc=0x13].
pub fn unpause_factory_data() -> Vec<u8> {
    vec![0x13]
}

/// Build CancelDeposit instruction data: [disc=0x18].
pub fn cancel_deposit_data() -> Vec<u8> {
    vec![0x18]
}

/// Build CancelWithdraw instruction data: [disc=0x19].
pub fn cancel_withdraw_data() -> Vec<u8> {
    vec![0x19]
}

/// Set is_paused flag on raw vault state data (offset 13).
pub fn set_vault_paused(data: &mut [u8], paused: bool) {
    data[13] = if paused { 1 } else { 0 };
}

/// Set is_paused flag on raw factory state data (offset 2).
pub fn set_factory_paused(data: &mut [u8], paused: bool) {
    data[2] = if paused { 1 } else { 0 };
}

// ── Pending State Builders ──────────────────────────────────────────

/// Create raw PendingDeposit bytes (88 bytes).
///
/// Layout:
///   [0]       discriminator (0xA2)
///   [1]       bump
///   [2..4]    entry_fee_bps (u16 LE)
///   [4..8]    _padding
///   [8..40]   vault_state
///   [40..72]  depositor
///   [72..80]  amount (u64 LE)
///   [80..88]  created_at (i64 LE)
pub fn create_pending_deposit_data(
    vault_state: &Pubkey,
    depositor: &Pubkey,
    bump: u8,
    amount: u64,
) -> Vec<u8> {
    let mut data = vec![0u8; PendingDeposit::LEN];

    data[0] = PENDING_DEPOSIT_DISCRIMINATOR;
    data[1] = bump;
    // entry_fee_bps at [2..4] = 0
    // _padding at [4..8] = 0
    data[8..40].copy_from_slice(vault_state.as_ref());
    data[40..72].copy_from_slice(depositor.as_ref());
    data[72..80].copy_from_slice(&amount.to_le_bytes());
    // created_at at [80..88] = 0

    data
}

/// Create raw PendingDeposit bytes with fee snapshot and timestamp.
pub fn create_pending_deposit_data_with_fees(
    vault_state: &Pubkey,
    depositor: &Pubkey,
    bump: u8,
    amount: u64,
    entry_fee_bps: u16,
    created_at: i64,
) -> Vec<u8> {
    let mut data = create_pending_deposit_data(vault_state, depositor, bump, amount);
    data[2..4].copy_from_slice(&entry_fee_bps.to_le_bytes());
    data[80..88].copy_from_slice(&created_at.to_le_bytes());
    data
}

/// Create a pending deposit account owned by the program.
pub fn make_pending_deposit_account(data: Vec<u8>) -> Account {
    Account {
        lamports: 1_000_000_000,
        data,
        owner: program_id(),
        executable: false,
        rent_epoch: 0,
    }
}

/// Create raw PendingWithdraw bytes (88 bytes).
///
/// Layout:
///   [0]       discriminator (0xA3)
///   [1]       bump
///   [2..4]    exit_fee_bps (u16 LE)
///   [4..8]    _padding
///   [8..40]   vault_state
///   [40..72]  withdrawer
///   [72..80]  shares (u64 LE)
///   [80..88]  created_at (i64 LE)
pub fn create_pending_withdraw_data(
    vault_state: &Pubkey,
    withdrawer: &Pubkey,
    bump: u8,
    shares: u64,
) -> Vec<u8> {
    let mut data = vec![0u8; PendingWithdraw::LEN];

    data[0] = PENDING_WITHDRAW_DISCRIMINATOR;
    data[1] = bump;
    // exit_fee_bps at [2..4] = 0
    // _padding at [4..8] = 0
    data[8..40].copy_from_slice(vault_state.as_ref());
    data[40..72].copy_from_slice(withdrawer.as_ref());
    data[72..80].copy_from_slice(&shares.to_le_bytes());
    // created_at at [80..88] = 0

    data
}

/// Create raw PendingWithdraw bytes with fee snapshot and timestamp.
pub fn create_pending_withdraw_data_with_fees(
    vault_state: &Pubkey,
    withdrawer: &Pubkey,
    bump: u8,
    shares: u64,
    exit_fee_bps: u16,
    created_at: i64,
) -> Vec<u8> {
    let mut data = create_pending_withdraw_data(vault_state, withdrawer, bump, shares);
    data[2..4].copy_from_slice(&exit_fee_bps.to_le_bytes());
    data[80..88].copy_from_slice(&created_at.to_le_bytes());
    data
}

/// Create a pending withdraw account owned by the program.
pub fn make_pending_withdraw_account(data: Vec<u8>) -> Account {
    Account {
        lamports: 1_000_000_000,
        data,
        owner: program_id(),
        executable: false,
        rent_epoch: 0,
    }
}

// ── Token Account Builders ──────────────────────────────────────────

/// Create a Token 2022 mint account (no extensions, legacy-compatible 82-byte format).
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

/// Create a Clock sysvar account with the given unix_timestamp.
///
/// Layout: slot(8) + epoch_start_timestamp(8) + epoch(8) + leader_schedule_epoch(8) + unix_timestamp(8)
pub fn create_clock_account(unix_timestamp: i64) -> Account {
    let mut data = vec![0u8; 40];
    // unix_timestamp at offset 32
    data[32..40].copy_from_slice(&unix_timestamp.to_le_bytes());

    Account {
        lamports: 1,
        data,
        owner: solana_pubkey::pubkey!("Sysvar1111111111111111111111111111111111111"),
        executable: false,
        rent_epoch: 0,
    }
}

// ── Result Extraction Helper ──────────────────────────────────────

/// Extract an account from `InstructionResult::resulting_accounts` by pubkey.
pub fn extract_account(
    result: &mollusk_svm::result::InstructionResult,
    key: &Pubkey,
) -> Account {
    result
        .resulting_accounts
        .iter()
        .find(|(k, _)| k == key)
        .unwrap()
        .1
        .clone()
}

/// Read a u64 from a byte slice at the given offset (little-endian).
pub fn read_u64(data: &[u8], offset: usize) -> u64 {
    u64::from_le_bytes(data[offset..offset + 8].try_into().unwrap())
}
