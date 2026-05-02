export type BradburyTxOutcome = "ok" | "warning" | "error" | "pending_ok" | "pending" | "unknown";

export interface BradburyExplorerTxStatus {
  hash: `0x${string}`;
  status: string;
  executionResult: string;
  outcome: BradburyTxOutcome;
  consensusLooksClean: boolean;
  rollupTransactionHash?: string;
  finalized: boolean;
  explorerUrl: string;
  summary: string;
}

const EXPLORER_API = "https://explorer-bradbury.genlayer.com/api/v1";
const EXPLORER_TX = "https://explorer-bradbury.genlayer.com/tx";

export function explorerTxUrl(hash: string) {
  return `${EXPLORER_TX}/${hash}`;
}

function consensusLooksClean(tx: any) {
  const rounds = tx?.enrichment_data?.rounds || [];
  return rounds.some((round: any) => {
    const validators = round?.validators || [];
    const returnVotes = validators.filter((validator: any) => validator?.vote === "finished_with_return").length;
    return round?.result === "majority_agree" && returnVotes >= 3;
  });
}

function classifyOutcome(tx: any): BradburyTxOutcome {
  const result = tx?.execution_result || "unknown";
  if (result === "FINISHED_WITH_RETURN") return "ok";
  if (result === "NONDET_DISAGREE") return "warning";
  if (result === "FINISHED_WITH_ERROR") return "error";
  if (tx?.status === "finalized" && consensusLooksClean(tx)) return "ok";
  if (tx?.status === "accepted" && consensusLooksClean(tx)) return "pending_ok";
  if (tx?.status === "accepted" || tx?.status === "pending") return "pending";
  return "unknown";
}

function summarizeStatus(status: string, executionResult: string, outcome: BradburyTxOutcome, cleanConsensus: boolean) {
  if (outcome === "ok" && executionResult === "unknown" && cleanConsensus) {
    return "Finalized with clean majority consensus; explorer top-level result is still unknown.";
  }
  if (outcome === "ok") return "Finalized successfully.";
  if (outcome === "pending_ok") return "Accepted with clean consensus evidence; waiting for finalization/indexer update.";
  if (outcome === "warning") return "Finalized with consensus warning; review before promoting into the graph.";
  if (outcome === "error") return "Finalized with execution error; needs review.";
  if (outcome === "pending") return "Transaction is accepted/pending; keep this page open or check explorer.";
  return `${status || "Unknown status"}; explorer result ${executionResult || "unknown"}.`;
}

export async function fetchBradburyTxStatus(hash: string): Promise<BradburyExplorerTxStatus> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    throw new Error("Expected a GenLayer transaction hash.");
  }
  const response = await fetch(`${EXPLORER_API}/transactions/${hash}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Bradbury explorer returned ${response.status}.`);
  }
  const tx = await response.json();
  const status = tx?.status || "unknown";
  const executionResult = tx?.execution_result || "unknown";
  const cleanConsensus = consensusLooksClean(tx);
  const outcome = classifyOutcome(tx);
  return {
    hash: hash as `0x${string}`,
    status,
    executionResult,
    outcome,
    consensusLooksClean: cleanConsensus,
    rollupTransactionHash: tx?.rollup_transaction_hash,
    finalized: status === "finalized",
    explorerUrl: explorerTxUrl(hash),
    summary: summarizeStatus(status, executionResult, outcome, cleanConsensus),
  };
}
