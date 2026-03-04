import { PublicKey, TransactionInstruction } from "@solana/web3.js";

export interface JupiterInstructionPayload {
  programId: string;
  accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
  data: string; // base64
}

export function deserializeInstruction(
  ix: JupiterInstructionPayload,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(ix.programId),
    keys: ix.accounts.map((key) => ({
      pubkey: new PublicKey(key.pubkey),
      isSigner: key.isSigner,
      isWritable: key.isWritable,
    })),
    data: Buffer.from(ix.data, "base64"),
  });
}
