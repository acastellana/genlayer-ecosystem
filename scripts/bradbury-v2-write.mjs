#!/usr/bin/env node
import { createAccount, createClient } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';

const CONTRACT_ADDRESS = process.env.ECOSYSTEM_REGISTRY_ADDRESS;
const accountName = process.env.GENLAYER_ACCOUNT_NAME || 'party-b';
const SUBMISSION_FEE = 42_000_000_000_000_000n;
const ACTION_FEE = 4_200_000_000_000_000n;
const action = process.argv[2];
if (!CONTRACT_ADDRESS) throw new Error('ECOSYSTEM_REGISTRY_ADDRESS is required');
async function getSignerKey() {
  if (/^0x[0-9a-fA-F]{64}$/.test(process.env.DEPLOYER_PRIVATE_KEY || '')) return process.env.DEPLOYER_PRIVATE_KEY;
  let keytar;
  try {
    ({ default: keytar } = await import('keytar'));
  } catch (err) {
    throw new Error(`Set DEPLOYER_PRIVATE_KEY or install/unlock keytar-backed GenLayer account ${accountName}: ${err.message}`);
  }
  const key = await keytar.getPassword('genlayer-cli', `account:${accountName}`);
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error(`No unlocked key for ${accountName}`);
  return key;
}
const key = await getSignerKey();
const account = createAccount(key);
const client = createClient({ chain: testnetBradbury, endpoint: process.env.GENLAYER_RPC_URL || testnetBradbury.rpcUrls.default.http[0], account });
console.log(JSON.stringify({ accountName, account: account.address, contract: CONTRACT_ADDRESS, action }));

async function explorer(tx) {
  const url = `https://explorer-bradbury.genlayer.com/api/v1/transactions/${tx}`;
  for (let i=0;i<100;i++) {
    try {
      const r = await fetch(url);
      if (r.ok) {
        const j = await r.json();
        console.log(JSON.stringify({poll:i,status:j.status,execution_result:j.execution_result,tx,rollup:j.rollup_transaction_hash || null}));
        if (j.status === 'accepted' || j.status === 'finalized' || j.execution_result) return j;
      } else {
        console.log(JSON.stringify({poll:i,http:r.status,tx}));
      }
    } catch (e) { console.log(JSON.stringify({poll:i,error:String(e.message||e),tx})); }
    await new Promise(r=>setTimeout(r, 5000));
  }
  throw new Error(`Timed out waiting for ${tx}`);
}
let tx;
if (action === 'submit') {
  const url = process.env.PROJECT_URL || 'https://docs.genlayer.com';
  const metadata = JSON.parse(process.env.PROJECT_METADATA_JSON || '{}');
  tx = await client.writeContract({ address: CONTRACT_ADDRESS, functionName: 'submit_project', args: [url, JSON.stringify(metadata)], value: SUBMISSION_FEE });
} else if (action === 'vote-project') {
  tx = await client.writeContract({ address: CONTRACT_ADDRESS, functionName: 'vote_project', args: [process.env.PROJECT_ID, process.env.SUPPORT !== 'false'], value: ACTION_FEE });
} else if (action === 'propose-update') {
  tx = await client.writeContract({ address: CONTRACT_ADDRESS, functionName: 'propose_project_update', args: [process.env.PROJECT_ID, process.env.PATCH_JSON || '{}'], value: ACTION_FEE });
} else if (action === 'vote-update') {
  tx = await client.writeContract({ address: CONTRACT_ADDRESS, functionName: 'vote_update', args: [Number(process.env.UPDATE_ID || '0'), process.env.SUPPORT !== 'false'], value: ACTION_FEE });
} else {
  throw new Error('action must be submit|vote-project|propose-update|vote-update');
}
console.log(JSON.stringify({tx}));
const receipt = await explorer(tx);
console.log(JSON.stringify({final:{hash:receipt.hash,status:receipt.status,execution_result:receipt.execution_result,rollup_transaction_hash:receipt.rollup_transaction_hash}}));
