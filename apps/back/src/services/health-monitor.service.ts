import axios from "axios";
import { prisma } from "@repo/database";
import { UserDetailsResponseSchema } from "@repo/shared";
import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";
import { sendTelegramAlert } from "./telegram.service.js";

const PROBE_TIMEOUT_MS = 10_000;

// SOL mint address for price probes
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export interface ProbeResult {
  name: string;
  ok: boolean;
  status?: number;
  durationMs: number;
  error?: string;
}

async function probeWithTimeout(
  name: string,
  fn: () => Promise<{ status?: number }>,
): Promise<ProbeResult> {
  const start = Date.now();
  try {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), PROBE_TIMEOUT_MS),
      ),
    ]);
    const durationMs = Date.now() - start;
    const probe: ProbeResult = { name, ok: true, durationMs };
    if (result.status !== undefined) probe.status = result.status;
    return probe;
  } catch (error) {
    const durationMs = Date.now() - start;
    if (axios.isAxiosError(error)) {
      const probe: ProbeResult = {
        name,
        ok: false,
        durationMs,
        error: `HTTP ${error.response?.status ?? "no response"}`,
      };
      if (error.response?.status !== undefined) probe.status = error.response.status;
      return probe;
    }
    return {
      name,
      ok: false,
      durationMs,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildProbes(): Array<{ name: string; fn: () => Promise<{ status?: number }> }> {
  const probes: Array<{ name: string; fn: () => Promise<{ status?: number }> }> = [];

  // Twitter (RapidAPI)
  probes.push({
    name: "Twitter (RapidAPI)",
    fn: async () => {
      const resp = await axios.get(`https://${env.RAPIDAPI_HOST}/user`, {
        params: { username: "elonmusk" },
        headers: {
          "x-rapidapi-key": env.RAPIDAPI_KEY,
          "x-rapidapi-host": env.RAPIDAPI_HOST,
        },
        timeout: PROBE_TIMEOUT_MS,
      });
      const parsed = UserDetailsResponseSchema.safeParse(resp.data);
      if (!parsed.success) {
        throw new Error("Invalid response body (credits exhausted or API changed)");
      }
      return { status: resp.status };
    },
  });

  // Anthropic
  probes.push({
    name: "Anthropic",
    fn: async () => {
      const resp = await axios.get("https://api.anthropic.com/v1/models", {
        headers: {
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        timeout: PROBE_TIMEOUT_MS,
      });
      return { status: resp.status };
    },
  });

  // Jupiter
  probes.push({
    name: "Jupiter",
    fn: async () => {
      const resp = await axios.get("https://api.jup.ag/swap/v1/quote", {
        params: {
          inputMint: SOL_MINT,
          outputMint: USDC_MINT,
          amount: "1000000", // 0.001 SOL
        },
        headers: { "x-api-key": env.JUPITER_API_KEY },
        timeout: PROBE_TIMEOUT_MS,
      });
      return { status: resp.status };
    },
  });

  // Birdeye
  probes.push({
    name: "Birdeye",
    fn: async () => {
      const resp = await axios.get("https://public-api.birdeye.so/defi/price", {
        params: { address: SOL_MINT },
        headers: {
          "X-API-KEY": env.BIRDEYE_API_KEY,
          "x-chain": "solana",
        },
        timeout: PROBE_TIMEOUT_MS,
      });
      return { status: resp.status };
    },
  });

  // Solana RPC (only if configured)
  if (env.SOLANA_RPC_URL) {
    probes.push({
      name: "Solana RPC",
      fn: async () => {
        const resp = await axios.post(
          env.SOLANA_RPC_URL!,
          { jsonrpc: "2.0", id: 1, method: "getHealth" },
          { timeout: PROBE_TIMEOUT_MS },
        );
        return { status: resp.status };
      },
    });
  }

  // Database
  probes.push({
    name: "Database",
    fn: async () => {
      await prisma.$queryRaw`SELECT 1`;
      return {};
    },
  });

  return probes;
}

export async function runProbes(): Promise<ProbeResult[]> {
  const probes = buildProbes();
  const results = await Promise.allSettled(
    probes.map((p) => probeWithTimeout(p.name, p.fn)),
  );

  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { name: probes[i]!.name, ok: false, durationMs: 0, error: "Probe threw unexpectedly" },
  );
}

export async function runHealthCheckAndAlert(): Promise<void> {
  const probeResults = await runProbes();

  const failures = probeResults.filter((r) => !r.ok);
  const total = probeResults.length;

  if (failures.length === 0) {
    logger.info(
      { results: probeResults.map((r) => `${r.name}: OK (${r.durationMs}ms)`) },
      "Health check passed — all APIs healthy",
    );
    return;
  }

  const failureLines = failures
    .map((f) => `  \u2022 ${f.name}: ${f.error} (${f.durationMs}ms)`)
    .join("\n");

  const message = [
    "\u{1F534} <b>HEALTH CHECK FAILED</b>",
    "",
    `${failures.length}/${total} APIs down:`,
    failureLines,
    "",
    `<b>Time:</b> ${new Date().toISOString()}`,
  ].join("\n");

  logger.error(
    { failures: failures.map((f) => ({ name: f.name, error: f.error, durationMs: f.durationMs })) },
    `Health check failed — ${failures.length}/${total} APIs down`,
  );

  await sendTelegramAlert(message, "health-check");
}
