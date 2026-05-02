import json

SUBMISSION_FEE = 42_000_000_000_000_000
ACTION_FEE = 4_200_000_000_000_000
CONTRACT = "contracts/EcosystemRegistry.py"


def deploy_registry(direct_deploy):
    return direct_deploy(CONTRACT)


def decode_players(contract):
    return json.loads(contract.get_players())


def test_constructor_seeds_projects_and_fees(direct_deploy):
    contract = deploy_registry(direct_deploy)
    players = decode_players(contract)
    assert contract.get_submission_fee() == SUBMISSION_FEE
    assert contract.get_action_fee() == ACTION_FEE
    assert [player["id"] for player in players[:3]] == ["genlayer", "rally", "argue"]
    assert players[0]["status"] == "accepted"


def test_submit_project_records_creator_metadata_multiple_relationships_and_evaluation(direct_vm, direct_deploy, direct_alice):
    contract = deploy_registry(direct_deploy)
    direct_vm.sender = direct_alice
    direct_vm.value = SUBMISSION_FEE
    direct_vm.mock_web(r".*example\.com.*", {"status": 200, "body": "GenLayer project using Rally for token launch and dispute resolution."})
    direct_vm.mock_llm(r".*verifying a submitted GenLayer ecosystem project.*", json.dumps({
        "is_genlayer_related": True,
        "display_eligible": True,
        "summary": "Example is a GenLayer ecosystem project.",
        "category": "DEVELOPER TOOLING",
        "confidence": 91,
        "reason": "The page references GenLayer.",
        "evidence": ["GenLayer project"],
    }))
    metadata = {
        "id": "example-project",
        "name": "Example Project",
        "description": "A useful GenLayer project.",
        "category": "DEVELOPER TOOLING",
        "relationships": [
            {"target_id": "genlayer", "label": "built on", "note": "Uses GenLayer."},
            {"target_id": "rally", "label": "integrates with", "note": "Uses Rally."},
        ],
    }
    contract.submit_project("https://example.com", json.dumps(metadata))
    direct_vm.value = 0

    players = decode_players(contract)
    submitted = players[-1]
    assert submitted["id"] == "example-project"
    assert submitted["status"] == "accepted"
    assert submitted["evaluation"]["confidence"] == 91
    relationships = submitted["creator_metadata"]["relationships"]
    assert relationships == metadata["relationships"]
    assert contract.get_player(len(players) - 1) == json.dumps(submitted)


def test_submit_project_rejects_bad_payment_bad_url_duplicate_and_normalizes_relationships(direct_vm, direct_deploy, direct_alice):
    contract = deploy_registry(direct_deploy)
    metadata = json.dumps({
        "id": "normalization-test",
        "name": "Normalization Test",
        "description": "Testing metadata normalization.",
        "category": "NOT_A_CATEGORY",
        "relationships": [
            {"target_id": "genlayer", "label": "INVALID LABEL", "note": "x"},
            {"target_id": "rally", "label": "uses", "note": "ok"},
        ],
    })
    direct_vm.sender = direct_alice
    direct_vm.value = SUBMISSION_FEE - 1
    with direct_vm.expect_revert("Insufficient payment"):
        contract.submit_project("https://normalization.example", metadata)

    direct_vm.value = SUBMISSION_FEE
    with direct_vm.expect_revert("URL must start"):
        contract.submit_project("ftp://normalization.example", metadata)

    direct_vm.mock_web(r".*normalization\.example.*", {"status": 404, "body": "not found"})
    contract.submit_project("https://normalization.example", metadata)
    direct_vm.value = 0
    submitted = decode_players(contract)[-1]
    assert submitted["status"] == "needs_review"
    assert submitted["creator_metadata"]["category"] == "OTHER"
    assert submitted["creator_metadata"]["relationships"][0]["label"] == "related to"
    assert submitted["evaluation"]["reason"] == "fetch_failed"

    direct_vm.value = SUBMISSION_FEE
    with direct_vm.expect_revert("Project id already exists"):
        contract.submit_project("https://normalization.example/again", metadata)


def test_votes_updates_and_view_aggregation(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy_registry(direct_deploy)

    direct_vm.sender = direct_alice
    direct_vm.value = ACTION_FEE - 1
    with direct_vm.expect_revert("Insufficient action payment"):
        contract.vote_project("genlayer", True)

    direct_vm.value = ACTION_FEE
    contract.vote_project("genlayer", True)
    direct_vm.sender = direct_bob
    contract.vote_project("genlayer", False)
    votes = json.loads(contract.get_project_votes("genlayer"))
    assert votes == {"project_id": "genlayer", "up": 1, "down": 1}

    patch = {"relationships_add": [{"target_id": "rally", "label": "integrates with"}], "note": "Add Rally link"}
    contract.propose_project_update("genlayer", json.dumps(patch))
    contract.vote_update(0, True)
    direct_vm.sender = direct_alice
    contract.vote_update(0, False)
    updates = json.loads(contract.get_updates())
    assert updates[0]["project_id"] == "genlayer"
    assert updates[0]["patch"] == patch
    assert updates[0]["votes_up"] == 1
    assert updates[0]["votes_down"] == 1

    with direct_vm.expect_revert("Project not found"):
        contract.vote_project("missing", True)
    with direct_vm.expect_revert("Update not found"):
        contract.vote_update(999, True)


def test_owner_only_fee_setters(direct_vm, direct_deploy, direct_owner, direct_bob):
    contract = deploy_registry(direct_deploy)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only owner can set submission fee"):
        contract.set_submission_fee(123)
    with direct_vm.expect_revert("Only owner can set action fee"):
        contract.set_action_fee(456)

    direct_vm.sender = direct_owner
    contract.set_submission_fee(123)
    contract.set_action_fee(456)
    assert contract.get_submission_fee() == 123
    assert contract.get_action_fee() == 456
