"use client";

import type { EcosystemGraph, EcosystemNode } from "@/lib/types/graph";

const BASE_PATH = "/genlayer-ecosystem";

interface Props {
  node: EcosystemNode | null;
  graph: EcosystemGraph;
  onClose: () => void;
}

export function DetailPanel({ node, graph, onClose }: Props) {
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
