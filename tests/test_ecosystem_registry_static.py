from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = (ROOT / "contracts" / "EcosystemRegistry.py").read_text()
FRONTEND = (ROOT / "lib" / "contracts" / "EcosystemRegistry.ts").read_text()
SUBMIT_MODAL = (ROOT / "components" / "SubmitModal.tsx").read_text()
DETAIL_PANEL = (ROOT / "components" / "DetailPanel.tsx").read_text()


def test_submission_fee_is_alberts_bradbury_fee():
    assert "42_000_000_000_000_000" in CONTRACT
    assert 'BigInt("42000000000000000")' in FRONTEND
    assert "0.042 GEN" in SUBMIT_MODAL


def test_small_paid_actions_are_supported():
    assert "DEFAULT_ACTION_FEE = 4_200_000_000_000_000" in CONTRACT
    assert 'BigInt("4200000000000000")' in FRONTEND
    assert "vote_project" in CONTRACT
    assert "propose_project_update" in CONTRACT
    assert "vote_update" in CONTRACT
    assert "voteProject" in FRONTEND
    assert "proposeProjectUpdate" in FRONTEND
    assert "Upvote · 0.0042 GEN" in DETAIL_PANEL
    assert "Propose correction · 0.0042 GEN" in DETAIL_PANEL


def test_consensus_verifies_project_not_graph_edges():
    assert "Do NOT invent graph links" in CONTRACT
    assert "Consensus verifies only evidence-backed facts" in CONTRACT
    assert "creator_metadata" in CONTRACT
    assert "relationships" in CONTRACT
    assert '"connections"' not in CONTRACT
    assert "set(validator_result" not in CONTRACT


def test_contract_avoids_known_fragile_deployed_patterns():
    assert ".as_hex" not in CONTRACT
    assert "result = gl.vm.run_nondet(leader_fn, validator_fn)\n        evaluation = result.calldata" not in CONTRACT
    assert "evaluation = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)" in CONTRACT
    assert "if not isinstance(leaders_res, gl.vm.Return)" in CONTRACT


def test_contract_records_needs_review_instead_of_throwing_for_fetch_and_llm_parse_failures():
    assert "fetch_failed" in CONTRACT
    assert "fetch_transient" in CONTRACT
    assert "llm_parse_failed" in CONTRACT
    assert '"display_eligible": bool(display_eligible)' in CONTRACT
    assert 'status = "accepted" if evaluation["display_eligible"] else "needs_review"' in CONTRACT


def test_submit_modal_collects_creator_metadata():
    assert "Project name" in SUBMIT_MODAL
    assert "Creator description" in SUBMIT_MODAL
    assert "Relationship target" in SUBMIT_MODAL
    assert "Relationship note" in SUBMIT_MODAL
    assert "submitProject" in SUBMIT_MODAL
    assert "You provide the" in SUBMIT_MODAL
    assert "graph metadata" in SUBMIT_MODAL
