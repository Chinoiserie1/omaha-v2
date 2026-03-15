import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import {
  FACTORY_DISCRIMINATOR,
  FACTORY_STATE_SIZE,
  PENDING_DEPOSIT_DISCRIMINATOR,
  PENDING_WITHDRAW_DISCRIMINATOR,
  VAULT_DISCRIMINATOR,
  VAULT_STATE_SIZE,
  PENDING_DEPOSIT_SIZE,
  PENDING_WITHDRAW_SIZE,
} from "../src/constants.js";
import { deserializeVaultState } from "../src/state/vault-state.js";
import { deserializePendingDeposit } from "../src/state/pending-deposit.js";
import { deserializePendingWithdraw } from "../src/state/pending-withdraw.js";
import { deserializeFactoryState } from "../src/state/factory-state.js";

function makeKey(byte: number): PublicKey {
  const buf = Buffer.alloc(32);
  buf[0] = byte;
  return new PublicKey(buf);
}

function buildVaultStateBuffer(overrides?: {
  discriminator?: number;
  bump?: number;
  shareDecimals?: number;
  numOperators?: number;
  entryFeeBps?: number;
  exitFeeBps?: number;
  managementFeeBps?: number;
  performanceFeeBps?: number;
  isPaused?: boolean;
  admin?: PublicKey;
  pendingAdmin?: PublicKey;
  shareMint?: PublicKey;
  baseMint?: PublicKey;
  feeReceiver?: PublicKey;
  factory?: PublicKey;
  sharePrice?: bigint;
  highWaterMark?: bigint;
  lastFeeTimestamp?: bigint;
  operators?: PublicKey[];
  vaultNameLen?: number;
  vaultName?: string;
}): Buffer {
  const buf = Buffer.alloc(VAULT_STATE_SIZE);
  const o = overrides ?? {};

  buf.writeUInt8(o.discriminator ?? VAULT_DISCRIMINATOR, 0);
  buf.writeUInt8(o.bump ?? 255, 1);
  buf.writeUInt8(o.shareDecimals ?? 6, 2);
  buf.writeUInt8(o.numOperators ?? 0, 3);
  buf.writeUInt16LE(o.entryFeeBps ?? 0, 4);
  buf.writeUInt16LE(o.exitFeeBps ?? 0, 6);
  buf.writeUInt16LE(o.managementFeeBps ?? 0, 8);
  buf.writeUInt16LE(o.performanceFeeBps ?? 0, 10);
  buf.writeUInt8(o.vaultNameLen ?? 0, 12);
  buf.writeUInt8(o.isPaused ? 1 : 0, 13);
  // padding at 14..16
  (o.admin ?? makeKey(1)).toBuffer().copy(buf, 16);
  (o.pendingAdmin ?? PublicKey.default).toBuffer().copy(buf, 48);
  (o.shareMint ?? makeKey(2)).toBuffer().copy(buf, 80);
  (o.baseMint ?? makeKey(3)).toBuffer().copy(buf, 112);
  (o.feeReceiver ?? makeKey(4)).toBuffer().copy(buf, 144);
  (o.factory ?? makeKey(5)).toBuffer().copy(buf, 176);
  buf.writeBigUInt64LE(o.sharePrice ?? 1_000_000n, 208);
  buf.writeBigUInt64LE(o.highWaterMark ?? 1_000_000n, 216);
  buf.writeBigInt64LE(o.lastFeeTimestamp ?? 1700000000n, 224);

  const operators = o.operators ?? [];
  for (let i = 0; i < operators.length; i++) {
    operators[i]!.toBuffer().copy(buf, 232 + i * 32);
  }

  if (o.vaultName !== undefined) {
    Buffer.from(o.vaultName, "utf-8").copy(buf, 552);
  }

  return buf;
}

