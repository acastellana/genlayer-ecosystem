# GenLayerEcosystem

A JSON-driven landing page that maps GenLayer and the projects around it as an interactive floating-node graph.

## What it does
- Loads curated nodes + relationships from `ecosystem.json`
- Renders GenLayer at the center with connected project bubbles around it
- Distinguishes curated entries from Bradbury paid-evaluation examples
- Lets founders submit a URL for a 1 GEN Bradbury evaluation through the connected wallet flow
- Makes clear that payment requests evaluation, not guaranteed listing
- Animates dashed relationship arrows across a white editorial canvas
- Opens a detail side panel with description, tags, links, relationship context, and evaluation provenance
- Uses real verified brand assets mirrored locally into `assets/logos`

## Current seeded projects
- GenLayer
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
