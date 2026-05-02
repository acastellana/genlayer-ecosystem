#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const DEFAULT_INDEX = "public/bradbury-v2-index.json";
const DEFAULT_GRAPHS = ["public/ecosystem.json", "ecosystem.json"];

function parseArgs(argv) {
  const graphs = [];
  let index = DEFAULT_INDEX;
  let dryRun = false;
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--index" && argv[i + 1]) index = argv[++i];
    else if (arg.startsWith("--index=")) index = arg.slice("--index=".length);
    else if (arg === "--graph" && argv[i + 1]) graphs.push(argv[++i]);
    else if (arg.startsWith("--graph=")) graphs.push(arg.slice("--graph=".length));
  }
  return { index, graphs: graphs.length ? graphs : DEFAULT_GRAPHS, dryRun };
}

function isCleanSubmit(tx) {
  return tx.kind === "submit_project" && tx.consensusLooksClean === true && ["ok", "pending_ok"].includes(tx.outcome);
}

function nodeFromSubmit(tx, index) {
  if (!tx.projectId || !tx.projectName || !tx.projectUrl) return null;
  return {
    id: tx.projectId,
    name: tx.projectName,
    kind: tx.projectKind || "Bradbury v2 submission",
    tagline: tx.tagline || "Live Bradbury-evaluated GenLayer ecosystem submission.",
    description: tx.description || tx.note || "Submitted through the Bradbury v2 EcosystemRegistry flow.",
    logo: tx.logo || "assets/logos/genlayer-mark.svg",
    accent: tx.accent || "#2563eb",
    position: tx.position || { x: 50, y: 84 },
    size: tx.size || 112,
    tags: tx.tags || ["Bradbury v2", "Paid evaluation", "Live consensus"],
    status: tx.outcome === "pending_ok" ? "pending finality" : "evaluated",
    evaluation: {
      source: "genlayer_evaluated",
      label: tx.outcome === "pending_ok" ? "Bradbury consensus clean; awaiting finality" : "Bradbury v2 evaluated",
      network: index.network || "Bradbury",
      fee: "0.042 GEN",
      status: tx.outcome === "pending_ok" ? "pending" : "accepted",
      submittedBy: tx.fromAddress,
      txUrl: tx.explorerUrl,
      note: tx.note,
    },
    links: [
      { label: "Website", url: tx.projectUrl },
      { label: "GenLayer transaction", url: tx.explorerUrl },
    ],
  };
}

function edgeKey(edge) {
  return `${edge.source}->${edge.target}:${edge.label}`;
}

function syncGraph(graph, index) {
  const submissions = index.transactions.filter(isCleanSubmit);
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const edgesByKey = new Set(graph.edges.map(edgeKey));
  const addedNodes = [];
  const updatedNodes = [];
  const addedEdges = [];

  for (const tx of submissions) {
    const node = nodeFromSubmit(tx, index);
    if (!node) continue;
    const existing = nodesById.get(node.id);
    if (existing) {
      Object.assign(existing, {
        name: node.name,
        kind: node.kind,
        tagline: node.tagline,
        description: node.description,
        logo: node.logo,
        accent: node.accent,
        position: node.position,
        size: node.size,
        tags: node.tags,
        status: node.status,
        evaluation: node.evaluation,
      });
      existing.links = existing.links || [];
      const linkUrls = new Set(existing.links.map((link) => link.url));
      for (const link of node.links) {
        if (!linkUrls.has(link.url)) existing.links.push(link);
      }
      updatedNodes.push(node.id);
    } else {
      graph.nodes.push(node);
      nodesById.set(node.id, node);
      addedNodes.push(node.id);
    }

    const relationships = tx.relationships?.length
      ? tx.relationships
      : [{ target_id: "genlayer", label: "documents", note: "Bradbury v2 submission metadata links this project to GenLayer." }];
    for (const rel of relationships) {
      const edge = {
        source: node.id,
        target: rel.target_id || rel.target || "genlayer",
        label: rel.label || "related to",
        note: rel.note,
      };
      const key = edgeKey(edge);
      if (!edgesByKey.has(key)) {
        graph.edges.push(edge);
        edgesByKey.add(key);
        addedEdges.push(key);
      }
    }
  }

  graph.meta = graph.meta || {};
  graph.meta.sources = graph.meta.sources || [];
  const note = `Bradbury v2 static graph sync from ${index.contractAddress}; clean submissions are promoted only from public explorer tx evidence and retain tx links.`;
  if (!graph.meta.sources.some((source) => source.note === note)) {
    graph.meta.sources.push({ type: "bradbury-v2-static-sync", note });
  }

  return { addedNodes, updatedNodes, addedEdges };
}

async function main() {
  const args = parseArgs(process.argv);
  const index = JSON.parse(await readFile(args.index, "utf8"));
  const results = [];
  for (const graphPath of args.graphs) {
    const graph = JSON.parse(await readFile(graphPath, "utf8"));
    const result = syncGraph(graph, index);
    if (!args.dryRun) await writeFile(graphPath, `${JSON.stringify(graph, null, 2)}\n`);
    results.push({ graph: graphPath, ...result });
  }
  console.log(JSON.stringify({ dryRun: args.dryRun, results }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
