import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import {
  DISC_ADD_OWNER,
  DISC_COLLECT_FEES,
  DISC_DEPOSIT_WITH_PRICE,
  DISC_EXECUTE,
  DISC_FULFILL_DEPOSIT,
  DISC_FULFILL_WITHDRAW,
  DISC_INITIALIZE,
  DISC_REMOVE_OWNER,
  DISC_REQUEST_DEPOSIT,
  DISC_REQUEST_WITHDRAW,
  DISC_SET_SHARE_PRICE,
  DISC_UPDATE_FEES,
  DISC_WITHDRAW_WITH_PRICE,
  PROGRAM_AUTHORITY,
  SPL_TOKEN_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  VAULT_PROGRAM_ID,
} from "../src/constants.js";
import { createInitializeInstruction } from "../src/instructions/initialize.js";
import { createAddOwnerInstruction } from "../src/instructions/add-owner.js";
import { createRemoveOwnerInstruction } from "../src/instructions/remove-owner.js";
import { createSetSharePriceInstruction } from "../src/instructions/set-share-price.js";
import { createExecuteInstruction } from "../src/instructions/execute.js";
import { createUpdateFeesInstruction } from "../src/instructions/update-fees.js";
import { createCollectFeesInstruction } from "../src/instructions/collect-fees.js";
import { createDepositWithPriceInstruction } from "../src/instructions/deposit-with-price.js";
import { createRequestDepositInstruction } from "../src/instructions/request-deposit.js";
import { createFulfillDepositInstruction } from "../src/instructions/fulfill-deposit.js";
import { createWithdrawWithPriceInstruction } from "../src/instructions/withdraw-with-price.js";
import { createRequestWithdrawInstruction } from "../src/instructions/request-withdraw.js";
import { createFulfillWithdrawInstruction } from "../src/instructions/fulfill-withdraw.js";

function key(n: number): PublicKey {
  const buf = Buffer.alloc(32);
  buf[0] = n;
  return new PublicKey(buf);
}

describe("Initialize", () => {
  it("builds correct instruction with default program authority", () => {
    const ix = createInitializeInstruction({
      admin: key(1),
      vaultState: key(2),
      shareMint: key(3),
      baseMint: key(4),
      shareDecimals: 6,
      sharePrice: 1_000_000n,
      name: "Test",
      symbol: "TST",
      uri: "https://example.com",
    });

    expect(ix.programId.toBase58()).toBe(VAULT_PROGRAM_ID.toBase58());
    expect(ix.data[0]).toBe(DISC_INITIALIZE);
    expect(ix.data[1]).toBe(6); // share_decimals
    expect(ix.data.readBigUInt64LE(2)).toBe(1_000_000n); // share_price
    expect(ix.keys).toHaveLength(7);
    // Account 0: program_authority (signer, not writable)
    expect(ix.keys[0]!.pubkey.toBase58()).toBe(PROGRAM_AUTHORITY.toBase58());
    expect(ix.keys[0]!.isSigner).toBe(true);
    expect(ix.keys[0]!.isWritable).toBe(false);
    // Account 1: admin (signer, writable)
    expect(ix.keys[1]!.isSigner).toBe(true);
    expect(ix.keys[1]!.isWritable).toBe(true);
    expect(ix.keys[5]!.pubkey.toBase58()).toBe(SYSTEM_PROGRAM_ID.toBase58());
    expect(ix.keys[6]!.pubkey.toBase58()).toBe(
      TOKEN_2022_PROGRAM_ID.toBase58(),
    );
  });

  it("accepts custom program authority", () => {
    const customAuthority = key(99);
    const ix = createInitializeInstruction({
      programAuthority: customAuthority,
      admin: key(1),
      vaultState: key(2),
      shareMint: key(3),
      baseMint: key(4),
      shareDecimals: 6,
      sharePrice: 1_000_000n,
      name: "Test",
      symbol: "TST",
      uri: "",
    });

    expect(ix.keys[0]!.pubkey.toBase58()).toBe(customAuthority.toBase58());
    expect(ix.keys[0]!.isSigner).toBe(true);
    expect(ix.keys[0]!.isWritable).toBe(false);
  });
});

