# v0.3.1
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json

ERROR_EXPECTED = "[EXPECTED]"
ERROR_EXTERNAL = "[EXTERNAL]"
ERROR_TRANSIENT = "[TRANSIENT]"
ERROR_LLM = "[LLM_ERROR]"

# Bradbury native unit is wei-like atto GEN. Albert's submission fee is 0.042 GEN.
DEFAULT_SUBMISSION_FEE = 42_000_000_000_000_000
# Small paid governance actions. Enough to discourage spam without making edits expensive.
DEFAULT_ACTION_FEE = 4_200_000_000_000_000  # 0.0042 GEN

VALID_LABELS = [
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
]

VALID_RELATIONSHIPS = [
    "built on",
    "powered by",
    "integrates with",
    "uses",
    "evaluates",
    "adjudicates",
    "provides data to",
    "related to",
]


def _address_to_str(address: Address) -> str:
    """Return a stable public address string without relying on non-portable address helpers."""
    return str(address)


def _parse_json(raw):
    """Parse JSON from dicts or fenced/extra-text strings."""
    if isinstance(raw, dict):
        return raw
    s = str(raw).strip()
    s = s.replace("```json", "").replace("```", "").strip()
    start = s.find("{")
    end = s.rfind("}") + 1
    if start >= 0 and end > start:
        s = s[start:end]
    parsed = json.loads(s)
    if not isinstance(parsed, dict):
        raise gl.vm.UserError(f"{ERROR_LLM} JSON was not an object")
    return parsed


def _safe_str(value, fallback: str = "", max_len: int = 240) -> str:
    text = str(value if value is not None else fallback).strip()
    return text[:max_len]


def _slug_from_url(url: str) -> str:
    s = url.lower().replace("https://", "").replace("http://", "")
    out = []
    for ch in s:
        if ch.isalnum():
            out.append(ch)
        elif out and out[-1] != "-":
            out.append("-")
    slug = "".join(out).strip("-")[:64]
    return slug or "submitted-project"


def _normalize_relationships(raw):
    if not isinstance(raw, list):
        return []
    relationships = []
    for rel in raw[:6]:
        if not isinstance(rel, dict):
            continue
        target_id = _safe_str(rel.get("target_id") or rel.get("target") or "genlayer", "genlayer", 80)
        label = _safe_str(rel.get("label") or "related to", "related to", 40).lower()
        if label not in VALID_RELATIONSHIPS:
            label = "related to"
        note = _safe_str(rel.get("note"), "", 180)
        relationships.append({"target_id": target_id, "label": label, "note": note})
    return relationships


def _normalize_creator_metadata(url: str, raw_metadata):
    try:
        metadata = _parse_json(raw_metadata) if raw_metadata else {}
    except Exception:
        raise gl.vm.UserError(f"{ERROR_EXPECTED} metadata must be valid JSON")

    label = _safe_str(metadata.get("category") or metadata.get("label") or "OTHER", "OTHER", 40).upper()
    if label not in VALID_LABELS:
        label = "OTHER"

    project_id = _safe_str(metadata.get("id") or metadata.get("project_id") or _slug_from_url(url), _slug_from_url(url), 80)
    return {
        "id": project_id,
        "name": _safe_str(metadata.get("name"), "Unknown", 60),
        "description": _safe_str(metadata.get("description"), "", 220),
        "category": label,
        "tags": [ _safe_str(t, "", 32) for t in (metadata.get("tags") or [])[:8] if _safe_str(t, "", 32) ],
        "relationships": _normalize_relationships(metadata.get("relationships") or []),
    }


def _normal_evaluation(url: str, is_live: bool, is_genlayer_related: bool, display_eligible: bool, summary: str, category: str, confidence: int, reason: str, evidence):
    if category not in VALID_LABELS:
        category = "OTHER"
    confidence = max(0, min(100, int(confidence)))
    return {
        "url": url,
        "is_live": bool(is_live),
        "is_genlayer_related": bool(is_genlayer_related),
        "display_eligible": bool(display_eligible),
        "summary": _safe_str(summary, "", 240),
        "category": category,
        "confidence": confidence,
        "reason": _safe_str(reason, "", 260),
        "evidence": [_safe_str(e, "", 180) for e in evidence[:5]],
    }


