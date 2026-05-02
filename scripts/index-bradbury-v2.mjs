#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const EXPLORER_API = "https://explorer-bradbury.genlayer.com/api/v1";
const EXPLORER_TX = "https://explorer-bradbury.genlayer.com/tx";
const CONTRACT_ADDRESS = (process.env.ECOSYSTEM_REGISTRY_ADDRESS || "0xCc8da31a8a4B283363C67086186a8Fe4Da8A973c").trim();
const OUTPUT = process.env.BRADBURY_INDEX_OUTPUT || "public/bradbury-v2-index.json";

const KNOWN_TXS = [
  {
    hash: "0x5542cacbe0e98c988fb812a771746cad30b8e8915dec3f7d1244b92878f07c5a",
    kind: "deploy",
    note: "Current live v2 registry deployment before the validator disagreement fix.",
  },
  {
    hash: "0xe0ff553073d066d92a624403c9c53df007d69bea03d4faaac5f8080d234913e6",
    kind: "submit_project",
    projectId: "genlayer-docs-live-test-20260502b",
    projectUrl: "https://docs.genlayer.com",
    note: "Paid submit proof; project was usable afterward, but explorer reported NONDET_DISAGREE.",
  },
  {
    hash: "0xad06a47f83294105329280735437485b7448ad1827cb93d86b0ee6724816d4e9",
    kind: "vote_project",
    projectId: "genlayer-docs-live-test-20260502b",
    note: "Paid project upvote proof.",
  },
  {
    hash: "0x102b577aa70fe58647d33e27f547d935b26b3525275111b4fa7a3c6c1a53adfa",
    kind: "propose_project_update",
    projectId: "genlayer-docs-live-test-20260502b",
    note: "Paid update proposal proof.",
  },
  {
    hash: "0x6b481a965033a2539f004b8b1a3826e7fe04c295ca1005bba79bebd62835259a",
    kind: "vote_update",
    projectId: "genlayer-docs-live-test-20260502b",
    note: "Paid update vote proof.",
  },
];

function txUrl(hash) {
  return `${EXPLORER_TX}/${hash}`;
}

function parseArgs(argv) {
  const txs = [];
  let dryRun = false;
  let output = OUTPUT;
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--output" && argv[i + 1]) output = argv[++i];
    else if (arg.startsWith("--output=")) output = arg.slice("--output=".length);
    else if (/^0x[0-9a-fA-F]{64}$/.test(arg)) txs.push({ hash: arg });
  }
  return { dryRun, output, txs };
}

async function fetchTx(hash) {
  const response = await fetch(`${EXPLORER_API}/transactions/${hash}`);
  if (!response.ok) {
    throw new Error(`Explorer API returned ${response.status} for ${hash}`);
  }
  return response.json();
}

function classifyOutcome(tx) {
  const result = tx.execution_result || "unknown";
  if (result === "FINISHED_WITH_RETURN") return "ok";
  if (result === "NONDET_DISAGREE") return "warning";
  if (result === "FINISHED_WITH_ERROR") return "error";
  return "unknown";
}

function normalizeTx(meta, apiTx) {
  const tx = apiTx || {};
  const hash = tx.hash || meta.hash;
  const valueWei = tx.value != null ? String(tx.value) : undefined;
  return {
    hash,
    explorerUrl: txUrl(hash),
    kind: meta.kind || tx.transaction_type || "unknown",
    projectId: meta.projectId,
    projectUrl: meta.projectUrl,
    note: meta.note,
    status: tx.status || "unknown",
    executionResult: tx.execution_result || "unknown",
    outcome: classifyOutcome(tx),
    valueWei,
    fromAddress: tx.from_address,
    toAddress: tx.to_address,
    rollupTransactionHash: tx.rollup_transaction_hash,
    transactionType: tx.transaction_type,
    consensusRoundCount: tx.enrichment_data?.rounds?.length,
    messageCount: tx.enrichment_data?.messages?.length,
  };
}

function summarize(transactions) {
  const counts = transactions.reduce((acc, tx) => {
    acc[tx.outcome] = (acc[tx.outcome] || 0) + 1;
    return acc;
  }, {});
  const hasSubmitWarning = transactions.some((tx) => tx.kind === "submit_project" && tx.executionResult === "NONDET_DISAGREE");
  return {
    totalTransactions: transactions.length,
    outcomes: counts,
    submitConsensusClean: !hasSubmitWarning,
    nextLiveStep: hasSubmitWarning
      ? "Redeploy validator-fixed contract and submit a fresh 0.042 GEN project; expect FINISHED_WITH_RETURN before treating submit consensus as clean."
      : "Submit evidence is clean for indexed transactions.",
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const txMetas = args.txs.length ? args.txs : KNOWN_TXS;
  const transactions = [];
  const errors = [];

  for (const meta of txMetas) {
    try {
      transactions.push(normalizeTx(meta, await fetchTx(meta.hash)));
    } catch (error) {
      errors.push({ hash: meta.hash, error: error.message });
      transactions.push({ ...normalizeTx(meta, null), outcome: "unverified", verificationError: error.message });
    }
  }

  const index = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    network: "Bradbury",
    contractAddress: CONTRACT_ADDRESS,
    explorerBaseUrl: EXPLORER_TX,
    source: "bradbury_explorer_tx_ledger",
    limitations: [
      "state_readback_not_implemented: this file indexes public transaction evidence from the Bradbury explorer API; it is not a decoded full contract-state sync.",
      "Static graph data still comes from public/ecosystem.json unless a future sync step promotes verified entries into that file.",
      "The indexed submit_project proof predates the validator disagreement fix and still reports NONDET_DISAGREE.",
    ],
    summary: summarize(transactions),
    transactions,
    errors,
  };

  const body = `${JSON.stringify(index, null, 2)}\n`;
  if (!args.dryRun) {
    await writeFile(path.resolve(args.output), body);
  }
  console.log(JSON.stringify({ output: args.dryRun ? null : args.output, summary: index.summary, errors: errors.length }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