describe("AddOwner", () => {
  it("builds correct instruction", () => {
    const newOwner = key(99);
    const ix = createAddOwnerInstruction({
      admin: key(1),
      vaultState: key(2),
      newOwner,
    });

    expect(ix.data[0]).toBe(DISC_ADD_OWNER);
    expect(ix.data.length).toBe(33);
    expect(Buffer.from(ix.data.subarray(1, 33))).toEqual(
      newOwner.toBuffer(),
    );
    expect(ix.keys).toHaveLength(2);
    expect(ix.keys[0]!.isSigner).toBe(true);
    expect(ix.keys[1]!.isWritable).toBe(true);
  });
});

describe("RemoveOwner", () => {
  it("builds correct instruction", () => {
    const ownerToRemove = key(88);
    const ix = createRemoveOwnerInstruction({
      admin: key(1),
      vaultState: key(2),
      ownerToRemove,
    });

    expect(ix.data[0]).toBe(DISC_REMOVE_OWNER);
    expect(ix.data.length).toBe(33);
    expect(Buffer.from(ix.data.subarray(1, 33))).toEqual(
      ownerToRemove.toBuffer(),
    );
    expect(ix.keys).toHaveLength(2);
  });
});

describe("SetSharePrice", () => {
  it("builds correct instruction", () => {
    const ix = createSetSharePriceInstruction({
      admin: key(1),
      vaultState: key(2),
      newSharePrice: 2_000_000n,
    });

    expect(ix.data[0]).toBe(DISC_SET_SHARE_PRICE);
    expect(ix.data.length).toBe(9);
    expect(ix.data.readBigUInt64LE(1)).toBe(2_000_000n);
    expect(ix.keys).toHaveLength(2);
  });
});

describe("Execute", () => {
  it("builds correct instruction with remaining accounts", () => {
    const targetData = Buffer.from([0x01, 0x02, 0x03]);
    const ix = createExecuteInstruction({
      operator: key(1),
      vaultState: key(2),
      targetProgram: key(3),
      remainingAccounts: [
        { pubkey: key(10), isSigner: false, isWritable: true },
        { pubkey: key(11), isSigner: false, isWritable: false },
      ],
      targetInstructionData: targetData,
    });

    expect(ix.data[0]).toBe(DISC_EXECUTE);
    expect(ix.data.length).toBe(4);
    expect(Buffer.from(ix.data.subarray(1))).toEqual(targetData);
    expect(ix.keys).toHaveLength(5); // 3 fixed + 2 remaining
    expect(ix.keys[0]!.isSigner).toBe(true);
    expect(ix.keys[3]!.isWritable).toBe(true);
    expect(ix.keys[4]!.isWritable).toBe(false);
  });
});

describe("UpdateFees", () => {
  it("builds correct instruction", () => {
    const feeReceiver = key(50);
    const ix = createUpdateFeesInstruction({
      admin: key(1),
      vaultState: key(2),
      entryFeeBps: 100,
      exitFeeBps: 200,
      managementFeeBps: 300,
      performanceFeeBps: 2000,
      feeReceiver,
    });

    expect(ix.data[0]).toBe(DISC_UPDATE_FEES);
    expect(ix.data.length).toBe(41);
    expect(ix.data.readUInt16LE(1)).toBe(100);
    expect(ix.data.readUInt16LE(3)).toBe(200);
    expect(ix.data.readUInt16LE(5)).toBe(300);
    expect(ix.data.readUInt16LE(7)).toBe(2000);
    expect(Buffer.from(ix.data.subarray(9, 41))).toEqual(
      feeReceiver.toBuffer(),
    );
    expect(ix.keys).toHaveLength(2);
  });
});

describe("CollectFees", () => {
  it("builds correct instruction", () => {
    const ix = createCollectFeesInstruction({
      admin: key(1),
      vaultState: key(2),
      shareMint: key(3),
      feeReceiverAta: key(4),
      currentTimestamp: 1700000000n,
    });

    expect(ix.data[0]).toBe(DISC_COLLECT_FEES);
    expect(ix.data.length).toBe(9);
    expect(ix.data.readBigInt64LE(1)).toBe(1700000000n);
    expect(ix.keys).toHaveLength(5);
    expect(ix.keys[4]!.pubkey.toBase58()).toBe(
      TOKEN_2022_PROGRAM_ID.toBase58(),
    );
  });
});

