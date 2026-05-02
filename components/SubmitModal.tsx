"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@/lib/genlayer/wallet";
import type { EcosystemNode } from "@/lib/types/graph";
import {
  getEcosystemRegistry,
  EXPLORER_TX,
  REGISTRY_V2_DEPLOYED,
  type ProjectSubmissionMetadata,
  type RelationshipClaim,
} from "@/lib/contracts/EcosystemRegistry";
import { fetchBradburyTxStatus, type BradburyExplorerTxStatus } from "@/lib/contracts/bradburyExplorer";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  existingNodes: EcosystemNode[];
}

const CATEGORY_OPTIONS = [
  "INFRASTRUCTURE",
  "DEVELOPER TOOLING",
  "RESOLVES DISPUTES",
  "DISPUTE RESOLUTION",
  "TRADE FINANCE",
  "TOKEN LAUNCH",
  "AWARENESS",
  "DATA LAYER",
  "GAMING",
  "DEFI",
  "OTHER",
];

const RELATIONSHIP_OPTIONS = [
  "built on",
  "powered by",
  "integrates with",
  "uses",
  "evaluates",
  "adjudicates",
  "provides data to",
  "related to",
];

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "submitted-project";
}

export function SubmitModal({ isOpen, onClose, existingNodes }: Props) {
  const { address, isConnected, connectWallet } = useWallet();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [relationshipTarget, setRelationshipTarget] = useState("genlayer");
  const [relationshipLabel, setRelationshipLabel] = useState("related to");
  const [relationshipNote, setRelationshipNote] = useState("");
  const [phase, setPhase] = useState<"idle" | "connecting" | "submitting" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState("");
  const [txStatus, setTxStatus] = useState<BradburyExplorerTxStatus | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [errMsg, setErrMsg] = useState("");

  const sortedNodes = useMemo(
    () => [...existingNodes].sort((a, b) => a.name.localeCompare(b.name)),
    [existingNodes]
  );


  useEffect(() => {
    if (phase !== "success" || !txHash) return;

    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const status = await fetchBradburyTxStatus(txHash);
        if (cancelled) return;
        setTxStatus(status);
        setStatusNote(status.summary);
        if (!status.finalized && attempts < 24) {
          window.setTimeout(poll, 5000);
        }
      } catch (error: any) {
        if (cancelled) return;
        setStatusNote(`Explorer status not available yet: ${(error?.message ?? String(error)).slice(0, 120)}`);
        if (attempts < 12) window.setTimeout(poll, 5000);
      }
    };
    void poll();

    return () => {
      cancelled = true;
    };
  }, [phase, txHash]);

  const handleSubmit = async () => {
    if (!url.trim()) return;
    try {
      new URL(url);
    } catch {
      setErrMsg("Enter a valid URL (include https://)");
      return;
    }
    if (!name.trim()) {
      setErrMsg("Add a project name. GenLayer verifies your claim, but you supply the graph metadata.");
      return;
    }
    if (!description.trim()) {
      setErrMsg("Add a short creator description.");
      return;
    }
    if (!REGISTRY_V2_DEPLOYED) {
      setErrMsg("V2 contract flow is implemented locally, but no Bradbury v2 contract is deployed/configured yet. Deploy v2 before sending live wallet transactions.");
      return;
    }
    setErrMsg("");

    const relationships: RelationshipClaim[] = relationshipTarget
      ? [{
          target_id: relationshipTarget,
          label: relationshipLabel,
          note: relationshipNote.trim() || undefined,
        }]
      : [];

    const metadata: ProjectSubmissionMetadata = {
      id: slugify(name.trim() || url.trim()),
      name: name.trim(),
      description: description.trim(),
      category,
      relationships,
    };

    try {
      let signerAddress = address;
      if (!isConnected || !signerAddress) {
        setPhase("connecting");
        signerAddress = await connectWallet();
      }
      setPhase("submitting");
      setTxStatus(null);
      setStatusNote("");
      const registry = getEcosystemRegistry(signerAddress);
      const hash = await registry.submitProject(url.trim(), metadata);
      setTxHash(hash);
      setPhase("success");
      setUrl("");
      setName("");
      setDescription("");
      setCategory("OTHER");
      setRelationshipTarget("genlayer");
      setRelationshipLabel("related to");
      setRelationshipNote("");
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      if (msg.includes("reject") || err?.code === 4001) {
        setPhase("idle");
        return;
      }
      setErrMsg(msg.slice(0, 180));
      setPhase("error");
    }
  };

  const handleClose = () => {
    setPhase("idle");
    setErrMsg("");
    setTxStatus(null);
    setStatusNote("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="submit-modal is-open" role="dialog" aria-modal="true" aria-label="Add your project">
      <div id="submit-backdrop" className="submit-backdrop" onClick={handleClose} />
      <div className="submit-drawer">
        <button
          type="button"
          className="panel-close"
          style={{ position: "absolute", top: "18px", right: "18px" }}
          onClick={handleClose}
          aria-label="Close modal"
        >
          <span />
          <span />
        </button>

        <h2>Submit a project for GenLayer verification</h2>
        <p className="submit-description">
          Pay <strong>0.042 GEN on Bradbury</strong> to have GenLayer verify that the
          website is live, real, and meaningfully related to GenLayer. You provide the
          graph metadata; consensus records the evidence-backed evaluation.
        </p>
        <p className="submit-disclaimer">
          Payment requests verification, not guaranteed listing. Relationship claims can be improved,
          challenged, upvoted, or downvoted by later paid transactions. This local static build can
          submit live Bradbury transactions; accepted entries appear after the transaction ledger and
          graph sync are refreshed.
        </p>

        <div className="submit-field-grid">
          <div className="submit-field submit-field--full">
            <label className="submit-label" htmlFor="submit-url">Project URL</label>
            <input
              id="submit-url"
              type="url"
              className="submit-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourproject.xyz"
            />
          </div>
          <div className="submit-field">
            <label className="submit-label" htmlFor="submit-name">Project name</label>
            <input
              id="submit-name"
              className="submit-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="YourProject"
            />
          </div>
          <div className="submit-field">
            <label className="submit-label" htmlFor="submit-category">Category</label>
            <select
              id="submit-category"
              className="submit-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORY_OPTIONS.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>
          <div className="submit-field submit-field--full">
            <label className="submit-label" htmlFor="submit-description">Creator description</label>
            <textarea
              id="submit-description"
              className="submit-input submit-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One sentence explaining what the project does and how it relates to GenLayer."
            />
          </div>
          <div className="submit-field">
            <label className="submit-label" htmlFor="submit-relationship-target">Relationship target</label>
            <select
              id="submit-relationship-target"
              className="submit-input"
              value={relationshipTarget}
              onChange={(e) => setRelationshipTarget(e.target.value)}
            >
              {sortedNodes.map((node) => (
                <option key={node.id} value={node.id}>{node.name}</option>
              ))}
            </select>
          </div>
          <div className="submit-field">
            <label className="submit-label" htmlFor="submit-relationship-label">Relationship</label>
            <select
              id="submit-relationship-label"
              className="submit-input"
              value={relationshipLabel}
              onChange={(e) => setRelationshipLabel(e.target.value)}
            >
              {RELATIONSHIP_OPTIONS.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>
          <div className="submit-field submit-field--full">
            <label className="submit-label" htmlFor="submit-relationship-note">Relationship note</label>
            <input
              id="submit-relationship-note"
              className="submit-input"
              value={relationshipNote}
              onChange={(e) => setRelationshipNote(e.target.value)}
              placeholder="Optional evidence or explanation for this graph link."
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
        </div>

        {errMsg && (
          <p className="submit-status submit-status--error">{errMsg}</p>
        )}

        {phase === "success" && (
          <p className="submit-status submit-status--success">
            Submitted to Bradbury. {statusNote || "Waiting for explorer finality…"}{" "}
            <a href={EXPLORER_TX(txHash)} target="_blank" rel="noopener noreferrer">
              View on explorer ↗
            </a>
            {txStatus?.finalized && txStatus.outcome === "ok" && (
              <span className="submit-next-step"> Refresh the Bradbury ledger and graph sync to make accepted entries visible to everyone.</span>
            )}
          </p>
        )}

        {(phase === "connecting" || phase === "submitting") && (
          <p className="submit-status submit-status--loading">
            {phase === "connecting" ? "Connecting wallet…" : "Waiting for wallet confirmation…"}
          </p>
        )}

        <button
          type="button"
          id="submit-btn"
          className="submit-confirm-btn"
          onClick={handleSubmit}
          disabled={phase === "connecting" || phase === "submitting"}
        >
          {phase === "connecting"
            ? "Connecting wallet…"
            : phase === "submitting"
            ? "Waiting for confirmation…"
            : isConnected
            ? "Submit verification (0.042 GEN)"
            : "Connect wallet & verify"}
        </button>
      </div>
    </div>
  );
}
