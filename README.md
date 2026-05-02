# GenLayerEcosystem

A JSON-driven landing page that maps GenLayer and the projects around it as an interactive floating-node graph.

## What it does
- Loads curated nodes + relationships from `ecosystem.json`
- Renders GenLayer at the center with connected project bubbles around it
- Distinguishes curated entries, Bradbury paid-evaluation examples, and live Bradbury submissions
- Lets founders submit a URL for a 0.042 GEN Bradbury evaluation through the connected wallet flow
- Shows verified Bradbury transaction provenance when a submission is available
- Makes clear that payment requests evaluation, not guaranteed listing
- Animates dashed relationship arrows across a white editorial canvas
- Opens a detail side panel with description, tags, links, relationship context, and evaluation provenance
- Uses real verified brand assets mirrored locally into `assets/logos`

## Current seeded projects
- GenLayer
- GenLayer Ecosystem Map (live Bradbury submission, pending read-path evaluation metadata)
- Rally
- Argue.fun
- InternetCourt
- MergeProof
- Intelligent Oracle
- GenLayer Docs (live validator-fixed Bradbury v2 submission)
- Agent Market Demo (mock GenLayer-evaluated entry)
- Thin Submission (mock needs-review entry)

## Bradbury verification and community-update direction

The ecosystem page is evolving from a static directory into a Bradbury-native registry surface:

1. A project owner submits a URL plus creator-supplied metadata: name, description, category, and relationship claims.
2. The wallet pays 0.042 GEN on Bradbury.
3. GenLayer consensus verifies the evidence-backed facts: the site is live, not spam, meaningfully related to GenLayer, and explainable from the page content.
4. GenLayer records an evaluation summary, category, confidence, reason, and evidence. It does **not** invent canonical graph links.
5. Relationship claims are creator/community metadata. They can be improved, challenged, upvoted, or downvoted by later small-fee Bradbury transactions.

Payment buys verification, not guaranteed listing. Rejected, unsafe, unrelated, or thin submissions should remain hidden by default or marked as needs review. Local builds and UI work do not deploy contracts, submit transactions, or use a wallet.

The first live proof transaction submitted this repository to the previous Bradbury `EcosystemRegistry.submit_player(url)` contract with 1 GEN and finalized with a GenLayer execution error. Future submissions should use the patched registry flow at 0.042 GEN:

- GenLayer tx: https://explorer-bradbury.genlayer.com/tx/0x9df8f43597c891d0fda7d8956aeeaa32df77c3639481f14830640fdad508b70b
- ZKsync rollup tx: https://zksync-os-testnet-genlayer.explorer.zksync.dev/tx/0xfd0f2b4a1fa9aa99bb253c5ea5c138ac131f1b533e2ef3082226115ccfaf3809

## Bradbury v2 live registry notes

The local v2 frontend currently points at the validator-fixed live Bradbury registry deployment:

- Contract: `0x761D3C809A570EDC37d0f470A07aE2F74AE4a278`
- Deploy tx: https://explorer-bradbury.genlayer.com/tx/0x4f283f4b105c07e88be068a066efa9207d486a76eeb79788fd2608375d2a8efb
- Clean submit retest: https://explorer-bradbury.genlayer.com/tx/0x9c5a913733dadf6b40a0242f022a26d887d0a1aa43b5a8de585af3816230e065
- Submission fee: `0.042 GEN`
- Community action fee: `0.0042 GEN`

The v2 paid flow has been exercised on Bradbury. The first submit on the older v2 deployment reported `NONDET_DISAGREE`. The validator-fixed deployment and fresh 0.042 GEN submit retest finalized with majority `FINISHED_WITH_RETURN` consensus evidence. The app is still a prototype because full decoded contract-state readback is not implemented; static graph promotion is currently produced by a conservative local sync script from known public explorer tx evidence.

The project uses `patch-package` to apply a small `genlayer-js` Bradbury gas workaround after install. This replaces the previous ad-hoc local `node_modules` edit with a tracked patch in `patches/genlayer-js+0.21.1.patch`. The patch only raises the SDK fallback gas and multiplies estimated gas for Bradbury consensus-main transactions; do not commit direct `node_modules` edits.

Bradbury helper scripts:

```bash
# dry-run deploy preflight, no transaction
node scripts/deploy-bradbury.mjs --contract=contracts/EcosystemRegistry.py

# refresh the public explorer transaction ledger used by the local static UI
node scripts/index-bradbury-v2.mjs

# refresh ledger and conservatively promote clean Bradbury submissions into ecosystem.json/public/ecosystem.json
npm run bradbury:sync-graph

# live deploy, requires DEPLOYER_PRIVATE_KEY or an unlocked GenLayer CLI keychain account via repo-local keytar
GENLAYER_ACCOUNT_NAME=party-b node scripts/deploy-bradbury.mjs --send --contract=contracts/EcosystemRegistry.py

# paid write helpers, require ECOSYSTEM_REGISTRY_ADDRESS and DEPLOYER_PRIVATE_KEY or unlocked keychain account
ECOSYSTEM_REGISTRY_ADDRESS=0x761D3C809A570EDC37d0f470A07aE2F74AE4a278 node scripts/bradbury-v2-write.mjs vote-project
```

`public/bradbury-v2-index.json` is a transaction-ledger fallback generated from the public Bradbury explorer API. It lets the UI show public deploy/submit/vote/update evidence and keep the older `NONDET_DISAGREE` visible. `scripts/sync-bradbury-v2-graph.mjs` then promotes only clean, metadata-bearing submit proofs into `ecosystem.json` and `public/ecosystem.json` while retaining public tx provenance. This is **not decoded full contract-state readback**; full live state sync still needs either a supported GenLayer read path or an explorer/API-backed indexer that decodes contract state/events.

Do not print or commit private keys, credential-bearing RPC URLs, or `.env` files. Public transaction hashes and public contract addresses are okay.

## Development
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Data model
All content lives in `ecosystem.json`.

- `nodes[]` defines each project bubble
- `edges[]` defines directional relationships and explanatory notes
- positions are normalized percentages so the graph stays easy to edit

## Source notes
Descriptions were cross-checked against public project websites and internal ETHDenver ecosystem notes on 2026-03-10.
