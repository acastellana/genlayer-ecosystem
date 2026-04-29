# GenLayerEcosystem

A JSON-driven landing page that maps GenLayer and the projects around it as an interactive floating-node graph.

## What it does
- Loads curated nodes + relationships from `ecosystem.json`
- Renders GenLayer at the center with connected project bubbles around it
- Distinguishes curated entries, Bradbury paid-evaluation examples, and live Bradbury submissions
- Lets founders submit a URL for a 1 GEN Bradbury evaluation through the connected wallet flow
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

## Bradbury paid-evaluation direction

The ecosystem page is evolving from a static directory into a Bradbury-native evaluation surface:

1. A project owner submits a URL.
2. The wallet pays 1 GEN on Bradbury.
3. The GenLayer AI jury evaluates the project.
4. Accepted evaluations can appear on the graph with evaluation provenance.

Payment buys evaluation, not guaranteed listing. Rejected, unsafe, unrelated, or thin submissions should remain hidden by default or marked as needs review. Local builds and UI work do not deploy contracts, submit transactions, or use a wallet.

The first live proof transaction submitted this repository to the existing Bradbury `EcosystemRegistry.submit_player(url)` contract and is displayed as a pending Bradbury submission until the frontend can read the contract's evaluation result:

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
