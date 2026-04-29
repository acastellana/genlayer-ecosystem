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

export interface EcosystemGraph {
  meta?: { title: string; subtitle: string };
  nodes: EcosystemNode[];
  edges: EcosystemEdge[];
}
