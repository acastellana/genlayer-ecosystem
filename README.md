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