SEED_PLAYERS = [
    {
        "id": "genlayer",
        "name": "GenLayer",
        "description": "AI-native blockchain with intelligent contracts validated by LLM jurors.",
        "url": "https://genlayer.com",
        "category": "INFRASTRUCTURE",
        "relationships": [],
    },
    {
        "id": "rally",
        "name": "Rally",
        "description": "Token launch and community platform built on GenLayer.",
        "url": "https://rally.fan",
        "category": "TOKEN LAUNCH",
        "relationships": [{"target_id": "genlayer", "label": "built on", "note": "Creator/maintainer seeded relationship."}],
    },
    {
        "id": "argue",
        "name": "Argue.fun",
        "description": "Argumentation markets where AI agents debate and bet ARGUE tokens.",
        "url": "https://argue.fun",
        "category": "DISPUTE RESOLUTION",
        "relationships": [{"target_id": "genlayer", "label": "powered by", "note": "Creator/maintainer seeded relationship."}],
    },
]


class EcosystemRegistry(gl.Contract):
    owner: Address
    submission_fee: u256
    action_fee: u256
    players: TreeMap[u256, str]
    player_count: u256
    updates: TreeMap[u256, str]
    update_count: u256
    project_vote_events: TreeMap[u256, str]
    project_vote_count: u256
    update_vote_events: TreeMap[u256, str]
    update_vote_count: u256

    def __init__(self, submission_fee: int = DEFAULT_SUBMISSION_FEE, action_fee: int = DEFAULT_ACTION_FEE):
        self.owner = gl.message.sender_address
        self.submission_fee = u256(submission_fee)
        self.action_fee = u256(action_fee)
        self.player_count = u256(0)
        self.update_count = u256(0)
        self.project_vote_count = u256(0)
        self.update_vote_count = u256(0)

        owner_hex = _address_to_str(self.owner)
        for i, p in enumerate(SEED_PLAYERS):
            entry = json.dumps({
                "index": i,
                "id": p["id"],
                "url": p["url"],
                "submitter": owner_hex,
                "creator_metadata": {
                    "id": p["id"],
                    "name": p["name"],
                    "description": p["description"],
                    "category": p["category"],
                    "tags": [],
                    "relationships": p["relationships"],
                },
                "evaluation": _normal_evaluation(p["url"], True, True, True, p["description"], p["category"], 100, "seeded", []),
                "status": "accepted",
                "source": "seeded",
            })
            self.players[u256(i)] = entry
        self.player_count = u256(len(SEED_PLAYERS))

    def _require_submission_fee(self):
        if int(gl.message.value) < int(self.submission_fee):
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} Insufficient payment. Required: {int(self.submission_fee)}, sent: {int(gl.message.value)}"
            )

    def _require_action_fee(self):
        if int(gl.message.value) < int(self.action_fee):
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} Insufficient action payment. Required: {int(self.action_fee)}, sent: {int(gl.message.value)}"
            )

    def _project_exists(self, project_id: str) -> bool:
        for i in range(int(self.player_count)):
            try:
                p = json.loads(self.players[u256(i)])
                if p.get("id") == project_id:
                    return True
            except Exception:
                pass
        return False

    @gl.public.write.payable
    def submit_player(self, url: str):
        """Legacy URL-only entry point. Kept for old frontends; stores empty creator metadata."""
        self.submit_project(url, "{}")

    @gl.public.write.payable
    def submit_project(self, url: str, metadata_json: str):
        """
        Submit a URL plus creator-supplied graph metadata and pay submission_fee in GEN.

        Consensus verifies only evidence-backed facts: URL liveness, GenLayer relevance,
        category plausibility, summary, confidence, and reason. It does NOT invent canonical
        graph edges. Creator relationship claims are stored separately and can be challenged,
        edited, upvoted, or downvoted by later paid transactions.
        """
        self._require_submission_fee()
        if not (url.startswith("https://") or url.startswith("http://")):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} URL must start with http:// or https://")

        creator = _normalize_creator_metadata(url, metadata_json)
        if self._project_exists(creator["id"]):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Project id already exists")

        target_url = url
        claimed_name = creator["name"]
        claimed_description = creator["description"]
        claimed_category = creator["category"]
        valid_labels = ", ".join(VALID_LABELS)

        def leader_fn():
            resp = gl.nondet.web.get(target_url)
            if not resp:
                return _normal_evaluation(target_url, False, False, False, "Submitted page could not be fetched.", "OTHER", 0, "fetch_missing", [])
            if resp.status >= 500:
                return _normal_evaluation(target_url, False, False, False, "Submitted page was temporarily unavailable.", "OTHER", 0, "fetch_transient", [])
            if resp.status != 200:
                return _normal_evaluation(target_url, False, False, False, f"Submitted page returned HTTP {resp.status}.", "OTHER", 0, "fetch_failed", [])

            page_text = resp.body.decode("utf-8", errors="replace")[:5000]
            prompt = f"""You are verifying a submitted GenLayer ecosystem project.
Do NOT invent graph links. Only evaluate the website and creator claims.

URL: {target_url}
Creator claimed name: {claimed_name}
Creator claimed description: {claimed_description}
Creator claimed category: {claimed_category}

Page content:
{page_text}

Return ONLY valid JSON with this exact shape:
{{
  "is_genlayer_related": true,
  "display_eligible": true,
  "summary": "<one sentence explaining what the project does>",
  "category": "<ONE of: {valid_labels}>",
  "confidence": 0,
  "reason": "<short reason>",
  "evidence": ["<specific evidence from page>"]
}}

Rules:
- is_genlayer_related is true only if the page itself supports a GenLayer relationship.
- display_eligible is true only if the site is live, not spam, and related to GenLayer.
- category must be exactly one listed category.
- evidence must quote or paraphrase concrete page evidence, not graph assumptions.
"""
            try:
                raw = gl.nondet.exec_prompt(prompt)
                parsed = _parse_json(raw)
                is_related = bool(parsed.get("is_genlayer_related", False))
                eligible = bool(parsed.get("display_eligible", False)) and is_related
                category = _safe_str(parsed.get("category") or claimed_category, "OTHER", 40).upper()
                confidence = int(parsed.get("confidence", 0))
                evidence = parsed.get("evidence", [])
                if not isinstance(evidence, list):
                    evidence = []
                return _normal_evaluation(
                    target_url,
                    True,
                    is_related,
                    eligible,
                    parsed.get("summary") or claimed_description,
                    category,
                    confidence,
                    parsed.get("reason") or ("verified" if eligible else "needs_review"),
                    evidence,
                )
            except Exception:
                return _normal_evaluation(target_url, True, False, False, "LLM evaluation returned an invalid response.", "OTHER", 0, "llm_parse_failed", [])

        def validator_fn(leaders_res: gl.vm.Result) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            validator_result = leader_fn()
            leader_data = leaders_res.calldata
            # Stable consensus boundary: validators must agree on the gating fields and category.
            return (
                validator_result["is_live"] == leader_data["is_live"]
                and validator_result["is_genlayer_related"] == leader_data["is_genlayer_related"]
                and validator_result["display_eligible"] == leader_data["display_eligible"]
                and validator_result["category"] == leader_data["category"]
            )

        evaluation = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        player_id = int(self.player_count)
        status = "accepted" if evaluation["display_eligible"] else "needs_review"
        entry = json.dumps({
            "index": player_id,
            "id": creator["id"],
            "url": target_url,
            "submitter": _address_to_str(gl.message.sender_address),
            "creator_metadata": creator,
            "evaluation": evaluation,
            "status": status,
            "source": "bradbury_submission",
        })
        self.players[u256(player_id)] = entry
        self.player_count = u256(player_id + 1)

    @gl.public.write.payable
    def vote_project(self, project_id: str, support: bool):
        """Paid up/down signal on an existing project id."""
        self._require_action_fee()
        if not self._project_exists(project_id):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Project not found")
        vote_id = int(self.project_vote_count)
        self.project_vote_events[u256(vote_id)] = json.dumps({
            "id": vote_id,
            "project_id": project_id,
            "support": bool(support),
            "voter": _address_to_str(gl.message.sender_address),
        })
        self.project_vote_count = u256(vote_id + 1)

    @gl.public.write.payable
    def propose_project_update(self, project_id: str, patch_json: str):
        """Paid proposal for changing project metadata/relationships. Voting decides whether to adopt off-chain/on later app versions."""
        self._require_action_fee()
        if not self._project_exists(project_id):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Project not found")
        try:
            patch = _parse_json(patch_json)
        except Exception:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} patch must be valid JSON")
        update_id = int(self.update_count)
        entry = json.dumps({
            "id": update_id,
            "project_id": project_id,
            "submitter": _address_to_str(gl.message.sender_address),
            "patch": patch,
            "status": "pending_vote",
        })
        self.updates[u256(update_id)] = entry
        self.update_count = u256(update_id + 1)

    @gl.public.write.payable
    def vote_update(self, update_id: int, support: bool):
        """Paid up/down signal on a proposed project update."""
        self._require_action_fee()
        key = u256(update_id)
        if key not in self.updates:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Update not found")
        vote_id = int(self.update_vote_count)
        self.update_vote_events[u256(vote_id)] = json.dumps({
            "id": vote_id,
            "update_id": update_id,
            "support": bool(support),
            "voter": _address_to_str(gl.message.sender_address),
        })
        self.update_vote_count = u256(vote_id + 1)

    @gl.public.view
    def get_players(self) -> str:
        result = []
        for i in range(int(self.player_count)):
            try:
                result.append(json.loads(self.players[u256(i)]))
            except Exception:
                pass
        return json.dumps(result)

    @gl.public.view
    def get_player(self, player_id: int) -> str:
        key = u256(player_id)
        if key not in self.players:
            raise gl.vm.UserError(f"Player {player_id} not found")
        return self.players[key]

    @gl.public.view
    def get_project_votes(self, project_id: str) -> str:
        up = 0
        down = 0
        for i in range(int(self.project_vote_count)):
            try:
                event = json.loads(self.project_vote_events[u256(i)])
                if event.get("project_id") == project_id:
                    if event.get("support"):
                        up += 1
                    else:
                        down += 1
            except Exception:
                pass
        return json.dumps({
            "project_id": project_id,
            "up": up,
            "down": down,
        })

    @gl.public.view
    def get_updates(self) -> str:
        result = []
        for i in range(int(self.update_count)):
            try:
                update = json.loads(self.updates[u256(i)])
                votes_up = 0
                votes_down = 0
                for j in range(int(self.update_vote_count)):
                    event = json.loads(self.update_vote_events[u256(j)])
                    if int(event.get("update_id", -1)) == i:
                        if event.get("support"):
                            votes_up += 1
                        else:
                            votes_down += 1
                update["votes_up"] = votes_up
                update["votes_down"] = votes_down
                result.append(update)
            except Exception:
                pass
        return json.dumps(result)

    @gl.public.view
    def get_submission_fee(self) -> int:
        return int(self.submission_fee)

    @gl.public.view
    def get_action_fee(self) -> int:
        return int(self.action_fee)

    @gl.public.write
    def set_submission_fee(self, new_fee: int):
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Only owner can set submission fee")
        self.submission_fee = u256(new_fee)

    @gl.public.write
    def set_action_fee(self, new_fee: int):
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Only owner can set action fee")
        self.action_fee = u256(new_fee)

    @gl.public.write
    def withdraw(self):
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Only owner can withdraw")
        amount = self.balance
        if int(amount) == 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Nothing to withdraw")
        gl.contract.transfer(self.owner, amount)
