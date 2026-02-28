import { PrivyClient } from "@privy-io/server-auth";

const privy = new PrivyClient(
  process.env["EXPO_PUBLIC_PRIVY_APP_ID"] ?? "",
  process.env["PRIVY_APP_SECRET"] ?? "",
);

/**
 * Verify a Privy auth token without Fastify dependency.
 * Returns the userId on success, null on failure.
 */
export async function verifyPrivyTokenRaw(
  token: string,
): Promise<string | null> {
  try {
    const claims = await privy.verifyAuthToken(token);
    return claims.userId;
  } catch {
    return null;
  }
}