describe("VaultState deserialization", () => {
  it("deserializes all fields correctly", () => {
    const admin = makeKey(10);
    const shareMint = makeKey(20);
    const baseMint = makeKey(30);
    const feeReceiver = makeKey(40);
    const owner1 = makeKey(50);
    const owner2 = makeKey(60);

    const factory = makeKey(70);

    const buf = buildVaultStateBuffer({
      bump: 253,
      shareDecimals: 9,
      numOperators: 2,
      entryFeeBps: 100,
      exitFeeBps: 200,
      managementFeeBps: 300,
      performanceFeeBps: 2000,
      isPaused: false,
      admin,
      shareMint,
      baseMint,
      feeReceiver,
      factory,
      sharePrice: 2_000_000n,
      highWaterMark: 1_500_000n,
      lastFeeTimestamp: 1700000000n,
      operators: [owner1, owner2],
      vaultNameLen: 10,
      vaultName: "test-vault",
    });

    const state = deserializeVaultState(buf);

    expect(state.discriminator).toBe(VAULT_DISCRIMINATOR);
    expect(state.bump).toBe(253);
    expect(state.shareDecimals).toBe(9);
    expect(state.numOperators).toBe(2);
    expect(state.entryFeeBps).toBe(100);
    expect(state.exitFeeBps).toBe(200);
    expect(state.managementFeeBps).toBe(300);
    expect(state.performanceFeeBps).toBe(2000);
    expect(state.vaultNameLen).toBe(10);
    expect(state.isPaused).toBe(false);
    expect(state.admin.toBase58()).toBe(admin.toBase58());
    expect(state.pendingAdmin.toBase58()).toBe(PublicKey.default.toBase58());
    expect(state.shareMint.toBase58()).toBe(shareMint.toBase58());
    expect(state.baseMint.toBase58()).toBe(baseMint.toBase58());
    expect(state.feeReceiver.toBase58()).toBe(feeReceiver.toBase58());
    expect(state.factory.toBase58()).toBe(factory.toBase58());
    expect(state.sharePrice).toBe(2_000_000n);
    expect(state.highWaterMark).toBe(1_500_000n);
    expect(state.lastFeeTimestamp).toBe(1700000000n);
    expect(state.operators).toHaveLength(2);
    expect(state.operators[0]!.toBase58()).toBe(owner1.toBase58());
    expect(state.operators[1]!.toBase58()).toBe(owner2.toBase58());
    expect(state.vaultName).toBe("test-vault");
  });

  it("throws on short data", () => {
    expect(() => deserializeVaultState(Buffer.alloc(100))).toThrow(
      "too short",
    );
  });

  it("throws on wrong discriminator", () => {
    const buf = buildVaultStateBuffer({ discriminator: 0x99 });
    expect(() => deserializeVaultState(buf)).toThrow("discriminator");
  });

  it("handles zero operators", () => {
    const buf = buildVaultStateBuffer({ numOperators: 0 });
    const state = deserializeVaultState(buf);
    expect(state.operators).toHaveLength(0);
  });
});

describe("PendingDeposit deserialization", () => {
  function buildPendingDepositBuffer(overrides?: {
    discriminator?: number;
    bump?: number;
    entryFeeBps?: number;
    vaultState?: PublicKey;
    depositor?: PublicKey;
    amount?: bigint;
    createdAt?: bigint;
  }): Buffer {
    const buf = Buffer.alloc(PENDING_DEPOSIT_SIZE);
    const o = overrides ?? {};
    buf.writeUInt8(o.discriminator ?? PENDING_DEPOSIT_DISCRIMINATOR, 0);
    buf.writeUInt8(o.bump ?? 254, 1);
    buf.writeUInt16LE(o.entryFeeBps ?? 100, 2);
    // padding at 4..8
    (o.vaultState ?? makeKey(1)).toBuffer().copy(buf, 8);
    (o.depositor ?? makeKey(2)).toBuffer().copy(buf, 40);
    buf.writeBigUInt64LE(o.amount ?? 5_000_000n, 72);
    buf.writeBigInt64LE(o.createdAt ?? 1700000000n, 80);
    return buf;
  }

  it("deserializes all fields correctly", () => {
    const vaultState = makeKey(11);
    const depositor = makeKey(22);

    const buf = buildPendingDepositBuffer({
      bump: 252,
      entryFeeBps: 50,
      vaultState,
      depositor,
      amount: 10_000_000n,
      createdAt: 1700001000n,
    });

    const pd = deserializePendingDeposit(buf);
    expect(pd.discriminator).toBe(PENDING_DEPOSIT_DISCRIMINATOR);
    expect(pd.bump).toBe(252);
    expect(pd.entryFeeBps).toBe(50);
    expect(pd.vaultState.toBase58()).toBe(vaultState.toBase58());
    expect(pd.depositor.toBase58()).toBe(depositor.toBase58());
    expect(pd.amount).toBe(10_000_000n);
    expect(pd.createdAt).toBe(1700001000n);
  });

  it("throws on wrong discriminator", () => {
    const buf = buildPendingDepositBuffer({ discriminator: 0x99 });
    expect(() => deserializePendingDeposit(buf)).toThrow("discriminator");
  });

  it("throws on short data", () => {
    expect(() => deserializePendingDeposit(Buffer.alloc(10))).toThrow(
      "too short",
    );
  });
});