describe("DepositWithPrice", () => {
  it("builds correct instruction without fee receiver", () => {
    const ix = createDepositWithPriceInstruction({
      admin: key(1),
      depositor: key(2),
      depositorBaseAta: key(3),
      vaultBaseAta: key(4),
      vaultState: key(5),
      shareMint: key(6),
      depositorShareAta: key(7),
      newSharePrice: 1_000_000n,
      depositAmount: 5_000_000n,
    });

    expect(ix.data[0]).toBe(DISC_DEPOSIT_WITH_PRICE);
    expect(ix.data.length).toBe(17);
    expect(ix.data.readBigUInt64LE(1)).toBe(1_000_000n);
    expect(ix.data.readBigUInt64LE(9)).toBe(5_000_000n);
    expect(ix.keys).toHaveLength(9);
    expect(ix.keys[0]!.isSigner).toBe(true); // admin
    expect(ix.keys[1]!.isSigner).toBe(true); // depositor
    expect(ix.keys[7]!.pubkey.toBase58()).toBe(
      SPL_TOKEN_PROGRAM_ID.toBase58(),
    );
    expect(ix.keys[8]!.pubkey.toBase58()).toBe(
      TOKEN_2022_PROGRAM_ID.toBase58(),
    );
  });

  it("includes fee receiver when provided", () => {
    const ix = createDepositWithPriceInstruction({
      admin: key(1),
      depositor: key(2),
      depositorBaseAta: key(3),
      vaultBaseAta: key(4),
      vaultState: key(5),
      shareMint: key(6),
      depositorShareAta: key(7),
      newSharePrice: 1_000_000n,
      depositAmount: 5_000_000n,
      feeReceiverAta: key(8),
    });

    expect(ix.keys).toHaveLength(10);
    expect(ix.keys[9]!.isWritable).toBe(true);
  });
});

describe("RequestDeposit", () => {
  it("builds correct instruction", () => {
    const ix = createRequestDepositInstruction({
      depositor: key(1),
      depositorBaseAta: key(2),
      vaultBaseAta: key(3),
      vaultState: key(4),
      pendingDeposit: key(5),
      amount: 10_000_000n,
    });

    expect(ix.data[0]).toBe(DISC_REQUEST_DEPOSIT);
    expect(ix.data.length).toBe(9);
    expect(ix.data.readBigUInt64LE(1)).toBe(10_000_000n);
    expect(ix.keys).toHaveLength(7);
    expect(ix.keys[0]!.isSigner).toBe(true);
    expect(ix.keys[0]!.isWritable).toBe(true);
    expect(ix.keys[5]!.pubkey.toBase58()).toBe(SYSTEM_PROGRAM_ID.toBase58());
    expect(ix.keys[6]!.pubkey.toBase58()).toBe(
      SPL_TOKEN_PROGRAM_ID.toBase58(),
    );
  });
});

describe("FulfillDeposit", () => {
  it("builds correct instruction without fee receiver", () => {
    const ix = createFulfillDepositInstruction({
      admin: key(1),
      vaultState: key(2),
      pendingDeposit: key(3),
      shareMint: key(4),
      depositorShareAta: key(5),
      depositor: key(6),
      newSharePrice: 1_500_000n,
    });

    expect(ix.data[0]).toBe(DISC_FULFILL_DEPOSIT);
    expect(ix.data.length).toBe(9);
    expect(ix.data.readBigUInt64LE(1)).toBe(1_500_000n);
    expect(ix.keys).toHaveLength(7);
    expect(ix.keys[5]!.isWritable).toBe(true); // depositor receives refund
    expect(ix.keys[6]!.pubkey.toBase58()).toBe(
      TOKEN_2022_PROGRAM_ID.toBase58(),
    );
  });

  it("includes fee receiver when provided", () => {
    const ix = createFulfillDepositInstruction({
      admin: key(1),
      vaultState: key(2),
      pendingDeposit: key(3),
      shareMint: key(4),
      depositorShareAta: key(5),
      depositor: key(6),
      newSharePrice: 1_500_000n,
      feeReceiverAta: key(7),
    });

    expect(ix.keys).toHaveLength(8);
    expect(ix.keys[7]!.isWritable).toBe(true);
  });
});

