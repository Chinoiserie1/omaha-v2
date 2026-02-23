import { Connection, type Commitment } from "@solana/web3.js";

const connections = new Map<string, Connection>();

export function getConnection(
  rpcUrl: string,
  commitment: Commitment = "confirmed",
): Connection {
  const key = `${rpcUrl}:${commitment}`;
  let connection = connections.get(key);
  if (!connection) {
    connection = new Connection(rpcUrl, commitment);
    connections.set(key, connection);
  }
  return connection;
}
