import {
  createInitializeInstruction,
  findVaultStatePda,
  findShareMintPda,
} from "@repo/omaha-programs-sdk";
import { getKeeper, getProgramAuthority, USDC_MINT } from "./config.js";
import { buildAndSendVersionedTx } from "./tx.js";
import { logger } from "../utils/logger.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

const INITIAL_SHARE_PRICE = 1_000_000n; // $1.00 in 6-decimal base token

/**
 * Create a new custom vault for a Quant.
 */
export async function createQuantVault(
  quantUsername: string
): Promise<{ txSig: string; statePda: string; shareMint: string; baseTokenAta: string }> {
  const keeper = getKeeper();
  const programAuthority = getProgramAuthority();

  const vaultName = `quant-${quantUsername}`;
  const vaultSymbol = `Q-${quantUsername.slice(0, 6).toUpperCase()}`;

  // Derive PDAs
  const [vaultState] = findVaultStatePda(vaultName);
  const [shareMint] = findShareMintPda(vaultState);

  // Derive vault's USDC ATA (owned by vault state PDA)
  const baseTokenAta = await getAssociatedTokenAddress(
    USDC_MINT,
    vaultState,
    true, // allowOwnerOffCurve — PDA is off-curve
  );

  logger.info(
    {
      vaultName,
      vaultSymbol,
      admin: keeper.publicKey.toBase58(),
      vaultState: vaultState.toBase58(),
      shareMint: shareMint.toBase58(),
    },
    "Creating custom vault",
  );

  const initIx = createInitializeInstruction({
    programAuthority: programAuthority.publicKey,
    admin: keeper.publicKey,
    vaultState,
    shareMint,
    baseMint: USDC_MINT,
    shareDecimals: 6,
    sharePrice: INITIAL_SHARE_PRICE,
    name: vaultName,
    symbol: vaultSymbol,
    uri: "",
  });

  // buildAndSendVersionedTx signs with keeper by default;
  // we also need programAuthority to sign
  const txSig = await buildAndSendVersionedTx(
    [initIx],
    `Initialize vault: ${vaultName}`,
    [],
    [programAuthority],
  );

  logger.info(
    { txSig, statePda: vaultState.toBase58() },
    "Custom vault created",
  );

  return {
    txSig,
    statePda: vaultState.toBase58(),
    shareMint: shareMint.toBase58(),
    baseTokenAta: baseTokenAta.toBase58(),
  };
}
