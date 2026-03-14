// Constants
export {
  VAULT_PROGRAM_ID,
  PROGRAM_AUTHORITY,
  DISC_INITIALIZE,
  DISC_ADD_OWNER,
  DISC_REMOVE_OWNER,
  DISC_SET_SHARE_PRICE,
  DISC_EXECUTE,
  DISC_UPDATE_FEES,
  DISC_COLLECT_FEES,
  DISC_DEPOSIT_WITH_PRICE,
  DISC_REQUEST_DEPOSIT,
  DISC_FULFILL_DEPOSIT,
  DISC_WITHDRAW_WITH_PRICE,
  DISC_REQUEST_WITHDRAW,
  DISC_FULFILL_WITHDRAW,
  VAULT_DISCRIMINATOR,
  PENDING_DEPOSIT_DISCRIMINATOR,
  PENDING_WITHDRAW_DISCRIMINATOR,
  VAULT_STATE_SIZE,
  PENDING_DEPOSIT_SIZE,
  PENDING_WITHDRAW_SIZE,
  MAX_OWNERS,
  SPL_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  BPS_DENOMINATOR,
  SECONDS_PER_YEAR,
  MAX_ENTRY_EXIT_FEE_BPS,
  MAX_MANAGEMENT_FEE_BPS,
  MAX_PERFORMANCE_FEE_BPS,
} from "./constants.js";

// PDA derivation
export {
  findVaultStatePda,
  findShareMintPda,
  findPendingDepositPda,
  findPendingWithdrawPda,
} from "./pda.js";

// State deserialization
export {
  deserializeVaultState,
  deserializePendingDeposit,
  deserializePendingWithdraw,
} from "./state/index.js";
export type {
  VaultState,
  PendingDeposit,
  PendingWithdraw,
} from "./state/index.js";

// Instruction builders
export {
  createInitializeInstruction,
  createAddOwnerInstruction,
  createRemoveOwnerInstruction,
  createSetSharePriceInstruction,
  createExecuteInstruction,
  createUpdateFeesInstruction,
  createCollectFeesInstruction,
  createDepositWithPriceInstruction,
  createRequestDepositInstruction,
  createFulfillDepositInstruction,
  createWithdrawWithPriceInstruction,
  createRequestWithdrawInstruction,
  createFulfillWithdrawInstruction,
} from "./instructions/index.js";
export type {
  InitializeParams,
  AddOwnerParams,
  RemoveOwnerParams,
  SetSharePriceParams,
  ExecuteParams,
  UpdateFeesParams,
  CollectFeesParams,
  DepositWithPriceParams,
  RequestDepositParams,
  FulfillDepositParams,
  WithdrawWithPriceParams,
  RequestWithdrawParams,
  FulfillWithdrawParams,
} from "./instructions/index.js";

// Fee math
export {
  applyFee,
  managementFeeShares,
  performanceFeeShares,
  validateFeeBps,
} from "./fees.js";

// Errors
export { VaultErrorCode, parseVaultError } from "./errors.js";
