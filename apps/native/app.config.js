const fs = require("fs");
const path = require("path");

// Parse a single .env file into an object
function parseEnvFile(envPath) {
  const env = {};

  try {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;

      const key = trimmed.slice(0, eqIndex);
      let value = trimmed.slice(eqIndex + 1);

      // Remove quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      env[key] = value;
    }
    console.log("[app.config.js] Loaded .env from:", envPath);
  } catch (err) {
    console.warn("[app.config.js] Could not load .env:", err.message);
  }

  return env;
}

// Load root .env first, then native .env (native overrides root)
const rootEnv = parseEnvFile(path.resolve(__dirname, "../../.env"));
const nativeEnv = parseEnvFile(path.resolve(__dirname, ".env"));
const env = { ...rootEnv, ...nativeEnv };

module.exports = ({ config }) => {
  const apiUrl =
    process.env.EXPO_PUBLIC_API_URL || env.EXPO_PUBLIC_API_URL || "";
  const apiUrlProd =
    process.env.EXPO_PUBLIC_API_URL_PROD || env.EXPO_PUBLIC_API_URL_PROD || "";
  const privyAppId =
    process.env.EXPO_PUBLIC_PRIVY_APP_ID || env.EXPO_PUBLIC_PRIVY_APP_ID || "";
  const privyClientId =
    process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ||
    env.EXPO_PUBLIC_PRIVY_CLIENT_ID ||
    "";
  const solanaRpcUrl =
    process.env.EXPO_PUBLIC_SOLANA_RPC_URL ||
    env.EXPO_PUBLIC_SOLANA_RPC_URL ||
    "";

  console.log("[app.config.js] API_URL:", apiUrl || "MISSING");
  console.log("[app.config.js] API_URL_PROD:", apiUrlProd ? `${apiUrlProd.slice(0, 20)}...` : "MISSING");
  console.log("[app.config.js] PRIVY_APP_ID:", privyAppId ? `${privyAppId.slice(0, 8)}...` : "MISSING");
  console.log("[app.config.js] PRIVY_CLIENT_ID:", privyClientId ? `${privyClientId.slice(0, 8)}...` : "MISSING");
  console.log("[app.config.js] SOLANA_RPC_URL:", solanaRpcUrl ? `${solanaRpcUrl.slice(0, 20)}...` : "MISSING");

  return {
    ...config,
    extra: {
      ...config.extra,
      apiUrl,
      apiUrlProd,
      privyAppId,
      privyClientId,
      solanaRpcUrl,
    },
  };
};
