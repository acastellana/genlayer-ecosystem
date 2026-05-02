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

The local v2 frontend currently points at the live Bradbury registry deployment:

- Contract: `0xCc8da31a8a4B283363C67086186a8Fe4Da8A973c`
- Deploy tx: https://explorer-bradbury.genlayer.com/tx/0x5542cacbe0e98c988fb812a771746cad30b8e8915dec3f7d1244b92878f07c5a
- Submission fee: `0.042 GEN`
- Community action fee: `0.0042 GEN`

The v2 paid flow has been exercised on Bradbury. Deploy, project vote, update proposal, and update vote returned successfully. The submit transaction reached the contract but currently reports `NONDET_DISAGREE`, so this deployment is **not production-ready** and should be treated as a live prototype/checkpoint until a redeployed submit path returns clean `FINISHED_WITH_RETURN`.

The project uses `patch-package` to apply a small `genlayer-js` Bradbury gas workaround after install. This replaces the previous ad-hoc local `node_modules` edit with a tracked patch in `patches/genlayer-js+0.21.1.patch`. The patch only raises the SDK fallback gas and multiplies estimated gas for Bradbury consensus-main transactions; do not commit direct `node_modules` edits.

Bradbury helper scripts:

```bash
# dry-run deploy preflight, no transaction
node scripts/deploy-bradbury.mjs --contract=contracts/EcosystemRegistry.py

# live deploy, requires DEPLOYER_PRIVATE_KEY or an unlocked GenLayer CLI keychain account via repo-local keytar
GENLAYER_ACCOUNT_NAME=party-b node scripts/deploy-bradbury.mjs --send --contract=contracts/EcosystemRegistry.py

# paid write helpers, require ECOSYSTEM_REGISTRY_ADDRESS and DEPLOYER_PRIVATE_KEY or unlocked keychain account
ECOSYSTEM_REGISTRY_ADDRESS=0xCc8da31a8a4B283363C67086186a8Fe4Da8A973c node scripts/bradbury-v2-write.mjs vote-project
```

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
