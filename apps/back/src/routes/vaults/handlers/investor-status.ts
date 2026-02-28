import type { FastifyReply, FastifyRequest } from "fastify";
import { PublicKey } from "@solana/web3.js";
import { getGlamClient } from "../../../solana/client.js";
import { SHARE_TOKEN_MULTIPLIER } from "../../../solana/config.js";
import { getSharePrice } from "../../../solana/vault-holdings.js";
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
  const glamClient = getGlamClient(statePda);

  let sharePrice: number | null = null;
  let pendingRequest: {
    type: "SUBSCRIPTION" | "REDEMPTION";
    amount: number;
    createdAt: number;
  } | null = null;
  let redeemNoticePeriod = 0;

  // Fetch pending request for this wallet
  try {
    const pending = await glamClient.invest.fetchPendingRequest(walletPubkey);
    if (pending) {
      let isRedemption = false;
      const reqType = pending.requestType;
      if (typeof reqType === "object" && reqType !== null) {
        isRedemption = "redemption" in reqType;
      }

      // The pending request has incoming/outgoing BN fields
      const rawAmount = isRedemption
        ? pending.outgoing.toNumber()
        : pending.incoming.toNumber();
      const decimals = isRedemption ? SHARE_TOKEN_MULTIPLIER : 1e6;

      pendingRequest = {
        type: isRedemption ? "REDEMPTION" : "SUBSCRIPTION",
        amount: rawAmount / decimals,
        createdAt: pending.createdAt.toNumber(),
      };
    }
  } catch (err) {
    logger.debug({ err, wallet }, "No pending request or error fetching");
  }

  // Fetch share price and redeem notice period
  try {
    const stateModel = await glamClient.fetchStateModel();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mintModel = stateModel.mintModel as any;
    if (mintModel?.notifyAndSettle?.redeemNoticePeriod) {
      redeemNoticePeriod = Number(mintModel.notifyAndSettle.redeemNoticePeriod);
    }

    sharePrice = await getSharePrice(statePda);
  } catch {
    logger.debug("Could not compute share price");
  }

  return { sharePrice, pendingRequest, redeemNoticePeriod };
}
