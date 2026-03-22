import type { Connection } from "@solana/web3.js";

/**
 * Poll `getSignatureStatuses` until the transaction is confirmed or times out.
 *
 * More resilient than `confirmTransaction` with blockhash strategy because:
 * - Works even after the original blockhash expires
 * - Doesn't depend on block height matching between RPC nodes
 * - Handles devnet unreliability with longer timeout
 */
export async function waitForConfirmation(
  connection: Connection,
  signature: string,
  timeoutMs = 120_000,
): Promise<void> {
  const start = Date.now();
  const pollIntervalMs = 2_000;

  while (Date.now() - start < timeoutMs) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const status = value[0];

    if (
      status?.confirmationStatus === "confirmed" ||
      status?.confirmationStatus === "finalized"
    ) {
      if (status.err) {
        throw new Error(
          `Transaction failed on-chain: ${JSON.stringify(status.err)}`,
        );
      }
      return;
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error(
    `Transaction confirmation timed out after ${timeoutMs / 1000}s`,
  );
}
