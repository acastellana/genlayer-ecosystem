# GenLayerEcosystem

A JSON-driven landing page that maps GenLayer and the projects around it as an interactive floating-node graph.

## What it does
- Loads nodes + relationships from `ecosystem.json`
- Renders GenLayer at the center with connected project bubbles around it
- Animates dashed relationship arrows across a white editorial canvas
- Opens a detail side panel with description, tags, links, and relationship context
- Uses real verified brand assets mirrored locally into `assets/logos`

## Current seeded projects
- GenLayer
- Rally
- Argue.fun
- InternetCourt
- MergeProof

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
