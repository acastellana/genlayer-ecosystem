"use client";

import { useEffect, useState } from "react";
import type { BradburyV2Index } from "@/lib/types/graph";

const BASE_PATH = "/genlayer-ecosystem";

export default function HowItWorksPage() {
  const [index, setIndex] = useState<BradburyV2Index | null>(null);

  useEffect(() => {
    fetch(`${BASE_PATH}/bradbury-v2-index.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then(setIndex)
      .catch(() => setIndex(null));
  }, []);

  const rawReadbackStatus = index?.stateReadback?.status;
  const readbackStatus = rawReadbackStatus === "available"
    ? "decoded state available"
    : rawReadbackStatus === "blocked"
      ? "ledger evidence only"
      : rawReadbackStatus === "unavailable"
        ? "address probe unavailable"
        : "checking public ledger";
  const communityTotals = index?.community?.totals;

  return (
    <main className="docs-page-shell">
      <div className="docs-card">
        <a className="docs-back-link" href={`${BASE_PATH}/`}>← Back to map</a>
        <p className="docs-kicker">Bradbury prototype</p>
        <h1>How the GenLayer ecosystem map works</h1>
        <p className="docs-lead">
          The map is a static public graph with a small live layer on top. A creator pays <strong>0.042 GEN</strong> to ask a GenLayer contract to evaluate a project URL. If the indexed evidence is clean, a local sync can promote that project into the public graph. Community actions cost <strong>0.0042 GEN</strong> and are tracked as public accountability transactions.
        </p>

        <pre className="docs-code"><code>{`submit_project(url, metadata_json)
  value: 0.042 GEN

GenLayer validators check:
  - is the URL reachable?
  - is it actually GenLayer-related?
  - should it be displayed?
  - what short explanation/evidence supports that?`}</code></pre>

        <p>
          Relationship edges are creator claims, not hallucinated by consensus. The submit form can include multiple relationship claims, and the graph sync turns each clean claim into an edge.
        </p>

        <pre className="docs-code"><code>{`metadata_json = {
  "name": "Example Project",
  "relationships": [
    { "target_id": "genlayer", "label": "built on" },
    { "target_id": "rally", "label": "integrates with" }
  ]
}`}</code></pre>

        <p>
          Under the hood, the public site does not yet decode full live contract state. It reads <code>bradbury-v2-index.json</code>, a transaction ledger generated from public Bradbury explorer transactions, then reads <code>ecosystem.json</code>, the static graph users see.
        </p>

        <pre className="docs-code"><code>{`Bradbury explorer txs
  → scripts/index-bradbury-v2.mjs
  → public/bradbury-v2-index.json
  → scripts/sync-bradbury-v2-graph.mjs
  → public/ecosystem.json
  → GitHub Pages map`}</code></pre>

        <p>
          Community votes and update proposals are indexed the same way: the wallet write is real, the explorer transaction is public, and the UI shows indexed counts after the ledger is refreshed.
        </p>

        <div className="docs-status-grid">
          <div>
            <span>Contract state readback</span>
            <strong>{readbackStatus}</strong>
          </div>
          <div>
            <span>Indexed community actions</span>
            <strong>
              {communityTotals
                ? `${communityTotals.upvotes + communityTotals.downvotes} vote${communityTotals.upvotes + communityTotals.downvotes === 1 ? "" : "s"} · ${communityTotals.updateProposals} update${communityTotals.updateProposals === 1 ? "" : "s"}`
                : "loading ledger"}
            </strong>
          </div>
        </div>

        <p className="docs-footnote">
          Honest limitation: until Bradbury exposes a reliable decoded state read path for this contract, the app treats explorer transactions as evidence and avoids claiming automatic live state sync.
        </p>
      </div>
    </main>
  );
}
