import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "sync-bradbury-v2-graph.mjs"
INDEX = ROOT / "public" / "bradbury-v2-index.json"
PUBLIC_GRAPH = ROOT / "public" / "ecosystem.json"
ROOT_GRAPH = ROOT / "ecosystem.json"


def test_bradbury_graph_sync_script_is_syntax_valid():
    subprocess.run(["node", "--check", str(SCRIPT)], cwd=ROOT, check=True)


def test_clean_bradbury_submission_promoted_to_graph():
    for graph_path in [PUBLIC_GRAPH, ROOT_GRAPH]:
        data = json.loads(graph_path.read_text())
        node = next((n for n in data["nodes"] if n["id"] == "genlayer-docs-live-test-20260502c"), None)
        assert node is not None
        assert node["name"] == "GenLayer Docs"
        assert node["evaluation"]["source"] == "genlayer_evaluated"
        assert node["evaluation"]["status"] == "accepted"
        assert node["evaluation"]["fee"] == "0.042 GEN"
        assert "0x9c5a913733dadf6b40a0242f022a26d887d0a1aa43b5a8de585af3816230e065" in node["evaluation"]["txUrl"]
        assert any(
            edge["source"] == "genlayer-docs-live-test-20260502c"
            and edge["target"] == "genlayer"
            and edge["label"] == "documents"
            for edge in data["edges"]
        )


def test_bradbury_graph_sync_is_idempotent(tmp_path):
    graph_copy = tmp_path / "ecosystem.json"
    shutil.copyfile(PUBLIC_GRAPH, graph_copy)
    before = json.loads(graph_copy.read_text())
    subprocess.run(
        ["node", str(SCRIPT), "--index", str(INDEX), "--graph", str(graph_copy)],
        cwd=ROOT,
        check=True,
    )
    after = json.loads(graph_copy.read_text())
    assert len(after["nodes"]) == len(before["nodes"])
    assert len(after["edges"]) == len(before["edges"])
    assert sum(1 for n in after["nodes"] if n["id"] == "genlayer-docs-live-test-20260502c") == 1


def test_bradbury_graph_sync_promotes_multiple_relationships(tmp_path):
    graph_copy = tmp_path / "ecosystem.json"
    index_copy = tmp_path / "bradbury-v2-index.json"
    graph_copy.write_text(json.dumps({
        "nodes": [
            {"id": "genlayer", "name": "GenLayer"},
            {"id": "rally", "name": "Rally"},
        ],
        "edges": [],
        "meta": {},
    }))
    index_copy.write_text(json.dumps({
        "network": "Bradbury",
        "contractAddress": "0x761D3C809A570EDC37d0f470A07aE2F74AE4a278",
        "transactions": [{
            "kind": "submit_project",
            "projectId": "multi-rel-project",
            "projectName": "Multi Rel Project",
            "projectUrl": "https://example.com",
            "outcome": "ok",
            "consensusLooksClean": True,
            "explorerUrl": "https://explorer-bradbury.genlayer.com/tx/0xabc",
            "relationships": [
                {"target_id": "genlayer", "label": "built on"},
                {"target_id": "rally", "label": "integrates with", "note": "Uses Rally in the claimed workflow."},
            ],
        }],
    }))
    subprocess.run(
        ["node", str(SCRIPT), "--index", str(index_copy), "--graph", str(graph_copy)],
        cwd=ROOT,
        check=True,
    )
    after = json.loads(graph_copy.read_text())
    edges = {(edge["source"], edge["target"], edge["label"]) for edge in after["edges"]}
    assert ("multi-rel-project", "genlayer", "built on") in edges
    assert ("multi-rel-project", "rally", "integrates with") in edges
