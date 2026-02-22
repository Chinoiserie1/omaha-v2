declare module "@glamsystems/ix-mapper" {
  import type { PublicKey, TransactionInstruction } from "@solana/web3.js";

  export function mapToGlamIx(
    ix: TransactionInstruction,
    glamState: PublicKey,
    glamSigner: PublicKey
  ): TransactionInstruction | null;
}
