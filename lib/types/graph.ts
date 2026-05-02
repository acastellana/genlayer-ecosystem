export type EvaluationSource = "curated" | "genlayer_evaluated" | "pending" | "needs_review";

export interface EcosystemEvaluation {
  source: EvaluationSource;
  label: string;
  network?: "Bradbury" | string;
  fee?: string;
  status?: "accepted" | "pending" | "needs_review" | "rejected" | string;
  score?: number;
  confidence?: number;
  submittedBy?: string;
  txUrl?: string;
  note?: string;
}

export interface EcosystemNode {
  id: string;
  name: string;
  kind: string;
  tagline: string;
  description: string;
  logo: string;
  accent?: string;
  position: { x: number; y: number };
  size: number;
  tags: string[];
  links: { label: string; url: string }[];
  status?: string;
  evaluation?: EcosystemEvaluation;
}

export interface EcosystemEdge {
  source: string;
  target: string;
  label: string;
  note?: string;
}

export interface BradburyV2Transaction {
  hash: string;
  explorerUrl: string;
  kind: "deploy" | "submit_project" | "vote_project" | "propose_project_update" | "vote_update" | string;
  projectId?: string;
  projectUrl?: string;
  projectName?: string;
  projectKind?: string;
  description?: string;
  tagline?: string;
  category?: string;
  tags?: string[];
  relationships?: { target_id?: string; target?: string; label?: string; note?: string }[];
  note?: string;
  support?: boolean;
  updateId?: number;
  patch?: Record<string, unknown>;
  status: string;
  executionResult: string;
  outcome: "ok" | "warning" | "error" | "unknown" | "unverified" | string;
  consensusLooksClean?: boolean;
  valueWei?: string;
  fromAddress?: string;
  toAddress?: string;
  rollupTransactionHash?: string;
}

export interface BradburyV2Index {
  schemaVersion: number;
  generatedAt: string;
  network: "Bradbury" | string;
  contractAddress: string;
  explorerBaseUrl: string;
  source: "bradbury_explorer_tx_ledger" | string;
  limitations: string[];
  summary?: {
    totalTransactions: number;
    outcomes: Record<string, number>;
    submitConsensusClean: boolean;
    nextLiveStep: string;
  };
  stateReadback?: {
    mode: string;
    status: "available" | "blocked" | "unavailable" | string;
    contractStateAvailable: boolean;
    address?: string;
    addressType?: string;
    contractPresent?: boolean;
    balanceWei?: string;
    nonce?: string;
    note: string;
  };
  community?: {
    totals: {
      upvotes: number;
      downvotes: number;
      updateProposals: number;
      updateVotesUp: number;
      updateVotesDown: number;
    };
    projects: Array<{
      projectId: string;
      upvotes: number;
      downvotes: number;
      updateProposals: number;
      updateVotesUp: number;
      updateVotesDown: number;
      transactions: Array<{
        hash: string;
        explorerUrl: string;
        kind: string;
        outcome: string;
        support?: boolean;
        updateId?: number;
        note?: string;
      }>;
    }>;
  };
  transactions: BradburyV2Transaction[];
  errors?: { hash: string; error: string }[];
}

export interface EcosystemGraph {
  meta?: { title: string; subtitle: string };
  nodes: EcosystemNode[];
  edges: EcosystemEdge[];
}
