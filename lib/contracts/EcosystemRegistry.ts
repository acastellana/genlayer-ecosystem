import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

export const CONTRACT_ADDRESS = "0x761D3C809A570EDC37d0f470A07aE2F74AE4a278" as `0x${string}`;
export const SUBMISSION_FEE = BigInt("42000000000000000"); // 0.042 GEN in wei
export const ACTION_FEE = BigInt("4200000000000000"); // 0.0042 GEN in wei
export const RPC_URL = "https://zksync-os-testnet-genlayer.zksync.dev";
// Validator-fixed Bradbury v2 registry deployed and submit-tested on 2026-05-02.
export const REGISTRY_V2_DEPLOYED = true;

export interface RelationshipClaim {
  target_id: string;
  label: string;
  note?: string;
}

export interface ProjectSubmissionMetadata {
  id?: string;
  name: string;
  description: string;
  category: string;
  tags?: string[];
  relationships: RelationshipClaim[];
}

export interface ProjectUpdatePatch {
  description?: string;
  category?: string;
  relationships_add?: RelationshipClaim[];
  relationships_remove?: RelationshipClaim[];
  note?: string;
}

// GenLayer explorer uses the GenLayer-layer hash, not the ZKSync rollup hash.
export const EXPLORER_TX = (hash: string) =>
  `https://explorer-bradbury.genlayer.com/tx/${hash}`;

/**
 * After a contract write returns a ZKSync rollup hash, extract the GenLayer-layer
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
    return dispatchLog.topics[1] as `0x${string}`;
  }
  // Fallback: return rollup hash so the link still works (just won't resolve on GenLayer explorer)
  return rollupHash;
}

function createRegistryClient(address?: string | null) {
  const config: Record<string, unknown> = { chain: testnetBradbury };
  if (address) config.account = address as `0x${string}`;
  // Pass MetaMask provider so genlayer-js can sign txs via the browser wallet
  if (typeof window !== "undefined" && (window as any).ethereum) {
    config.provider = (window as any).ethereum;
  }
  return createClient(config as any);
}

async function writeAndResolveGenLayerHash(writePromise: Promise<unknown>): Promise<`0x${string}`> {
  const rollupHash = (await writePromise) as `0x${string}`;
  return getGenLayerTxHash(rollupHash);
}

export function getEcosystemRegistry(address?: string | null) {
  const client = createRegistryClient(address);

  return {
    async submitPlayer(url: string): Promise<`0x${string}`> {
      return writeAndResolveGenLayerHash(client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "submit_player",
        args: [url],
        value: SUBMISSION_FEE,
      }));
    },

    async submitProject(url: string, metadata: ProjectSubmissionMetadata): Promise<`0x${string}`> {
      return writeAndResolveGenLayerHash(client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "submit_project",
        args: [url, JSON.stringify(metadata)],
        value: SUBMISSION_FEE,
      }));
    },

    async voteProject(projectId: string, support: boolean): Promise<`0x${string}`> {
      return writeAndResolveGenLayerHash(client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "vote_project",
        args: [projectId, support],
        value: ACTION_FEE,
      }));
    },

    async proposeProjectUpdate(projectId: string, patch: ProjectUpdatePatch): Promise<`0x${string}`> {
      return writeAndResolveGenLayerHash(client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "propose_project_update",
        args: [projectId, JSON.stringify(patch)],
        value: ACTION_FEE,
      }));
    },
  };
}
