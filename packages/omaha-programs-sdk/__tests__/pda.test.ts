import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import { VAULT_PROGRAM_ID } from "../src/constants.js";
import {
  findPendingDepositPda,
  findPendingWithdrawPda,
  findShareMintPda,
  findVaultStatePda,
} from "../src/pda.js";

const admin = new PublicKey("8dHEsAiGSpgGcRE7xwBpbfYZNWLG35c3KPjNAfNu7kRc");
const baseMint = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);
const depositor = new PublicKey(
  "HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH",
);

describe("PDA derivation", () => {
  it("findVaultStatePda matches PublicKey.findProgramAddressSync", () => {
    const [pda, bump] = findVaultStatePda(admin, baseMint);
    const [expected, expectedBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), admin.toBuffer(), baseMint.toBuffer()],
      VAULT_PROGRAM_ID,
    );
    expect(pda.toBase58()).toBe(expected.toBase58());
    expect(bump).toBe(expectedBump);
  });

  it("findShareMintPda matches PublicKey.findProgramAddressSync", () => {
    const [vaultState] = findVaultStatePda(admin, baseMint);
    const [pda, bump] = findShareMintPda(vaultState);
    const [expected, expectedBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("share_mint"), vaultState.toBuffer()],
      VAULT_PROGRAM_ID,
    );
    expect(pda.toBase58()).toBe(expected.toBase58());
    expect(bump).toBe(expectedBump);
  });

  it("findPendingDepositPda matches PublicKey.findProgramAddressSync", () => {
    const [vaultState] = findVaultStatePda(admin, baseMint);
    const [pda, bump] = findPendingDepositPda(vaultState, depositor);
    const [expected, expectedBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pending_deposit"),
        vaultState.toBuffer(),
        depositor.toBuffer(),
      ],
      VAULT_PROGRAM_ID,
    );
    expect(pda.toBase58()).toBe(expected.toBase58());
    expect(bump).toBe(expectedBump);
  });

  it("findPendingWithdrawPda matches PublicKey.findProgramAddressSync", () => {
    const [vaultState] = findVaultStatePda(admin, baseMint);
    const [pda, bump] = findPendingWithdrawPda(vaultState, depositor);
    const [expected, expectedBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pending_withdraw"),
        vaultState.toBuffer(),
        depositor.toBuffer(),
      ],
      VAULT_PROGRAM_ID,
    );
    expect(pda.toBase58()).toBe(expected.toBase58());
    expect(bump).toBe(expectedBump);
  });

  it("accepts custom programId", () => {
    const customId = new PublicKey(
      "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    );
    const [pda] = findVaultStatePda(admin, baseMint, customId);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), admin.toBuffer(), baseMint.toBuffer()],
      customId,
    );
    expect(pda.toBase58()).toBe(expected.toBase58());
  });
});
