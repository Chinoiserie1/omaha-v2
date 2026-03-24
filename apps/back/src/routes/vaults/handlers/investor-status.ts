import type { FastifyReply, FastifyRequest } from "fastify";
import { PublicKey } from "@solana/web3.js";
import {
  findPendingDepositPda,
  findPendingWithdrawPda,
  deserializePendingDeposit,
  deserializePendingWithdraw,
} from "@repo/omaha-programs-sdk";
import { getConnection, SHARE_TOKEN_MULTIPLIER } from "../../../solana/config.js";
import { computeSharePrice } from "../../../services/share-price.service.js";
import * as vaultRepo from "../../../store/vault.repository.js";
import { logger } from "../../../utils/logger.js";

type InvestorStatusRequest = FastifyRequest<{
  Params: { id: string };
  Querystring: { wallet: string };
}>;

export async function getInvestorStatus(
  request: InvestorStatusRequest,
  reply: FastifyReply,
) {
  const { id } = request.params;
  const { wallet } = request.query;

  if (!wallet) {
    return reply.status(400).send({ error: "Missing wallet query parameter" });
  }

  let walletPubkey: PublicKey;
  try {
    walletPubkey = new PublicKey(wallet);
  } catch {
    return reply.status(400).send({ error: "Invalid wallet public key" });
  }

  const vault = await vaultRepo.findVaultById(id);
  if (!vault) {
    return reply.status(404).send({ error: "Vault not found" });
  }
  if (!vault.statePda) {
    return reply.status(400).send({ error: "Vault has no state PDA" });
  }

  const statePda = new PublicKey(vault.statePda);
  const connection = getConnection();

  let sharePrice: number | null = null;
  let pendingRequest: {
    type: "SUBSCRIPTION" | "REDEMPTION";
    amount: number;
    createdAt: number;
  } | null = null;

  // Check for pending deposit PDA
  try {
    const [pendingDepositPda] = findPendingDepositPda(statePda, walletPubkey);
    const depositAccount = await connection.getAccountInfo(pendingDepositPda);
    if (depositAccount) {
      const deposit = deserializePendingDeposit(Buffer.from(depositAccount.data));
      pendingRequest = {
        type: "SUBSCRIPTION",
        amount: Number(deposit.amount) / 1e6,
        createdAt: 0, // PDA doesn't store timestamp
      };
    }
  } catch (err) {
    logger.debug({ err, wallet }, "No pending deposit or error fetching");
  }

  // Check for pending withdraw PDA (only if no deposit found)
  if (!pendingRequest) {
    try {
      const [pendingWithdrawPda] = findPendingWithdrawPda(statePda, walletPubkey);
      const withdrawAccount = await connection.getAccountInfo(pendingWithdrawPda);
      if (withdrawAccount) {
        const withdraw = deserializePendingWithdraw(Buffer.from(withdrawAccount.data));
        pendingRequest = {
          type: "REDEMPTION",
          amount: Number(withdraw.shares) / SHARE_TOKEN_MULTIPLIER,
          createdAt: 0,
        };
      }
    } catch (err) {
      logger.debug({ err, wallet }, "No pending withdraw or error fetching");
    }
  }

  // Share price: use NAV from DB prices when all prices are fresh,
  // fall back to on-chain price if any holding has a stale/zero price.
  try {
    const result = await computeSharePrice(statePda);
    const onChainPriceUsd = Number(result.onChainPrice) / 1e6;

    if (!result.hasStalePrice && result.computedPriceUsd !== null && result.computedPriceUsd > 0) {
      sharePrice = result.computedPriceUsd;
    } else if (onChainPriceUsd > 0) {
      sharePrice = onChainPriceUsd;
    }
  } catch {
    logger.debug("Could not compute share price");
  }

  return { sharePrice, pendingRequest };
}
