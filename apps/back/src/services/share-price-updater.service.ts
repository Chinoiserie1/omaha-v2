import axios from "axios";
import { PublicKey } from "@solana/web3.js";
import { createSetSharePriceInstruction, deserializeVaultState } from "@repo/omaha-programs-sdk";
import { buildAndSendVersionedTx } from "../solana/tx.js";
import { getConnection, getAdmin } from "../solana/config.js";
import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";

const JUPITER_PRICE_URL = "https://api.jup.ag/price/v3";
const BIRDEYE_PRICE_URL = "https://public-api.birdeye.so/defi/multi_price";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS = 6;
const SHARE_TOKEN_DECIMALS = 6;
const INITIAL_SHARE_PRICE = 1_000_000n; // 1:1 with USDC

interface JupiterPriceData {
  [mint: string]: { usdPrice: number } | undefined;
}

interface BirdeyePriceResponse {
  data: Record<string, { value: number } | undefined>;
}

/**
 * Fetch live prices from Jupiter Price API (primary source).
 */
async function fetchJupiterPrices(mints: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  try {
    const { data } = await axios.get<JupiterPriceData>(JUPITER_PRICE_URL, {
      params: { ids: mints.join(",") },
      headers: { "x-api-key": env.JUPITER_API_KEY },
      timeout: 10_000,
    });
    for (const mint of mints) {
      const entry = data[mint];
      if (entry) prices.set(mint, entry.usdPrice);
    }
  } catch (err) {
    logger.warn(
      { error: err instanceof Error ? err.message : err },
      "Jupiter price fetch failed, will try Birdeye",
    );
  }
  return prices;
}

/**
 * Fetch live prices from Birdeye (fallback for mints Jupiter missed).
 */
async function fetchBirdeyePrices(mints: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  if (!env.BIRDEYE_API_KEY || mints.length === 0) return prices;

  try {
    const { data } = await axios.get<BirdeyePriceResponse>(BIRDEYE_PRICE_URL, {
      params: { list_address: mints.join(",") },
      headers: {
        "X-API-KEY": env.BIRDEYE_API_KEY,
        accept: "application/json",
      },
      timeout: 10_000,
    });
    for (const mint of mints) {
      const entry = data.data?.[mint];
      if (entry) prices.set(mint, entry.value);
    }
  } catch (err) {
    logger.warn(
      { error: err instanceof Error ? err.message : err },
      "Birdeye price fetch failed",
    );
  }
  return prices;
}

/**
 * Fetch live prices from multiple sources: Jupiter (primary) → Birdeye (fallback).
 * USDC is hardcoded to $1.
 */
async function fetchLivePrices(mints: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  prices.set(USDC_MINT, 1.0);

  const nonUsdc = mints.filter((m) => m !== USDC_MINT);
  if (nonUsdc.length === 0) return prices;

  // Primary: Jupiter
  const jupPrices = await fetchJupiterPrices(nonUsdc);
  for (const [mint, price] of jupPrices) {
    prices.set(mint, price);
  }

  // Fallback: Birdeye for missing mints
  const missing = nonUsdc.filter((m) => !prices.has(m));
  if (missing.length > 0) {
    logger.info(
      { missing: missing.length },
      "Fetching missing prices from Birdeye",
    );
    const birdeyePrices = await fetchBirdeyePrices(missing);
    for (const [mint, price] of birdeyePrices) {
      prices.set(mint, price);
    }
  }

  return prices;
}

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
