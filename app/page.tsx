"use client";

import { useState, useEffect } from "react";
import { EcosystemStage } from "@/components/EcosystemStage";
import { DetailPanel } from "@/components/DetailPanel";
import { SubmitModal } from "@/components/SubmitModal";
import type { EcosystemGraph, EcosystemNode } from "@/lib/types/graph";

export default function HomePage() {
  const [graph, setGraph] = useState<EcosystemGraph | null>(null);
  const [selectedNode, setSelectedNode] = useState<EcosystemNode | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);

  useEffect(() => {
    fetch("/genlayer-ecosystem/ecosystem.json")
      .then((r) => r.json())
      .then(setGraph)
      .catch(console.error);
  }, []);

  if (!graph)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          color: "rgba(17,24,39,0.4)",
          fontFamily: "Manrope, sans-serif",
        }}
      >
        Loading…
      </div>
    );

  return (
    <>
      <EcosystemStage
        graph={graph}
        onNodeClick={(node) => setSelectedNode(node)}
        onAddProject={() => setShowSubmit(true)}
      />
      {selectedNode && (
        <DetailPanel
          node={selectedNode}
          graph={graph}
          onClose={() => setSelectedNode(null)}
        />
      )}
      <SubmitModal isOpen={showSubmit} onClose={() => setShowSubmit(false)} />
    </>
  );
}
