import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "index-bradbury-v2.mjs"
PUBLIC_INDEX = ROOT / "public" / "bradbury-v2-index.json"
PAGE = ROOT / "app" / "page.tsx"
STAGE = ROOT / "components" / "EcosystemStage.tsx"
DETAIL = ROOT / "components" / "DetailPanel.tsx"
DOCS_PAGE = ROOT / "app" / "how-it-works" / "page.tsx"
KNOWN_TXS = ROOT / "data" / "bradbury-v2-known-txs.json"


def test_bradbury_index_script_is_syntax_valid():
    subprocess.run(["node", "--check", str(SCRIPT)], cwd=ROOT, check=True)


def test_bradbury_index_documents_tx_ledger_limitations():
    data = json.loads(PUBLIC_INDEX.read_text())
    assert data["source"] == "bradbury_explorer_tx_ledger"
    assert data["contractAddress"] == "0x761D3C809A570EDC37d0f470A07aE2F74AE4a278"
    assert any("state_readback_not_implemented" in item for item in data["limitations"])
    known = json.loads(KNOWN_TXS.read_text())
    assert any(tx["hash"] == "0x9c5a913733dadf6b40a0242f022a26d887d0a1aa43b5a8de585af3816230e065" for tx in known)
    assert data["summary"]["submitConsensusClean"] is True
    assert data["schemaVersion"] >= 2
    assert data["stateReadback"]["mode"] == "bradbury_explorer_address_probe"
    assert data["stateReadback"]["status"] in {"available", "blocked", "unavailable"}
    assert data["community"]["totals"]["upvotes"] >= 1
    assert data["community"]["totals"]["updateProposals"] >= 1
    assert any(project["projectId"] == "genlayer-docs-live-test-20260502b" for project in data["community"]["projects"])
    assert any(tx["executionResult"] == "NONDET_DISAGREE" for tx in data["transactions"])
    assert any(
        tx.get("projectId") == "genlayer-docs-live-test-20260502c"
        and tx["outcome"] in {"pending_ok", "ok"}
        and tx["consensusLooksClean"] is True
        for tx in data["transactions"]
    )
    assert all("REDACTED" not in json.dumps(tx) for tx in data["transactions"])


def test_ui_surfaces_live_index_without_claiming_full_contract_state_readback():
    page = PAGE.read_text()
    stage = STAGE.read_text()
    detail = DETAIL.read_text()
    assert "bradbury-v2-index.json" in page
    assert "Live Bradbury prototype" in stage
    assert "Tx-ledger evidence plus local graph sync" in stage
    assert "full contract state readback is still pending" in stage
    assert "Live Bradbury evidence" in detail
    assert "not full decoded" in detail
    assert "Newly submitted actions become visible here" in detail
    assert "graph sync are refreshed" in detail
    assert "community-ledger-summary" in detail
    assert "Indexed votes" in detail
    docs = DOCS_PAGE.read_text()
    assert "How the GenLayer ecosystem map works" in docs
    assert "submit_project(url, metadata_json)" in docs
    assert "Bradbury explorer txs" in docs
    assert "Contract state readback" in docs
    assert "bradbury-v2-index.json" in docs
    submit = (ROOT / "components" / "SubmitModal.tsx").read_text()
    assert "submit live Bradbury transactions" in submit
    assert "Waiting for explorer finality" in submit
    assert "relationshipDrafts" in submit
    assert "+ Add relationship" in submit
    assert "Each relationship is stored in the submitted metadata" in submit
