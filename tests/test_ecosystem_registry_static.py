from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = (ROOT / "contracts" / "EcosystemRegistry.py").read_text()
FRONTEND = (ROOT / "lib" / "contracts" / "EcosystemRegistry.ts").read_text()


def test_submission_fee_is_alberts_bradbury_fee():
    assert "42_000_000_000_000_000" in CONTRACT
    assert 'BigInt("42000000000000000")' in FRONTEND


def test_contract_avoids_known_fragile_deployed_patterns():
    assert ".as_hex" not in CONTRACT
    assert "result = gl.vm.run_nondet(leader_fn, validator_fn)\n        enriched = result.calldata" not in CONTRACT
    assert "if not isinstance(result, gl.vm.Return)" in CONTRACT


def test_contract_records_needs_review_instead_of_throwing_for_fetch_and_llm_parse_failures():
    assert "fetch_failed" in CONTRACT
    assert "fetch_transient" in CONTRACT
    assert "llm_parse_failed" in CONTRACT
    assert '"approved": approved' in CONTRACT
