#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const EXPLORER_API = "https://explorer-bradbury.genlayer.com/api/v1";
const EXPLORER_TX = "https://explorer-bradbury.genlayer.com/tx";
const CONTRACT_ADDRESS = (process.env.ECOSYSTEM_REGISTRY_ADDRESS || "0x761D3C809A570EDC37d0f470A07aE2F74AE4a278").trim();
const OUTPUT = process.env.BRADBURY_INDEX_OUTPUT || "public/bradbury-v2-index.json";

const KNOWN_TXS = [
  {
    hash: "0x5542cacbe0e98c988fb812a771746cad30b8e8915dec3f7d1244b92878f07c5a",
    kind: "deploy",
    note: "Current live v2 registry deployment before the validator disagreement fix.",
  },
  {
    hash: "0x4f283f4b105c07e88be068a066efa9207d486a76eeb79788fd2608375d2a8efb",
    kind: "deploy",
    note: "Validator-fixed v2 registry deployment; SDK receipt recipient is the active contract address.",
  },
  {
    hash: "0xe0ff553073d066d92a624403c9c53df007d69bea03d4faaac5f8080d234913e6",
    kind: "submit_project",
    projectId: "genlayer-docs-live-test-20260502b",
    projectUrl: "https://docs.genlayer.com",
    note: "Paid submit proof; project was usable afterward, but explorer reported NONDET_DISAGREE.",
  },
  {
    hash: "0x9c5a913733dadf6b40a0242f022a26d887d0a1aa43b5a8de585af3816230e065",
    kind: "submit_project",
    projectId: "genlayer-docs-live-test-20260502c",
    projectUrl: "https://docs.genlayer.com",
    projectName: "GenLayer Docs",
    projectKind: "developer resource",
    description: "Official GenLayer documentation for protocol concepts, Intelligent Contracts, tooling, and developer workflow. This entry was promoted from a validator-fixed 0.042 GEN Bradbury v2 submit_project transaction.",
    tagline: "Official documentation promoted from a clean validator-fixed Bradbury v2 submit.",
    category: "DEVELOPER TOOLING",
    tags: ["Docs", "Developer tooling", "Bradbury v2"],
    relationships: [
      {
        target_id: "genlayer",
        label: "documents",
        note: "The documentation explains GenLayer concepts, contracts, and developer workflow.",
      },
    ],
    position: { x: 68, y: 88 },
    note: "Validator-fixed paid submit retest; finalized with a majority FINISHED_WITH_RETURN consensus round. Explorer execution_result is currently null, so the ledger classifies by consensus evidence.",
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

function consensusLooksClean(tx) {
  const rounds = tx.enrichment_data?.rounds || [];
  return rounds.some((round) => {
    const validators = round.validators || [];
    const returnVotes = validators.filter((validator) => validator.vote === "finished_with_return").length;
    return round.result === "majority_agree" && returnVotes >= 3;
  });
}

function classifyOutcome(tx) {
  const result = tx.execution_result || "unknown";
  if (result === "FINISHED_WITH_RETURN") return "ok";
  if (result === "NONDET_DISAGREE") return "warning";
  if (result === "FINISHED_WITH_ERROR") return "error";
  if (tx.status === "finalized" && consensusLooksClean(tx)) return "ok";
  if (tx.status === "accepted" && consensusLooksClean(tx)) return "pending_ok";
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
    projectName: meta.projectName,
    projectKind: meta.projectKind,
    description: meta.description,
    tagline: meta.tagline,
    category: meta.category,
    tags: meta.tags,
    relationships: meta.relationships,
    position: meta.position,
    note: meta.note,
    status: tx.status || "unknown",
    executionResult: tx.execution_result || "unknown",
    outcome: classifyOutcome(tx),
    consensusLooksClean: consensusLooksClean(tx),
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
  const latestSubmit = [...transactions].reverse().find((tx) => tx.kind === "submit_project");
  const latestSubmitClean = Boolean(latestSubmit && (latestSubmit.executionResult === "FINISHED_WITH_RETURN" || latestSubmit.outcome === "ok" || latestSubmit.outcome === "pending_ok"));
  return {
    totalTransactions: transactions.length,
    outcomes: counts,
    submitConsensusClean: latestSubmitClean,
    nextLiveStep: latestSubmit?.outcome === "pending_ok"
      ? "Wait for Bradbury finalization of the validator-fixed submit; current consensus evidence is majority FINISHED_WITH_RETURN."
      : latestSubmitClean
        ? "Validator-fixed submit evidence is clean for the latest indexed submit. Next product step is full state readback/static graph sync."
        : hasSubmitWarning
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
      "The older indexed submit_project proof predates the validator disagreement fix and reports NONDET_DISAGREE; the validator-fixed submit is tracked separately.",
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
