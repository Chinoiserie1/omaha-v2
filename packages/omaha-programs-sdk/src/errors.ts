/** Custom error codes for the vault program (0x100–0x11C). */
export enum VaultErrorCode {
  Unauthorized = 0x100,
  InvalidSharePrice = 0x101,
  InvalidAmount = 0x102,
  OperatorsFull = 0x103,
  OperatorNotFound = 0x104,
  InvalidDiscriminator = 0x105,
  MathOverflow = 0x106,
  InsufficientFunds = 0x107,
  DuplicateOperator = 0x108,
  InvalidPendingDeposit = 0x109,
  InvalidPendingWithdraw = 0x10a,
  FeeExceedsMaximum = 0x10b,
  NoFeesToCollect = 0x10c,
  InvalidMetadata = 0x10d,
  UnauthorizedInitializer = 0x10e,
  InvalidVaultName = 0x10f,
  VaultPaused = 0x110,
  FactoryPaused = 0x111,
  InvalidFactory = 0x112,
  FactoryAdminsFull = 0x113,
  FactoryAdminNotFound = 0x114,
  DuplicateFactoryAdmin = 0x115,
  NoPendingAdmin = 0x116,
  InvalidPendingAdmin = 0x117,
  PendingNotExpired = 0x118,
  ZeroPubkey = 0x119,
  NoPendingOwner = 0x11a,
  InvalidPendingOwner = 0x11b,
  UnauthorizedVaultCreator = 0x11c,
}

/** @deprecated Use VaultErrorCode.OperatorsFull */
export const OwnersFull = VaultErrorCode.OperatorsFull;
/** @deprecated Use VaultErrorCode.OperatorNotFound */
export const OwnerNotFound = VaultErrorCode.OperatorNotFound;
/** @deprecated Use VaultErrorCode.DuplicateOperator */
export const DuplicateOwner = VaultErrorCode.DuplicateOperator;

const ERROR_MESSAGES: Record<number, string> = {
  [VaultErrorCode.Unauthorized]: "Signer is not the vault admin",
  [VaultErrorCode.InvalidSharePrice]:
    "Share price must be greater than zero",
  [VaultErrorCode.InvalidAmount]:
    "Deposit or withdraw amount must be greater than zero",
  [VaultErrorCode.OperatorsFull]: "Operator list is full (max 10)",
  [VaultErrorCode.OperatorNotFound]: "Operator not found",
  [VaultErrorCode.InvalidDiscriminator]: "Account has wrong discriminator",
  [VaultErrorCode.MathOverflow]:
    "Arithmetic overflow during share calculation",
  [VaultErrorCode.InsufficientFunds]:
    "Vault has insufficient base-token balance",
  [VaultErrorCode.DuplicateOperator]: "Duplicate operator",
  [VaultErrorCode.InvalidPendingDeposit]:
    "Pending deposit account has wrong discriminator or is invalid",
  [VaultErrorCode.InvalidPendingWithdraw]:
    "Pending withdraw account has wrong discriminator or is invalid",
  [VaultErrorCode.FeeExceedsMaximum]:
    "Fee basis points exceed the allowed maximum",
  [VaultErrorCode.NoFeesToCollect]: "No accrued fees to collect",
  [VaultErrorCode.InvalidMetadata]: "Metadata string exceeds max length",
  [VaultErrorCode.UnauthorizedInitializer]:
    "Signer is not the program authority (cannot initialize vaults)",
  [VaultErrorCode.InvalidVaultName]: "Vault name is empty or exceeds 32 bytes",
  [VaultErrorCode.VaultPaused]: "Vault is paused",
  [VaultErrorCode.FactoryPaused]: "Factory is paused",
  [VaultErrorCode.InvalidFactory]: "Invalid factory account",
  [VaultErrorCode.FactoryAdminsFull]: "Factory admin list is full (max 10)",
  [VaultErrorCode.FactoryAdminNotFound]: "Factory admin not found",
  [VaultErrorCode.DuplicateFactoryAdmin]: "Duplicate factory admin",
  [VaultErrorCode.NoPendingAdmin]: "No vault admin transfer in progress",
  [VaultErrorCode.InvalidPendingAdmin]: "Signer does not match pending admin",
  [VaultErrorCode.PendingNotExpired]:
    "Pending deposit/withdraw has not expired (48h required)",
  [VaultErrorCode.ZeroPubkey]: "Cannot use zero pubkey",
  [VaultErrorCode.NoPendingOwner]: "No factory owner transfer in progress",
  [VaultErrorCode.InvalidPendingOwner]:
    "Signer does not match pending owner",
  [VaultErrorCode.UnauthorizedVaultCreator]:
    "Signer is not factory owner or factory admin",
};

/**
 * Parse a vault program custom error code into a human-readable message.
 * Returns null if the code is not a recognized vault error.
 */
export function parseVaultError(code: number): string | null {
  return ERROR_MESSAGES[code] ?? null;
}
