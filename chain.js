/**
 * chain.js — GenLayer Bradbury integration for the ecosystem map
 *
 * CURRENT STATE (Bradbury):
 *   - Write (submit_player): works via MetaMask → on-chain tx
 *   - Read  (get_players):   NOT AVAILABLE — Bradbury has no public gen_call endpoint yet
 *                            Falls back to ecosystem.json
 *
 * When Bradbury gets a public GenLayer execution node, swap READS_FROM_CHAIN = true
 * and add the endpoint URL — zero other changes needed.
 */

export const CONTRACT_ADDRESS = "0xd77F1Df3103AfB8715b715992b2DBaf8d5529134";
export const BRADBURY_CHAIN_ID  = "0x107d"; // 4221
export const BRADBURY_RPC       = "https://zksync-os-testnet-genlayer.zksync.dev";
export const SUBMISSION_FEE_WEI = "0xDE0B6B3A7640000"; // 1 GEN = 1e18 wei

// ─── Feature flag ─────────────────────────────────────────────────────────────
// Flip to true + set GENLAYER_EXECUTION_RPC once the testnet execution node is live.
const READS_FROM_CHAIN = false;
const GENLAYER_EXECUTION_RPC = null; // e.g. "https://execution.testnet-bradbury.genlayer.com"

// ─── Read ──────────────────────────────────────────────────────────────────────

export async function getPlayers(fallbackJsonUrl) {
  if (!READS_FROM_CHAIN || !GENLAYER_EXECUTION_RPC) {
    // Fallback: static ecosystem.json
    const res = await fetch(fallbackJsonUrl);
    if (!res.ok) throw new Error(`Failed to load ${fallbackJsonUrl}: ${res.status}`);
    const data = await res.json();
    return data; // full graph object with nodes + edges
  }

  // On-chain read via gen_call (future)
  const { createClient, createAccount } = await import("genlayer-js");
  const { testnetBradbury } = await import("genlayer-js/chains");
  const client = createClient({ chain: testnetBradbury, endpoint: GENLAYER_EXECUTION_RPC });
  const players = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_players",
    args: [],
  });
  return contractPlayersToGraph(typeof players === "string" ? JSON.parse(players) : players);
}

// Convert contract player array → ecosystem graph format
function contractPlayersToGraph(players) {
  // Auto-layout: center = genlayer, others in a circle
  const nodes = players.map((p, i) => {
    const isCenter = p.name.toLowerCase() === "genlayer";
    const angle = (2 * Math.PI * i) / (players.length - 1);
    const r = 35;
    return {
      id: p.name.toLowerCase().replace(/[^a-z0-9]/g, ""),
      name: p.name,
      kind: labelToKind(p.label),
      tagline: p.description,
      description: p.description,
      logo: `https://www.google.com/s2/favicons?domain=${new URL(p.url).hostname}&sz=64`,
      accent: "#111827",
      position: isCenter
        ? { x: 50, y: 50 }
        : { x: Math.round(50 + r * Math.cos(angle)), y: Math.round(50 + r * Math.sin(angle)) },
      size: isCenter ? 188 : 130,
      tags: [p.label],
      links: [{ label: "Website", url: p.url }],
    };
  });

  const edges = players.flatMap(p => {
    const srcId = p.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    return (p.connections ?? []).map(conn => ({
      source: srcId,
      target: conn.toLowerCase().replace(/[^a-z0-9]/g, ""),
      label: "connects to",
      note: "",
    }));
  });

  return { nodes, edges };
}

function labelToKind(label) {
  const map = {
    "INFRASTRUCTURE": "core layer",
    "DEVELOPER TOOLING": "developer tooling",
    "RESOLVES DISPUTES": "protocol surface",
    "DISPUTE RESOLUTION": "application",
    "TRADE FINANCE": "application",
    "TOKEN LAUNCH": "application",
    "AWARENESS": "application",
    "DATA LAYER": "data layer",
    "GAMING": "application",
    "DEFI": "application",
  };
  return map[label] ?? "application";
}

// ─── Write (MetaMask) ──────────────────────────────────────────────────────────

export function hasWallet() {
  return typeof window !== "undefined" && !!window.ethereum;
}

export async function ensureBradburyNetwork() {
  const provider = window.ethereum;
  const chainId = await provider.request({ method: "eth_chainId" });
  if (chainId === BRADBURY_CHAIN_ID) return;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BRADBURY_CHAIN_ID }],
    });
  } catch (err) {
    if (err.code === 4902 || err.code === -32603) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: BRADBURY_CHAIN_ID,
          chainName: "GenLayer Bradbury Testnet",
          nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
          rpcUrls: [BRADBURY_RPC],
          blockExplorerUrls: ["https://explorer-bradbury.genlayer.com"],
        }],
      });
    } else {
      throw err;
    }
  }
}

export async function submitPlayer(url) {
  const provider = window.ethereum;
  if (!provider) throw new Error("No wallet found. Install MetaMask.");

  await ensureBradburyNetwork();
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const from = accounts[0];

  // Encode submit_player(string url) in GenLayer msgpack format
  // GenLayer uses msgpack-encoded calldata via genlayer-js SDK internals
  // We load the SDK dynamically to use its encoder
  const { createClient, createAccount } = await import("genlayer-js");
  const { testnetBradbury } = await import("genlayer-js/chains");

  // Use address-only account (MetaMask signs)
  const client = createClient({ chain: testnetBradbury, account: from });

  const txHash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "submit_player",
    args: [url],
    value: BigInt(SUBMISSION_FEE_WEI),
  });

  return txHash;
}

export const EXPLORER_TX   = (hash) => `https://explorer-bradbury.genlayer.com/tx/${hash}`;
export const EXPLORER_BASE = "https://explorer-bradbury.genlayer.com";
