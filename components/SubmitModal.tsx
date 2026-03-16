"use client";

import { useState } from "react";
import { useWallet } from "@/lib/genlayer/wallet";
import { getEcosystemRegistry, EXPLORER_TX } from "@/lib/contracts/EcosystemRegistry";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function SubmitModal({ isOpen, onClose }: Props) {
  const { address, isConnected, connectWallet } = useWallet();
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<"idle" | "connecting" | "submitting" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState("");
  const [errMsg, setErrMsg] = useState("");

  const handleSubmit = async () => {
    if (!url.trim()) return;
    try {
      new URL(url);
    } catch {
      setErrMsg("Enter a valid URL (include https://)");
      return;
    }
    setErrMsg("");

    try {
      if (!isConnected) {
        setPhase("connecting");
        await connectWallet();
      }
      setPhase("submitting");
      const registry = getEcosystemRegistry(address);
      const hash = await registry.submitPlayer(url);
      setTxHash(hash);
      setPhase("success");
      setUrl("");
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      if (msg.includes("reject") || err?.code === 4001) {
        setPhase("idle");
        return;
      }
      setErrMsg(msg.slice(0, 150));
      setPhase("error");
    }
  };

  const handleClose = () => {
    setPhase("idle");
    setErrMsg("");
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

        <h2>Add your project</h2>
        <p className="submit-description">
          Submit your URL. The GenLayer AI jury fetches the page and auto-generates the
          name, description, label, and connections. Costs <strong>1 GEN</strong>.
        </p>

        <div>
          <label className="submit-label" htmlFor="submit-url">
            Project URL
          </label>
          <input
            id="submit-url"
            type="url"
            className="submit-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yourproject.xyz"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
        </div>

        {errMsg && (
          <p className="submit-status submit-status--error">{errMsg}</p>
        )}

        {phase === "success" && (
          <p className="submit-status submit-status--success">
            Submitted! The AI jury is evaluating your project.{" "}
            <a href={EXPLORER_TX(txHash)} target="_blank" rel="noopener noreferrer">
              View on explorer ↗
            </a>
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
            ? "Submit (1 GEN)"
            : "Connect wallet & submit"}
        </button>
      </div>
    </div>
  );
}
