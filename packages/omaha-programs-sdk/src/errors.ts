/** Custom error codes for the vault program (0x100–0x10D). */
export enum VaultErrorCode {
  Unauthorized = 0x100,
  InvalidSharePrice = 0x101,
  InvalidAmount = 0x102,
  OwnersFull = 0x103,
  OwnerNotFound = 0x104,
  InvalidDiscriminator = 0x105,
  MathOverflow = 0x106,
  InsufficientFunds = 0x107,
  DuplicateOwner = 0x108,
  InvalidPendingDeposit = 0x109,
  InvalidPendingWithdraw = 0x10a,
  FeeExceedsMaximum = 0x10b,
  NoFeesToCollect = 0x10c,
  InvalidMetadata = 0x10d,
}

const ERROR_MESSAGES: Record<number, string> = {
  [VaultErrorCode.Unauthorized]: "Signer is not the vault admin",
  [VaultErrorCode.InvalidSharePrice]:
    "Share price must be greater than zero",
  [VaultErrorCode.InvalidAmount]:
    "Deposit or withdraw amount must be greater than zero",
  [VaultErrorCode.OwnersFull]: "Owner list is full (max 10)",
  [VaultErrorCode.OwnerNotFound]: "Owner not found",
  [VaultErrorCode.InvalidDiscriminator]: "Vault account has wrong discriminator",
  [VaultErrorCode.MathOverflow]:
    "Arithmetic overflow during share calculation",
  [VaultErrorCode.InsufficientFunds]:
    "Vault has insufficient base-token balance",
  [VaultErrorCode.DuplicateOwner]: "Duplicate owner",
  [VaultErrorCode.InvalidPendingDeposit]:
    "Pending deposit account has wrong discriminator or is invalid",
  [VaultErrorCode.InvalidPendingWithdraw]:
    "Pending withdraw account has wrong discriminator or is invalid",
  [VaultErrorCode.FeeExceedsMaximum]:
    "Fee basis points exceed the allowed maximum",
  [VaultErrorCode.NoFeesToCollect]: "No accrued fees to collect",
  [VaultErrorCode.InvalidMetadata]: "Metadata string exceeds max length",
};

/**
 * Parse a vault program custom error code into a human-readable message.
 * Returns null if the code is not a recognized vault error.
 */
export function parseVaultError(code: number): string | null {
  return ERROR_MESSAGES[code] ?? null;
}
