import { PublicKey } from "@solana/web3.js";
import { getWalletBalances, getConnection } from "@repo/solana";
import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";
import * as tokenPriceRepo from "../store/token-price.repository.js";
import * as vaultRepo from "../store/vault.repository.js";
import * as snapshotRepo from "../store/portfolio-snapshot.repository.js";
import { getSharePrice } from "../solana/vault-holdings.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";

interface SnapshotHolding {
  mint: string;
  symbol: string;
  amount: number;
  usdPrice: number;
  valueUsd: number;
}

interface LivePortfolio {
  totalValueUsd: number;
  holdings: SnapshotHolding[];
}

/**
 * Fetch live on-chain portfolio value for a wallet address.
 */
export async function fetchLivePortfolio(
  address: string,
): Promise<LivePortfolio> {
  if (!env.SOLANA_RPC_URL) {
    throw new Error("SOLANA_RPC_URL not configured");
  }

  const connection = getConnection(env.SOLANA_RPC_URL);
  const [walletBalances, priceMap, vaults] = await Promise.all([
    getWalletBalances(connection, address),
    tokenPriceRepo.getLatestPriceMap(),
    vaultRepo.findAllActiveVaults(),
  ]);

  const vaultByMint = new Map(
    vaults
      .filter((v) => v.shareToken?.mint)
      .map((v) => [v.shareToken!.mint, v]),
  );

  const holdings: SnapshotHolding[] = [];

  // SOL balance
  const solPrice = priceMap.get(SOL_MINT) ?? 0;
  if (walletBalances.sol > 0) {
    holdings.push({
      mint: SOL_MINT,
      symbol: "SOL",
      amount: walletBalances.sol,
      usdPrice: solPrice,
      valueUsd: walletBalances.sol * solPrice,
    });
  }

  // Token + vault balances
  for (const token of walletBalances.tokens) {
    const vault = vaultByMint.get(token.mint);

    if (vault) {
      let sharePrice = 0;
      try {
        const statePda = new PublicKey(vault.statePda);
        sharePrice = (await getSharePrice(statePda)) ?? 0;
      } catch {
        logger.debug({ vaultId: vault.id }, "Could not fetch share price");
      }

      holdings.push({
        mint: token.mint,
        symbol: vault.vaultSymbol,
        amount: token.uiAmount,
        usdPrice: sharePrice,
        valueUsd: token.uiAmount * sharePrice,
      });
    } else {
      const usdPrice = priceMap.get(token.mint) ?? 0;
      const tokenRecord = await tokenPriceRepo.findTokenByMint(token.mint);

      holdings.push({
        mint: token.mint,
        symbol: tokenRecord?.symbol ?? token.mint.slice(0, 6),
        amount: token.uiAmount,
        usdPrice,
        valueUsd: token.uiAmount * usdPrice,
      });
    }
  }

  const totalValueUsd = holdings.reduce((sum, h) => sum + h.valueUsd, 0);

  return { totalValueUsd, holdings };
}

/**
 * Build a comparable fingerprint of holdings amounts (mint → amount).
 * Ignores USD prices — only tracks how many tokens the user holds.
 */
function holdingsFingerprint(
  holdings: SnapshotHolding[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const h of holdings) {
    map.set(h.mint, h.amount);
  }
  return map;
}

function holdingsChanged(
  current: SnapshotHolding[],
  stored: unknown,
): boolean {
  if (!Array.isArray(stored)) return true;

  const currentMap = holdingsFingerprint(current);
  const storedMap = new Map<string, number>();
  for (const item of stored) {
    if (
      typeof item === "object" &&
      item !== null &&
      "mint" in item &&
      "amount" in item
    ) {
      storedMap.set(
        String(item.mint),
        Number(item.amount),
      );
    }
  }

  if (currentMap.size !== storedMap.size) return true;

  for (const [mint, amount] of currentMap) {
    const storedAmount = storedMap.get(mint);
    if (storedAmount === undefined || storedAmount !== amount) return true;
  }

  return false;
}

/**
 * Capture a snapshot only if token amounts changed from the last stored one.
 * We store amounts (data), not USD values — prices fluctuate but amounts
 * only change on actual transactions (deposit, withdraw, swap).
 * Returns the current live total USD value.
 */
export async function captureSnapshotIfChanged(
  address: string,
): Promise<number> {
  const live = await fetchLivePortfolio(address);
  const lastSnapshot = await snapshotRepo.getLatestSnapshot(address);

  const amountsChanged =
    !lastSnapshot || holdingsChanged(live.holdings, lastSnapshot.holdings);

  if (amountsChanged) {
    await snapshotRepo.createSnapshot(
      address,
      live.totalValueUsd,
      live.holdings,
    );
    logger.debug(
      { address, totalValueUsd: live.totalValueUsd },
      "Portfolio snapshot stored (holdings changed)",
    );
  }

  return live.totalValueUsd;
}
