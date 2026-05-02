#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const EXPLORER_API = "https://explorer-bradbury.genlayer.com/api/v1";
const EXPLORER_TX = "https://explorer-bradbury.genlayer.com/tx";
const CONTRACT_ADDRESS = (process.env.ECOSYSTEM_REGISTRY_ADDRESS || "0x761D3C809A570EDC37d0f470A07aE2F74AE4a278").trim();
const OUTPUT = process.env.BRADBURY_INDEX_OUTPUT || "public/bradbury-v2-index.json";

const DEFAULT_KNOWN_TXS_FILE = process.env.BRADBURY_KNOWN_TXS_FILE || "data/bradbury-v2-known-txs.json";

function txUrl(hash) {
  return `${EXPLORER_TX}/${hash}`;
}

function parseArgs(argv) {
  const txs = [];
  let dryRun = false;
  let output = OUTPUT;
  let txFile = DEFAULT_KNOWN_TXS_FILE;
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--output" && argv[i + 1]) output = argv[++i];
    else if (arg.startsWith("--output=")) output = arg.slice("--output=".length);
    else if (arg === "--tx-file" && argv[i + 1]) txFile = argv[++i];
    else if (arg.startsWith("--tx-file=")) txFile = arg.slice("--tx-file=".length);
    else if (/^0x[0-9a-fA-F]{64}$/.test(arg)) txs.push({ hash: arg });
  }
  return { dryRun, output, txFile, txs };
}

async function loadKnownTxs(filePath) {
  const body = await readFile(path.resolve(filePath), "utf8");
  const data = JSON.parse(body);
  if (!Array.isArray(data)) {
    throw new Error(`Known tx file must contain an array: ${filePath}`);
  }
  for (const entry of data) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(entry.hash || "")) {
      throw new Error(`Known tx entry has invalid hash in ${filePath}`);
    }
  }
  return data;
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
  const txMetas = args.txs.length ? args.txs : await loadKnownTxs(args.txFile);
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
      "Known transaction metadata is loaded from data/bradbury-v2-known-txs.json or --tx-file; future arbitrary submissions still need event discovery or a supported read path.",
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
