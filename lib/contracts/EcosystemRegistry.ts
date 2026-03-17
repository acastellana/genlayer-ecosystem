import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

export const CONTRACT_ADDRESS = "0xd77F1Df3103AfB8715b715992b2DBaf8d5529134" as `0x${string}`;
export const SUBMISSION_FEE = BigInt("1000000000000000000"); // 1 GEN in wei
export const RPC_URL = "https://zksync-os-testnet-genlayer.zksync.dev";

// GenLayer explorer uses the GenLayer-layer hash, not the ZKSync rollup hash.
export const EXPLORER_TX = (hash: string) =>
  `https://explorer-bradbury.genlayer.com/transactions/${hash}`;

/**
 * After submitPlayer returns a ZKSync rollup hash, extract the GenLayer-layer
 * tx hash from the receipt logs. The dispatch event emits the GenLayer hash as
 * topic[1] (event sig: 0x8da32500...).
 */
export async function getGenLayerTxHash(rollupHash: `0x${string}`): Promise<`0x${string}`> {
  const DISPATCH_SIG = "0x8da32500fbd0be8afe0905a3b7ea5f782f1d7d731e9fdaabea50d69f14e933ce";

  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_getTransactionReceipt",
      params: [rollupHash],
      id: 1,
    }),
  });
  const json = await res.json();
  const logs: Array<{ topics: string[] }> = json?.result?.logs ?? [];
  const dispatchLog = logs.find((l) => l.topics[0] === DISPATCH_SIG);
  if (dispatchLog?.topics[1]) {
    // topic[1] is a 32-byte padded address — trim to 32-byte hex
    return dispatchLog.topics[1] as `0x${string}`;
  }
  // Fallback: return rollup hash so the link still works (just won't resolve on GenLayer explorer)
  return rollupHash;
}

export function getEcosystemRegistry(address?: string | null) {
  const config: Record<string, unknown> = { chain: testnetBradbury };
  if (address) config.account = address as `0x${string}`;
  // Pass MetaMask provider so genlayer-js can sign txs via the browser wallet
  if (typeof window !== "undefined" && (window as any).ethereum) {
    config.provider = (window as any).ethereum;
  }
  const client = createClient(config as any);

  return {
    async submitPlayer(url: string): Promise<`0x${string}`> {
      return (await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "submit_player",
        args: [url],
        value: SUBMISSION_FEE,
      })) as `0x${string}`;
    },
  };
}
