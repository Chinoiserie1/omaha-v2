import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import {
  CLOCK_SYSVAR_ID,
  DISC_ADD_OPERATOR,
  DISC_CANCEL_DEPOSIT,
  DISC_CANCEL_WITHDRAW,
  DISC_COLLECT_FEES,
  DISC_DEPOSIT_WITH_PRICE,
  DISC_EXECUTE,
  DISC_FULFILL_DEPOSIT,
  DISC_FULFILL_WITHDRAW,
  DISC_INITIALIZE,
  DISC_INITIALIZE_FACTORY,
  DISC_PAUSE_FACTORY,
  DISC_PAUSE_VAULT,
  DISC_REMOVE_OPERATOR,
  DISC_REQUEST_DEPOSIT,
  DISC_REQUEST_WITHDRAW,
  DISC_SET_SHARE_PRICE,
  DISC_UNPAUSE_FACTORY,
  DISC_UNPAUSE_VAULT,
  DISC_UPDATE_FEES,
  DISC_WITHDRAW_WITH_PRICE,
  PROGRAM_AUTHORITY,
  SPL_TOKEN_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  VAULT_PROGRAM_ID,
} from "../src/constants.js";
import { createInitializeInstruction } from "../src/instructions/initialize.js";
import { createAddOperatorInstruction } from "../src/instructions/add-operator.js";
import { createRemoveOperatorInstruction } from "../src/instructions/remove-operator.js";
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
import { createInitializeFactoryInstruction } from "../src/instructions/initialize-factory.js";
import { createPauseFactoryInstruction } from "../src/instructions/pause-factory.js";
import { createUnpauseFactoryInstruction } from "../src/instructions/unpause-factory.js";
import { createPauseVaultInstruction } from "../src/instructions/pause-vault.js";
import { createUnpauseVaultInstruction } from "../src/instructions/unpause-vault.js";
import { createCancelDepositInstruction } from "../src/instructions/cancel-deposit.js";
import { createCancelWithdrawInstruction } from "../src/instructions/cancel-withdraw.js";

function key(n: number): PublicKey {
  const buf = Buffer.alloc(32);
  buf[0] = n;
  return new PublicKey(buf);
}