describe("WithdrawWithPrice", () => {
  it("builds correct instruction", () => {
    const ix = createWithdrawWithPriceInstruction({
      admin: key(1),
      withdrawer: key(2),
      withdrawerShareAta: key(3),
      shareMint: key(4),
      vaultBaseAta: key(5),
      withdrawerBaseAta: key(6),
      vaultState: key(7),
      newSharePrice: 2_000_000n,
      sharesToBurn: 3_000_000n,
    });

    expect(ix.data[0]).toBe(DISC_WITHDRAW_WITH_PRICE);
    expect(ix.data.length).toBe(17);
    expect(ix.data.readBigUInt64LE(1)).toBe(2_000_000n);
    expect(ix.data.readBigUInt64LE(9)).toBe(3_000_000n);
    expect(ix.keys).toHaveLength(9);
    expect(ix.keys[0]!.isSigner).toBe(true); // admin
    expect(ix.keys[1]!.isSigner).toBe(true); // withdrawer
    expect(ix.keys[7]!.pubkey.toBase58()).toBe(
      SPL_TOKEN_PROGRAM_ID.toBase58(),
    );
    expect(ix.keys[8]!.pubkey.toBase58()).toBe(
      TOKEN_2022_PROGRAM_ID.toBase58(),
    );
  });
});

describe("RequestWithdraw", () => {
  it("builds correct instruction", () => {
    const ix = createRequestWithdrawInstruction({
      withdrawer: key(1),
      withdrawerShareAta: key(2),
      shareMint: key(3),
      vaultState: key(4),
      pendingWithdraw: key(5),
      shares: 5_000_000n,
    });

    expect(ix.data[0]).toBe(DISC_REQUEST_WITHDRAW);
    expect(ix.data.length).toBe(9);
    expect(ix.data.readBigUInt64LE(1)).toBe(5_000_000n);
    expect(ix.keys).toHaveLength(7);
    expect(ix.keys[0]!.isSigner).toBe(true);
    expect(ix.keys[0]!.isWritable).toBe(true);
    expect(ix.keys[5]!.pubkey.toBase58()).toBe(SYSTEM_PROGRAM_ID.toBase58());
    expect(ix.keys[6]!.pubkey.toBase58()).toBe(
      TOKEN_2022_PROGRAM_ID.toBase58(),
    );
  });
});

describe("FulfillWithdraw", () => {
  it("builds correct instruction", () => {
    const ix = createFulfillWithdrawInstruction({
      admin: key(1),
      vaultState: key(2),
      pendingWithdraw: key(3),
      vaultBaseAta: key(4),
      withdrawerBaseAta: key(5),
      withdrawer: key(6),
      newSharePrice: 2_500_000n,
    });

    expect(ix.data[0]).toBe(DISC_FULFILL_WITHDRAW);
    expect(ix.data.length).toBe(9);
    expect(ix.data.readBigUInt64LE(1)).toBe(2_500_000n);
    expect(ix.keys).toHaveLength(7);
    expect(ix.keys[0]!.isSigner).toBe(true); // admin
    expect(ix.keys[5]!.isWritable).toBe(true); // withdrawer receives refund
    expect(ix.keys[6]!.pubkey.toBase58()).toBe(
      SPL_TOKEN_PROGRAM_ID.toBase58(),
    );
  });
});

describe("All instructions use correct programId", () => {
  it("uses default VAULT_PROGRAM_ID", () => {
    const ix = createSetSharePriceInstruction({
      admin: key(1),
      vaultState: key(2),
      newSharePrice: 1n,
    });
    expect(ix.programId.toBase58()).toBe(VAULT_PROGRAM_ID.toBase58());
  });

  it("accepts custom programId", () => {
    const customId = key(200);
    const ix = createSetSharePriceInstruction({
      admin: key(1),
      vaultState: key(2),
      newSharePrice: 1n,
      programId: customId,
    });
    expect(ix.programId.toBase58()).toBe(customId.toBase58());
  });
});