describe("PendingWithdraw deserialization", () => {
  function buildPendingWithdrawBuffer(overrides?: {
    discriminator?: number;
    bump?: number;
    exitFeeBps?: number;
    vaultState?: PublicKey;
    withdrawer?: PublicKey;
    shares?: bigint;
    createdAt?: bigint;
  }): Buffer {
    const buf = Buffer.alloc(PENDING_WITHDRAW_SIZE);
    const o = overrides ?? {};
    buf.writeUInt8(o.discriminator ?? PENDING_WITHDRAW_DISCRIMINATOR, 0);
    buf.writeUInt8(o.bump ?? 251, 1);
    buf.writeUInt16LE(o.exitFeeBps ?? 200, 2);
    // padding at 4..8
    (o.vaultState ?? makeKey(1)).toBuffer().copy(buf, 8);
    (o.withdrawer ?? makeKey(2)).toBuffer().copy(buf, 40);
    buf.writeBigUInt64LE(o.shares ?? 3_000_000n, 72);
    buf.writeBigInt64LE(o.createdAt ?? 1700000000n, 80);
    return buf;
  }

  it("deserializes all fields correctly", () => {
    const vaultState = makeKey(33);
    const withdrawer = makeKey(44);

    const buf = buildPendingWithdrawBuffer({
      bump: 250,
      exitFeeBps: 150,
      vaultState,
      withdrawer,
      shares: 7_500_000n,
      createdAt: 1700002000n,
    });

    const pw = deserializePendingWithdraw(buf);
    expect(pw.discriminator).toBe(PENDING_WITHDRAW_DISCRIMINATOR);
    expect(pw.bump).toBe(250);
    expect(pw.exitFeeBps).toBe(150);
    expect(pw.vaultState.toBase58()).toBe(vaultState.toBase58());
    expect(pw.withdrawer.toBase58()).toBe(withdrawer.toBase58());
    expect(pw.shares).toBe(7_500_000n);
    expect(pw.createdAt).toBe(1700002000n);
  });

  it("throws on wrong discriminator", () => {
    const buf = buildPendingWithdrawBuffer({ discriminator: 0x99 });
    expect(() => deserializePendingWithdraw(buf)).toThrow("discriminator");
  });
});

describe("FactoryState deserialization", () => {
  function buildFactoryStateBuffer(overrides?: {
    discriminator?: number;
    bump?: number;
    numAdmins?: number;
    isPaused?: boolean;
    owner?: PublicKey;
    pendingOwner?: PublicKey;
  }): Buffer {
    const buf = Buffer.alloc(FACTORY_STATE_SIZE);
    const o = overrides ?? {};
    buf.writeUInt8(o.discriminator ?? FACTORY_DISCRIMINATOR, 0);
    buf.writeUInt8(o.bump ?? 255, 1);
    buf.writeUInt8(o.isPaused ? 1 : 0, 2);
    buf.writeUInt8(o.numAdmins ?? 0, 3);
    // padding at 4..8
    (o.owner ?? makeKey(1)).toBuffer().copy(buf, 8);
    (o.pendingOwner ?? PublicKey.default).toBuffer().copy(buf, 40);
    return buf;
  }

  it("deserializes basic fields correctly", () => {
    const owner = makeKey(10);
    const buf = buildFactoryStateBuffer({
      bump: 253,
      numAdmins: 2,
      isPaused: false,
      owner,
    });

    const state = deserializeFactoryState(buf);
    expect(state.discriminator).toBe(FACTORY_DISCRIMINATOR);
    expect(state.bump).toBe(253);
    expect(state.numAdmins).toBe(2);
    expect(state.isPaused).toBe(false);
    expect(state.owner.toBase58()).toBe(owner.toBase58());
  });

  it("throws on wrong discriminator", () => {
    const buf = buildFactoryStateBuffer({ discriminator: 0x99 });
    expect(() => deserializeFactoryState(buf)).toThrow("discriminator");
  });

  it("throws on short data", () => {
    expect(() => deserializeFactoryState(Buffer.alloc(10))).toThrow(
      "too short",
    );
  });
});
