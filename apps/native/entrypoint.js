// Import required polyfills first (order matters)
console.log("[entrypoint] Loading polyfills...");
import "fast-text-encoding";
import "react-native-get-random-values";
import "@ethersproject/shims";

// Buffer polyfill for Solana
import { Buffer } from "buffer";
global.Buffer = Buffer;
console.log("[entrypoint] Polyfills loaded successfully");
console.log("[entrypoint] Buffer available:", typeof global.Buffer !== "undefined");

// Then import the expo router
console.log("[entrypoint] Starting expo-router...");
import "expo-router/entry";
