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
  note?: string;
  status: string;
  executionResult: string;
  outcome: "ok" | "warning" | "error" | "unknown" | "unverified" | string;
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
  transactions: BradburyV2Transaction[];
  errors?: { hash: string; error: string }[];
}

export interface EcosystemGraph {
  meta?: { title: string; subtitle: string };
  nodes: EcosystemNode[];
  edges: EcosystemEdge[];
}