describe("Initialize", () => {
  it("builds correct instruction with factory_state as account[0]", () => {
    const factoryState = key(10);
    const ix = createInitializeInstruction({
      factoryState,
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
    // Account 0: factory_state (not signer, writable)
    expect(ix.keys[0]!.pubkey.toBase58()).toBe(factoryState.toBase58());
    expect(ix.keys[0]!.isSigner).toBe(false);
    expect(ix.keys[0]!.isWritable).toBe(true);
    // Account 1: admin (signer, writable)
    expect(ix.keys[1]!.isSigner).toBe(true);
    expect(ix.keys[1]!.isWritable).toBe(true);
    expect(ix.keys[5]!.pubkey.toBase58()).toBe(SYSTEM_PROGRAM_ID.toBase58());
    expect(ix.keys[6]!.pubkey.toBase58()).toBe(
      TOKEN_2022_PROGRAM_ID.toBase58(),
    );
  });
});

describe("AddOperator", () => {
  it("builds correct instruction", () => {
    const newOperator = key(99);
    const ix = createAddOperatorInstruction({
      admin: key(1),
      vaultState: key(2),
      newOperator,
    });

    expect(ix.data[0]).toBe(DISC_ADD_OPERATOR);
    expect(ix.data.length).toBe(33);
    expect(Buffer.from(ix.data.subarray(1, 33))).toEqual(
      newOperator.toBuffer(),
    );
    expect(ix.keys).toHaveLength(2);
    expect(ix.keys[0]!.isSigner).toBe(true);
    expect(ix.keys[1]!.isWritable).toBe(true);
  });
});

describe("RemoveOperator", () => {
  it("builds correct instruction", () => {
    const operatorToRemove = key(88);
    const ix = createRemoveOperatorInstruction({
      admin: key(1),
      vaultState: key(2),
      operatorToRemove,
    });

    expect(ix.data[0]).toBe(DISC_REMOVE_OPERATOR);
    expect(ix.data.length).toBe(33);
    expect(Buffer.from(ix.data.subarray(1, 33))).toEqual(
      operatorToRemove.toBuffer(),
    );
    expect(ix.keys).toHaveLength(2);
  });
});

describe("AddOwner (deprecated alias)", () => {
  it("re-exports createAddOperatorInstruction as createAddOwnerInstruction", () => {
    const ix = createAddOwnerInstruction({
      admin: key(1),
      vaultState: key(2),
      newOperator: key(99),
    });
    expect(ix.data[0]).toBe(DISC_ADD_OPERATOR);
    expect(ix.keys).toHaveLength(2);
  });
});

describe("RemoveOwner (deprecated alias)", () => {
  it("re-exports createRemoveOperatorInstruction as createRemoveOwnerInstruction", () => {
    const ix = createRemoveOwnerInstruction({
      admin: key(1),
      vaultState: key(2),
      operatorToRemove: key(88),
    });
    expect(ix.data[0]).toBe(DISC_REMOVE_OPERATOR);
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
  it("builds correct instruction with clock sysvar and no data", () => {
    const ix = createCollectFeesInstruction({
      admin: key(1),
      vaultState: key(2),
      shareMint: key(3),
      feeReceiverAta: key(4),
    });

    expect(ix.data[0]).toBe(DISC_COLLECT_FEES);
    expect(ix.data.length).toBe(1);
    expect(ix.keys).toHaveLength(6);
    expect(ix.keys[4]!.pubkey.toBase58()).toBe(
      TOKEN_2022_PROGRAM_ID.toBase58(),
    );
    expect(ix.keys[5]!.pubkey.toBase58()).toBe(CLOCK_SYSVAR_ID.toBase58());
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
  it("builds correct instruction with clock sysvar", () => {
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
    expect(ix.keys).toHaveLength(8);
    expect(ix.keys[0]!.isSigner).toBe(true);
    expect(ix.keys[0]!.isWritable).toBe(true);
    expect(ix.keys[5]!.pubkey.toBase58()).toBe(SYSTEM_PROGRAM_ID.toBase58());
    expect(ix.keys[6]!.pubkey.toBase58()).toBe(
      SPL_TOKEN_PROGRAM_ID.toBase58(),
    );
    expect(ix.keys[7]!.pubkey.toBase58()).toBe(CLOCK_SYSVAR_ID.toBase58());
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
  it("builds correct instruction with escrow pattern", () => {
    const ix = createRequestWithdrawInstruction({
      withdrawer: key(1),
      withdrawerShareAta: key(2),
      shareMint: key(3),
      vaultState: key(4),
      pendingWithdraw: key(5),
      vaultShareAta: key(6),
      shares: 5_000_000n,
    });

    expect(ix.data[0]).toBe(DISC_REQUEST_WITHDRAW);
    expect(ix.data.length).toBe(9);
    expect(ix.data.readBigUInt64LE(1)).toBe(5_000_000n);
    expect(ix.keys).toHaveLength(9);
    expect(ix.keys[0]!.isSigner).toBe(true);
    expect(ix.keys[0]!.isWritable).toBe(true);
    expect(ix.keys[2]!.isWritable).toBe(false); // share_mint read-only
    expect(ix.keys[5]!.pubkey.toBase58()).toBe(SYSTEM_PROGRAM_ID.toBase58());
    expect(ix.keys[6]!.pubkey.toBase58()).toBe(
      TOKEN_2022_PROGRAM_ID.toBase58(),
    );
    expect(ix.keys[7]!.pubkey.toBase58()).toBe(CLOCK_SYSVAR_ID.toBase58());
    expect(ix.keys[8]!.isWritable).toBe(true); // vault_share_ata
  });
});

describe("FulfillWithdraw", () => {
  it("builds correct instruction with burn-from-escrow", () => {
    const ix = createFulfillWithdrawInstruction({
      admin: key(1),
      vaultState: key(2),
      pendingWithdraw: key(3),
      vaultBaseAta: key(4),
      withdrawerBaseAta: key(5),
      withdrawer: key(6),
      vaultShareAta: key(7),
      shareMint: key(8),
      newSharePrice: 2_500_000n,
    });

    expect(ix.data[0]).toBe(DISC_FULFILL_WITHDRAW);
    expect(ix.data.length).toBe(9);
    expect(ix.data.readBigUInt64LE(1)).toBe(2_500_000n);
    expect(ix.keys).toHaveLength(10);
    expect(ix.keys[0]!.isSigner).toBe(true); // admin
    expect(ix.keys[5]!.isWritable).toBe(true); // withdrawer receives refund
    expect(ix.keys[6]!.pubkey.toBase58()).toBe(
      SPL_TOKEN_PROGRAM_ID.toBase58(),
    );
    expect(ix.keys[7]!.isWritable).toBe(true); // vault_share_ata
    expect(ix.keys[8]!.isWritable).toBe(true); // share_mint
    expect(ix.keys[9]!.pubkey.toBase58()).toBe(
      TOKEN_2022_PROGRAM_ID.toBase58(),
    );
  });
});

describe("InitializeFactory", () => {
  it("builds correct instruction with default program authority", () => {
    const ix = createInitializeFactoryInstruction({
      owner: key(1),
      factoryState: key(2),
    });

    expect(ix.data[0]).toBe(DISC_INITIALIZE_FACTORY);
    expect(ix.data.length).toBe(1);
    expect(ix.keys).toHaveLength(4);
    expect(ix.keys[0]!.pubkey.toBase58()).toBe(PROGRAM_AUTHORITY.toBase58());
    expect(ix.keys[0]!.isSigner).toBe(true);
    expect(ix.keys[0]!.isWritable).toBe(false);
    expect(ix.keys[1]!.isSigner).toBe(true);
    expect(ix.keys[1]!.isWritable).toBe(true);
    expect(ix.keys[2]!.isWritable).toBe(true);
    expect(ix.keys[3]!.pubkey.toBase58()).toBe(SYSTEM_PROGRAM_ID.toBase58());
  });

  it("accepts custom program authority", () => {
    const customAuthority = key(99);
    const ix = createInitializeFactoryInstruction({
      programAuthority: customAuthority,
      owner: key(1),
      factoryState: key(2),
    });

    expect(ix.keys[0]!.pubkey.toBase58()).toBe(customAuthority.toBase58());
  });
});

describe("PauseFactory", () => {
  it("builds correct instruction", () => {
    const ix = createPauseFactoryInstruction({
      owner: key(1),
      factoryState: key(2),
    });

    expect(ix.data[0]).toBe(DISC_PAUSE_FACTORY);
    expect(ix.data.length).toBe(1);
    expect(ix.keys).toHaveLength(2);
    expect(ix.keys[0]!.isSigner).toBe(true);
    expect(ix.keys[1]!.isWritable).toBe(true);
  });
});

describe("UnpauseFactory", () => {
  it("builds correct instruction", () => {
    const ix = createUnpauseFactoryInstruction({
      owner: key(1),
      factoryState: key(2),
    });

    expect(ix.data[0]).toBe(DISC_UNPAUSE_FACTORY);
    expect(ix.data.length).toBe(1);
    expect(ix.keys).toHaveLength(2);
    expect(ix.keys[0]!.isSigner).toBe(true);
    expect(ix.keys[1]!.isWritable).toBe(true);
  });
});

describe("PauseVault", () => {
  it("builds correct instruction without factory state", () => {
    const ix = createPauseVaultInstruction({
      authority: key(1),
      vaultState: key(2),
    });

    expect(ix.data[0]).toBe(DISC_PAUSE_VAULT);
    expect(ix.data.length).toBe(1);
    expect(ix.keys).toHaveLength(2);
    expect(ix.keys[0]!.isSigner).toBe(true);
    expect(ix.keys[1]!.isWritable).toBe(true);
  });

  it("includes factory state when provided", () => {
    const ix = createPauseVaultInstruction({
      authority: key(1),
      vaultState: key(2),
      factoryState: key(3),
    });

    expect(ix.keys).toHaveLength(3);
    expect(ix.keys[2]!.isWritable).toBe(false);
  });
});

describe("UnpauseVault", () => {
  it("builds correct instruction without factory state", () => {
    const ix = createUnpauseVaultInstruction({
      authority: key(1),
      vaultState: key(2),
    });

    expect(ix.data[0]).toBe(DISC_UNPAUSE_VAULT);
    expect(ix.data.length).toBe(1);
    expect(ix.keys).toHaveLength(2);
  });

  it("includes factory state when provided", () => {
    const ix = createUnpauseVaultInstruction({
      authority: key(1),
      vaultState: key(2),
      factoryState: key(3),
    });

    expect(ix.keys).toHaveLength(3);
  });
});

describe("CancelDeposit", () => {
  it("builds correct instruction", () => {
    const ix = createCancelDepositInstruction({
      depositor: key(1),
      pendingDeposit: key(2),
      vaultState: key(3),
      vaultBaseAta: key(4),
      depositorBaseAta: key(5),
    });

    expect(ix.data[0]).toBe(DISC_CANCEL_DEPOSIT);
    expect(ix.data.length).toBe(1);
    expect(ix.keys).toHaveLength(7);
    expect(ix.keys[0]!.isSigner).toBe(true);
    expect(ix.keys[0]!.isWritable).toBe(true);
    expect(ix.keys[1]!.isWritable).toBe(true);
    expect(ix.keys[2]!.isWritable).toBe(false);
    expect(ix.keys[3]!.isWritable).toBe(true);
    expect(ix.keys[4]!.isWritable).toBe(true);
    expect(ix.keys[5]!.pubkey.toBase58()).toBe(SPL_TOKEN_PROGRAM_ID.toBase58());
    expect(ix.keys[6]!.pubkey.toBase58()).toBe(CLOCK_SYSVAR_ID.toBase58());
  });
});

describe("CancelWithdraw", () => {
  it("builds correct instruction", () => {
    const ix = createCancelWithdrawInstruction({
      withdrawer: key(1),
      pendingWithdraw: key(2),
      vaultState: key(3),
      vaultShareAta: key(4),
      withdrawerShareAta: key(5),
    });

    expect(ix.data[0]).toBe(DISC_CANCEL_WITHDRAW);
    expect(ix.data.length).toBe(1);
    expect(ix.keys).toHaveLength(7);
    expect(ix.keys[0]!.isSigner).toBe(true);
    expect(ix.keys[0]!.isWritable).toBe(true);
    expect(ix.keys[1]!.isWritable).toBe(true);
    expect(ix.keys[2]!.isWritable).toBe(false);
    expect(ix.keys[3]!.isWritable).toBe(true);
    expect(ix.keys[4]!.isWritable).toBe(true);
    expect(ix.keys[5]!.pubkey.toBase58()).toBe(TOKEN_2022_PROGRAM_ID.toBase58());
    expect(ix.keys[6]!.pubkey.toBase58()).toBe(CLOCK_SYSVAR_ID.toBase58());
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
