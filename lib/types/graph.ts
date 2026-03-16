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
