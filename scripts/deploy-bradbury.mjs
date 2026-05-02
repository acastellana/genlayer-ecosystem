#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createAccount, createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const args = process.argv.slice(2);
const send = args.includes("--send");
const contractArg = args.find((a) => a.startsWith("--contract="));
const ctorArg = args.find((a) => a.startsWith("--args="));
const contractPath = path.resolve(process.cwd(), contractArg?.split("=").slice(1).join("=") || "contracts/EcosystemRegistry.py");
const rpcUrl = process.env.GENLAYER_RPC_URL || testnetBradbury.rpcUrls.default.http[0];
const constructorArgs = ctorArg ? JSON.parse(ctorArg.split("=").slice(1).join("=")) : [];

function redactUrl(value) {
  return value ? "<REDACTED_URL>" : undefined;
}

async function getDeployerKey() {
  if (/^0x[0-9a-fA-F]{64}$/.test(process.env.DEPLOYER_PRIVATE_KEY || "")) {
    return { key: process.env.DEPLOYER_PRIVATE_KEY, source: "DEPLOYER_PRIVATE_KEY" };
  }
  const accountName = process.env.GENLAYER_ACCOUNT_NAME || "party-b";
  let keytar;
  try {
    ({ default: keytar } = await import("keytar"));
  } catch (err) {
    throw new Error(`Set DEPLOYER_PRIVATE_KEY or install/unlock keytar-backed GenLayer account ${accountName}: ${err.message}`);
  }
  const key = await keytar.getPassword("genlayer-cli", `account:${accountName}`);
  if (/^0x[0-9a-fA-F]{64}$/.test(key || "")) {
    return { key, source: `keychain:${accountName}` };
  }
  throw new Error("Set DEPLOYER_PRIVATE_KEY or unlock GENLAYER_ACCOUNT_NAME in the GenLayer CLI keychain");
}

async function rpc(method, params = []) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`${method}: ${json.error.message || JSON.stringify(json.error)}`);
  return json.result;
}

if (!fs.existsSync(contractPath)) {
  throw new Error(`Contract file not found: ${contractPath}`);
}
const code = fs.readFileSync(contractPath, "utf8");
if (!code.trim()) throw new Error(`Contract file is empty: ${contractPath}`);

const chainId = await rpc("eth_chainId");
const consensusCode = await rpc("eth_getCode", [testnetBradbury.consensusMainContract.address, "latest"]);

console.log("Bradbury deploy configuration:");
console.log({
  rpc: redactUrl(rpcUrl),
  chainId,
  sdkChain: testnetBradbury.name,
  sdkChainId: testnetBradbury.id,
  consensusMain: testnetBradbury.consensusMainContract.address,
  consensusMainCodeBytes: (consensusCode.length - 2) / 2,
  contractPath,
  constructorArgs,
  dryRun: !send,
});

if (!send) {
  console.log("Dry run only: no transaction sent. Re-run with --send and DEPLOYER_PRIVATE_KEY to deploy.");
  process.exit(0);
}

const { key: deployerKey, source: deployerKeySource } = await getDeployerKey();
const account = createAccount(deployerKey);
const client = createClient({
  chain: testnetBradbury,
  endpoint: rpcUrl,
  account,
});

console.log(`Deploying from ${account.address} (${deployerKeySource}) ...`);
const txHash = await client.deployContract({
  code,
  args: constructorArgs,
  leaderOnly: false,
});
console.log(`GenLayer deployment tx: ${txHash}`);

const receipt = await client.waitForTransactionReceipt({
  hash: txHash,
  status: "ACCEPTED",
  retries: Number(process.env.GENLAYER_DEPLOY_RECEIPT_RETRIES || 80),
  interval: Number(process.env.GENLAYER_DEPLOY_RECEIPT_INTERVAL_MS || 5000),
});
console.log("Deployment receipt:");
console.log(receipt);
if (receipt?.data?.contract_address) {
  console.log(`Contract address: ${receipt.data.contract_address}`);
}
