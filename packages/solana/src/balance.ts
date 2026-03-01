import { type Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);

const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
);

export const SPL_TOKEN_PROGRAM_ID = TOKEN_PROGRAM_ID.toBase58();
export const SPL_TOKEN_2022_PROGRAM_ID = TOKEN_2022_PROGRAM_ID.toBase58();

export interface TokenBalance {
  mint: string;
  decimals: number;
  amount: string;
  uiAmount: number;
  programId: string;
}

export interface WalletBalances {
  sol: number;
  tokens: TokenBalance[];
}

export async function getSolBalance(
  connection: Connection,
  address: string,
): Promise<number> {
  const pubkey = new PublicKey(address);
  const lamports = await connection.getBalance(pubkey);
  return lamports / LAMPORTS_PER_SOL;
}

export async function getTokenBalances(
  connection: Connection,
  address: string,
): Promise<TokenBalance[]> {
  const pubkey = new PublicKey(address);

  const [splAccounts, token2022Accounts] = await Promise.all([
    connection.getParsedTokenAccountsByOwner(pubkey, {
      programId: TOKEN_PROGRAM_ID,
    }),
    connection.getParsedTokenAccountsByOwner(pubkey, {
      programId: TOKEN_2022_PROGRAM_ID,
    }),
  ]);

  const mapAccount = (programId: string) => (account: (typeof splAccounts.value)[number]) => {
    const info = account.account.data.parsed as {
      info: {
        mint: string;
        tokenAmount: {
          amount: string;
          uiAmount: number | null;
          decimals: number;
        };
      };
    };
    return {
      mint: info.info.mint,
      decimals: info.info.tokenAmount.decimals,
      amount: info.info.tokenAmount.amount,
      uiAmount: info.info.tokenAmount.uiAmount ?? 0,
      programId,
    };
  };

  return [
    ...splAccounts.value.map(mapAccount(SPL_TOKEN_PROGRAM_ID)),
    ...token2022Accounts.value.map(mapAccount(SPL_TOKEN_2022_PROGRAM_ID)),
  ].filter((token) => token.uiAmount > 0);
}

export async function getWalletBalances(
  connection: Connection,
  address: string,
): Promise<WalletBalances> {
  const [sol, tokens] = await Promise.all([
    getSolBalance(connection, address),
    getTokenBalances(connection, address),
  ]);
  return { sol, tokens };
}
