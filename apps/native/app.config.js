const fs = require("fs");
const path = require("path");

// Load .env from monorepo root
function loadEnv() {
  const envPath = path.resolve(__dirname, "../../.env");
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
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
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

const env = loadEnv();

module.exports = ({ config }) => {
  const privyAppId = process.env.EXPO_PUBLIC_PRIVY_APP_ID || env.EXPO_PUBLIC_PRIVY_APP_ID || "";
  const privyClientId = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID || env.EXPO_PUBLIC_PRIVY_CLIENT_ID || "";

  console.log("[app.config.js] PRIVY_APP_ID:", privyAppId ? `${privyAppId.slice(0, 8)}...` : "MISSING");
  console.log("[app.config.js] PRIVY_CLIENT_ID:", privyClientId ? `${privyClientId.slice(0, 8)}...` : "MISSING");

  return {
    ...config,
    extra: {
      ...config.extra,
      privyAppId,
      privyClientId,
    },
  };
};
