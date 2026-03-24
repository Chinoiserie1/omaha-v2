import { PublicKey } from "@solana/web3.js";
import { createSetSharePriceInstruction, deserializeVaultState } from "@repo/omaha-programs-sdk";
import { buildAndSendVersionedTx } from "../solana/tx.js";
import { getConnection, getAdmin } from "../solana/config.js";
import { logger } from "../utils/logger.js";
import { fetchLivePrices } from "./live-price.service.js";

const USDC_DECIMALS = 6;
const SHARE_TOKEN_DECIMALS = 6;
const INITIAL_SHARE_PRICE = 1_000_000n; // 1:1 with USDC

/**
 * Compute current NAV-based share price using live prices from
 * Jupiter + Birdeye and update it on-chain via SetSharePrice (0x03).
 */
export async function updateSharePrice(statePda: PublicKey): Promise<string> {
  const connection = getConnection();
  const admin = getAdmin();

  const accountInfo = await connection.getAccountInfo(statePda);
  if (!accountInfo) {
    throw new Error(`Vault state not found: ${statePda.toBase58()}`);
  }
  const vaultState = deserializeVaultState(Buffer.from(accountInfo.data));

  // Get on-chain token accounts + share supply in parallel
  const [tokenAccounts, token2022Accounts, supplyResult] = await Promise.all([
    connection.getParsedTokenAccountsByOwner(statePda, {
      programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    }),
    connection.getParsedTokenAccountsByOwner(statePda, {
      programId: new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"),
    }),
    connection.getTokenSupply(vaultState.shareMint),
  ]);

  const allAccounts = [...tokenAccounts.value, ...token2022Accounts.value];
  const totalSupplyRaw = BigInt(supplyResult.value.amount);

  if (totalSupplyRaw === 0n) {
    logger.info("Zero supply — skipping share price update");
    return "";
  }

  // Collect mints + amounts from on-chain
  const holdings: { mint: string; uiAmount: number }[] = [];
  for (const account of allAccounts) {
    const parsed = account.account.data.parsed;
    if (parsed.type !== "account") continue;
    const info = parsed.info;
    const uiAmount: number = info.tokenAmount?.uiAmount ?? 0;
    if (uiAmount > 0) {
      holdings.push({ mint: info.mint, uiAmount });
    }
  }

  // Fetch live prices (Jupiter primary, Birdeye fallback)
  const prices = await fetchLivePrices(holdings.map((h) => h.mint));

  let totalEquityUsd = 0;
  const unpricedMints: string[] = [];
  for (const h of holdings) {
    const price = prices.get(h.mint);
    if (price !== undefined) {
      totalEquityUsd += h.uiAmount * price;
    } else {
      unpricedMints.push(h.mint);
    }
  }

  if (unpricedMints.length > 0) {
    throw new Error(
      `Cannot set share price: missing prices for ${unpricedMints.length} token(s): ${unpricedMints.join(", ")}`,
    );
  }

  if (totalEquityUsd <= 0) {
    throw new Error("Cannot set share price: TVL is zero");
  }

  const tvlInBaseRaw = BigInt(Math.round(totalEquityUsd * 10 ** USDC_DECIMALS));
  const computed = (tvlInBaseRaw * BigInt(10 ** SHARE_TOKEN_DECIMALS)) / totalSupplyRaw;
  const sharePrice = computed > 0n ? computed : INITIAL_SHARE_PRICE;

  const ix = createSetSharePriceInstruction({
    admin: admin.publicKey,
    vaultState: statePda,
    newSharePrice: sharePrice,
  });

  const txSig = await buildAndSendVersionedTx(
    [ix],
    "SetSharePrice post-rebalance",
  );

  logger.info(
    {
      txSig,
      sharePrice: sharePrice.toString(),
      tvlUsd: totalEquityUsd,
      totalSupplyRaw: totalSupplyRaw.toString(),
      pricedTokens: holdings.length - unpricedMints.length,
      totalTokens: holdings.length,
    },
    "Share price updated on-chain",
  );

  return txSig;
}
