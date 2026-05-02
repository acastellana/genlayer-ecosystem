"use client";

import { useState } from "react";
import type { EcosystemGraph, EcosystemNode, BradburyV2Index } from "@/lib/types/graph";
import { useWallet } from "@/lib/genlayer/wallet";
import { EXPLORER_TX, REGISTRY_V2_DEPLOYED, getEcosystemRegistry } from "@/lib/contracts/EcosystemRegistry";

const BASE_PATH = "/genlayer-ecosystem";

interface Props {
  node: EcosystemNode | null;
  graph: EcosystemGraph;
  liveIndex?: BradburyV2Index | null;
  onClose: () => void;
}

export function DetailPanel({ node, graph, liveIndex, onClose }: Props) {
  const { address, isConnected, connectWallet } = useWallet();
  const [voteStatus, setVoteStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [updateStatus, setUpdateStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [actionHash, setActionHash] = useState("");
  const [updateNote, setUpdateNote] = useState("");
  const [actionError, setActionError] = useState("");

  if (!node) return null;

  const getNodeById = (id: string) => graph.nodes.find((n) => n.id === id);

  const relationships = graph.edges
    .filter((e) => e.source === node.id || e.target === node.id)
    .map((e) => {
      const isOutgoing = e.source === node.id;
      const counterpart = getNodeById(isOutgoing ? e.target : e.source);
      return {
        direction: isOutgoing ? "Outgoing" : "Incoming",
        counterpart,
        label: e.label,
        note: e.note,
      };
    });

  const statusClass = node.status
    ? `panel-status-badge status-${node.status.toLowerCase().replace(/\s+/g, "-")}`
    : "";
  const evaluation = node.evaluation ?? {
    source: "curated" as const,
    label: "Curated ecosystem entry",
    status: "accepted",
    note: "Seeded by the GenLayer ecosystem map maintainers.",
  };
  const nodeUrls = new Set((node.links || []).map((link) => link.url));
  const liveTransactions = (liveIndex?.transactions || []).filter((tx) =>
    tx.projectId === node.id ||
    (!!tx.projectUrl && nodeUrls.has(tx.projectUrl)) ||
    (!!node.evaluation?.txUrl && tx.explorerUrl === node.evaluation.txUrl)
  );
  const evaluationClass = `evaluation-badge source-${evaluation.source.replace(/_/g, "-")}`;

  const ensureConnected = async () => {
    if (isConnected && address) return address;
    return connectWallet();
  };

  const voteProject = async (support: boolean) => {
    if (!REGISTRY_V2_DEPLOYED) {
      setActionError("V2 community transactions are implemented locally, but no Bradbury v2 contract is deployed/configured yet.");
      return;
    }
    try {
      setActionError("");
      setActionHash("");
      setVoteStatus("submitting");
      const signerAddress = await ensureConnected();
      const registry = getEcosystemRegistry(signerAddress);
      const hash = await registry.voteProject(node.id, support);
      setActionHash(hash);
      setVoteStatus("success");
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      if (msg.includes("reject") || err?.code === 4001) {
        setVoteStatus("idle");
        return;
      }
      setActionError(msg.slice(0, 180));
      setVoteStatus("error");
    }
  };

  const proposeUpdate = async () => {
    if (!REGISTRY_V2_DEPLOYED) {
      setActionError("V2 community transactions are implemented locally, but no Bradbury v2 contract is deployed/configured yet.");
      return;
    }
    if (!updateNote.trim()) {
      setActionError("Describe the proposed correction first.");
      return;
    }
    try {
      setActionError("");
      setActionHash("");
      setUpdateStatus("submitting");
      const signerAddress = await ensureConnected();
      const registry = getEcosystemRegistry(signerAddress);
      const hash = await registry.proposeProjectUpdate(node.id, { note: updateNote.trim() });
      setActionHash(hash);
      setUpdateNote("");
      setUpdateStatus("success");
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      if (msg.includes("reject") || err?.code === 4001) {
        setUpdateStatus("idle");
        return;
      }
      setActionError(msg.slice(0, 180));
      setUpdateStatus("error");
    }
  };

  return (
    <div className="detail-panel is-open" role="dialog" aria-modal="true">
      <div className="detail-backdrop" onClick={onClose} />
      <div className="detail-drawer">
        <button
          className="panel-close"
          type="button"
          aria-label="Close panel"
          onClick={onClose}
        >
          <span />
          <span />
        </button>

        <div className="panel-header">
          <div className="panel-logo-wrap">
            <img
              className="panel-logo"
              src={`${BASE_PATH}/${node.logo}`}
              alt={`${node.name} logo`}
            />
          </div>
          <div>
            <p className="panel-type eyebrow">{node.kind}</p>
            <h2 id="panel-title">{node.name}</h2>
            <div className="panel-badge-row">
              <span className={evaluationClass}>{evaluation.label}</span>
              {evaluation.network && <span className="evaluation-badge">{evaluation.network}</span>}
              {evaluation.fee && <span className="evaluation-badge">{evaluation.fee}</span>}
            </div>
            {node.status && (
              <span className={statusClass}>{node.status}</span>
            )}
            <p className="panel-tagline">{node.tagline}</p>
          </div>
        </div>

        <div className="panel-sections">
          {node.description && (
            <section>
              <h3>About</h3>
              <p className="panel-copy">{node.description}</p>
            </section>
          )}

          <section>
            <h3>Evaluation</h3>
            <div className="evaluation-card">
              <div>
                <span className="evaluation-card-label">Source</span>
                <strong>{evaluation.label}</strong>
              </div>
              {evaluation.status && (
                <div>
                  <span className="evaluation-card-label">Status</span>
                  <strong>{evaluation.status}</strong>
                </div>
              )}
              {(evaluation.score !== undefined || evaluation.confidence !== undefined) && (
                <div className="evaluation-score-row">
                  {evaluation.score !== undefined && <span>Score {evaluation.score}/100</span>}
                  {evaluation.confidence !== undefined && <span>Confidence {evaluation.confidence}%</span>}
                </div>
              )}
              {evaluation.note && <p>{evaluation.note}</p>}
              {evaluation.txUrl && (
                <a href={evaluation.txUrl} target="_blank" rel="noreferrer noopener">
                  View Bradbury transaction ↗
                </a>
              )}
            </div>
            {liveIndex && (
              <div className="evaluation-card live-evidence-card">
                <div>
                  <span className="evaluation-card-label">Live Bradbury evidence</span>
                  <strong>{liveTransactions.length ? `${liveTransactions.length} indexed tx${liveTransactions.length === 1 ? "" : "s"}` : "No matching live tx in local ledger"}</strong>
                </div>
                <p>
                  This is a public explorer transaction ledger, not decoded contract-state sync.
                  Static graph entries still come from ecosystem.json.
                </p>
                {liveTransactions.length > 0 && (
                  <div className="live-tx-list">
                    {liveTransactions.map((tx) => (
                      <a key={tx.hash} href={tx.explorerUrl} target="_blank" rel="noreferrer noopener" className={`live-tx-pill outcome-${tx.outcome}`}>
                        <span>{tx.kind}</span>
                        <strong>{tx.executionResult}</strong>
                      </a>
                    ))}
                  </div>
                )}
                {liveIndex.summary && !liveIndex.summary.submitConsensusClean && (
                  <p className="live-warning">Submit consensus still needs a redeploy/retest: {liveIndex.summary.nextLiveStep}</p>
                )}
              </div>
            )}
          </section>

          <section>
            <h3>Community signals</h3>
            <div className="evaluation-card community-card">
              <p>
                Small paid actions can upvote, downvote, or propose corrections. These are
                separate accountability transactions; they do not ask consensus to invent graph links.
                Live writes stay disabled here until the v2 Bradbury registry is deployed.
              </p>
              <div className="community-action-row">
                <button
                  type="button"
                  className="signal-button signal-button--up"
                  onClick={() => voteProject(true)}
                  disabled={voteStatus === "submitting"}
                >
                  Upvote · 0.0042 GEN
                </button>
                <button
                  type="button"
                  className="signal-button signal-button--down"
                  onClick={() => voteProject(false)}
                  disabled={voteStatus === "submitting"}
                >
                  Downvote · 0.0042 GEN
                </button>
              </div>
              <label className="submit-label" htmlFor="update-note">Propose a correction</label>
              <textarea
                id="update-note"
                className="submit-input submit-textarea"
                value={updateNote}
                onChange={(e) => setUpdateNote(e.target.value)}
                placeholder="Describe a better description, relationship, link, or category."
              />
              <button
                type="button"
                className="submit-confirm-btn submit-confirm-btn--compact"
                onClick={proposeUpdate}
                disabled={updateStatus === "submitting"}
              >
                {updateStatus === "submitting" ? "Submitting correction…" : "Propose correction · 0.0042 GEN"}
              </button>
              {actionError && <p className="submit-status submit-status--error">{actionError}</p>}
              {(voteStatus === "success" || updateStatus === "success") && actionHash && (
                <p className="submit-status submit-status--success">
                  Recorded on Bradbury. <a href={EXPLORER_TX(actionHash)} target="_blank" rel="noopener noreferrer">View transaction ↗</a>
                </p>
              )}
            </div>
          </section>

          {node.tags && node.tags.length > 0 && (
            <section>
              <h3>Tags</h3>
              <div className="tag-grid">
                {node.tags.map((tag) => (
                  <div key={tag} className="tag">
                    {tag}
                  </div>
                ))}
              </div>
            </section>
          )}

          {node.links && node.links.length > 0 && (
            <section>
              <h3>Links</h3>
              <div className="link-list">
                {node.links.map((link) => (
                  <a
                    key={link.url}
                    className="link-card"
                    href={link.url}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <div className="link-copy">
                      <span className="link-label">{link.label}</span>
                      <span className="link-url">{link.url}</span>
                    </div>
                    <span className="link-arrow">↗</span>
                  </a>
                ))}
              </div>
            </section>
          )}

          {relationships.length > 0 && (
            <section>
              <h3>Relationships</h3>
              <div className="relationship-list">
                {relationships.map((rel, i) => (
                  <div key={i} className="relationship-chip">
                    <div className="relationship-copy">
                      <span className="relationship-title">
                        {rel.direction} · {rel.label} · {rel.counterpart?.name ?? "Unknown"}
                      </span>
                      {rel.note && (
                        <span className="relationship-note">{rel.note}</span>
                      )}
                    </div>
                    <span className="relationship-arrow">→</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
