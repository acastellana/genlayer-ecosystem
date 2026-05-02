import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "index-bradbury-v2.mjs"
PUBLIC_INDEX = ROOT / "public" / "bradbury-v2-index.json"
PAGE = ROOT / "app" / "page.tsx"
STAGE = ROOT / "components" / "EcosystemStage.tsx"
DETAIL = ROOT / "components" / "DetailPanel.tsx"


def test_bradbury_index_script_is_syntax_valid():
    subprocess.run(["node", "--check", str(SCRIPT)], cwd=ROOT, check=True)


def test_bradbury_index_documents_tx_ledger_limitations():
    data = json.loads(PUBLIC_INDEX.read_text())
    assert data["source"] == "bradbury_explorer_tx_ledger"
    assert data["contractAddress"] == "0x761D3C809A570EDC37d0f470A07aE2F74AE4a278"
    assert any("state_readback_not_implemented" in item for item in data["limitations"])
    assert data["summary"]["submitConsensusClean"] is True
    assert any(tx["executionResult"] == "NONDET_DISAGREE" for tx in data["transactions"])
    assert any(
        tx.get("projectId") == "genlayer-docs-live-test-20260502c"
        and tx["outcome"] in {"pending_ok", "ok"}
        and tx["consensusLooksClean"] is True
        for tx in data["transactions"]
    )
    assert all("REDACTED" not in json.dumps(tx) for tx in data["transactions"])


def test_ui_surfaces_live_index_without_claiming_state_sync():
    page = PAGE.read_text()
    stage = STAGE.read_text()
    detail = DETAIL.read_text()
    assert "bradbury-v2-index.json" in page
    assert "Live Bradbury prototype" in stage
    assert "Tx-ledger evidence only" in stage
    assert "Live Bradbury evidence" in detail
    assert "not decoded contract-state sync" in detail
    assert "Static graph entries still come from ecosystem.json" in detail
