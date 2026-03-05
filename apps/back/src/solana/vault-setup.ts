import { PublicKey } from "@solana/web3.js";
import {
  StateAccountType,
  type FeeStructure,
  getProgramAndBitflagByProtocolName,
} from "@glamsystems/glam-sdk";
import { getKeeper, USDC_MINT } from "./config.js";
import { getGlamClient, getGlamClientForCreation } from "./client.js";
import { logger } from "../utils/logger.js";

// ── Fee Structure ──────────────────────────────────────────────
const MANAGEMENT_FEE_BPS = 100; // 1% AUM annually
const PERFORMANCE_FEE_BPS = 1000; // 10% of profits

const VAULT_FEE_STRUCTURE: FeeStructure = {
  vault: { subscriptionFeeBps: 0, redemptionFeeBps: 0 },
  manager: { subscriptionFeeBps: 0, redemptionFeeBps: 0 },
  management: { feeBps: MANAGEMENT_FEE_BPS },
  performance: {
    feeBps: PERFORMANCE_FEE_BPS,
    hurdleRateBps: 0,
    hurdleType: { hard: {} },
  },
  protocol: { baseFeeBps: 0, flowFeeBps: 0 },
};

/**
 * Create a new GLAM tokenized vault for a Quant.
 */
export async function createQuantVault(
  quantUsername: string
): Promise<{ txSig: string; statePda: string }> {
  const client = getGlamClientForCreation();
  const keeper = getKeeper();

  const vaultName = `quant-${quantUsername}`;
  const vaultSymbol = `Q-${quantUsername.slice(0, 6).toUpperCase()}`;
  const nameBytes = Array.from(Buffer.from(vaultName));

  const initMintParams = {
    accountType: StateAccountType.TOKENIZED_VAULT,
    name: nameBytes,
    symbol: vaultSymbol,
    uri: "",
    baseAssetMint: USDC_MINT,
    decimals: 6,
    feeStructure: VAULT_FEE_STRUCTURE,
  };
  const stateParams = {
    assets: [USDC_MINT],
  };

  logger.info(
    { vaultName, vaultSymbol, keeper: keeper.publicKey.toBase58() },
    "Creating Quant vault"
  );

  const txSig = await client.mint.initializeWithStateParams(
    initMintParams,
    stateParams
  );

  const statePda = client.statePda.toBase58();
  logger.info({ txSig, statePda }, "Quant vault created");

  return { txSig, statePda };
}

/**
 * Enable JupiterSwap integration on a vault.
 */
export async function enableJupiterIntegration(
  statePda: PublicKey
): Promise<string> {
  const client = getGlamClient(statePda);
  const perms = getProgramAndBitflagByProtocolName();
  const entry = perms["JupiterSwap"];
  if (!entry) throw new Error("JupiterSwap not found in GLAM SDK permissions");

  const [jupProgram, jupBitflag] = entry;

  logger.info(
    { jupProgram, statePda: statePda.toBase58() },
    "Enabling JupiterSwap on vault"
  );

  const txSig = await client.access.enableProtocols(
    new PublicKey(jupProgram),
    parseInt(jupBitflag, 2)
  );

  logger.info({ txSig }, "JupiterSwap enabled");
  return txSig;
}

/**
 * Update the vault's allowed assets list to include the given mints.
 */
export async function allowlistTokensOnVault(
  statePda: PublicKey,
  mints: PublicKey[]
): Promise<void> {
  const client = getGlamClient(statePda);
  const allAssets = [USDC_MINT, ...mints];

  logger.info(
    { count: allAssets.length, statePda: statePda.toBase58() },
    "Updating vault asset allowlist"
  );

  await client.state.update({ assets: allAssets });
  logger.info("Vault asset allowlist updated");
}
