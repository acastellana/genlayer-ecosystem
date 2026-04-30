# v0.2.0
# { "Depends": "py-genlayer:latest" }
from genlayer import *
import json

ERROR_EXPECTED = "[EXPECTED]"
ERROR_EXTERNAL = "[EXTERNAL]"
ERROR_TRANSIENT = "[TRANSIENT]"
ERROR_LLM = "[LLM_ERROR]"

# Bradbury native unit is wei-like atto GEN. Albert's submission fee is 0.042 GEN.
DEFAULT_SUBMISSION_FEE = 42_000_000_000_000_000


def _address_to_str(address: Address) -> str:
    """Return a stable public address string without relying on non-portable address helpers."""
    return str(address)


def _parse_llm_json(raw):
    """Parse LLM response; accept dicts and fenced/extra-text JSON strings."""
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
        raise gl.vm.UserError(f"{ERROR_LLM} LLM JSON was not an object")
    return parsed


SEED_PLAYERS = [
    {
        "name": "GenLayer",
        "description": "AI-native blockchain with intelligent contracts validated by LLM jurors.",
        "url": "https://genlayer.com",
        "label": "INFRASTRUCTURE",
        "connections": [],
    },
    {
        "name": "Rally",
        "description": "Token launch and community platform built on GenLayer.",
        "url": "https://rally.fan",
        "label": "TOKEN LAUNCH",
        "connections": ["GenLayer"],
    },
    {
        "name": "Argue.fun",
        "description": "Argumentation markets where AI agents debate and bet ARGUE tokens.",
        "url": "https://argue.fun",
        "label": "DISPUTE RESOLUTION",
        "connections": ["GenLayer"],
    },
    {
        "name": "InternetCourt",
        "description": "Decentralized AI arbitration court for on-chain disputes.",
        "url": "https://internetcourt.org",
        "label": "RESOLVES DISPUTES",
        "connections": ["GenLayer", "Argue.fun"],
    },
    {
        "name": "MergeProof",
        "description": "On-chain code review and merge verification via AI.",
        "url": "https://mergeproof.io",
        "label": "DEVELOPER TOOLING",
        "connections": ["GenLayer"],
    },
    {
        "name": "Conditional Payment",
        "description": "Cross-border trade finance with AI-verified shipment conditions.",
        "url": "https://acastellana.github.io/conditional-payment-cross-border-trade/",
        "label": "TRADE FINANCE",
        "connections": ["GenLayer", "InternetCourt"],
    },
]

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


def _normal_entry(url: str, name: str, description: str, label: str, connections: list[str], approved: bool, reason: str) -> dict:
    if label not in VALID_LABELS:
        label = "OTHER"
    return {
        "name": str(name or "Unknown")[:40],
        "description": str(description or "")[:120],
        "url": url,
        "label": label,
        "connections": connections,
        "approved": approved,
        "reason": reason,
    }


class EcosystemRegistry(gl.Contract):
    owner: Address
    submission_fee: u256
    players: TreeMap[u256, str]
    player_count: u256

    def __init__(self, submission_fee: int = DEFAULT_SUBMISSION_FEE):
        self.owner = gl.message.sender_address
        self.submission_fee = u256(submission_fee)
        self.player_count = u256(0)

        owner_hex = _address_to_str(self.owner)
        for i, p in enumerate(SEED_PLAYERS):
            entry = json.dumps({
                "id": i,
                "name": p["name"],
                "description": p["description"],
                "url": p["url"],
                "label": p["label"],
                "connections": p["connections"],
                "submitter": owner_hex,
                "approved": True,
                "reason": "seeded",
            })
            self.players[u256(i)] = entry
        self.player_count = u256(len(SEED_PLAYERS))

    @gl.public.write.payable
    def submit_player(self, url: str):
        """
        Submit a URL and pay submission_fee in GEN.
        Payment buys evaluation, not guaranteed listing.
        The nondeterministic path is designed to return needs-review records instead
        of surfacing transient web/LLM failures as finalized execution errors.
        """
        if int(gl.message.value) < int(self.submission_fee):
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} Insufficient payment. Required: {int(self.submission_fee)}, "
                f"sent: {int(gl.message.value)}"
            )
        if not (url.startswith("https://") or url.startswith("http://")):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} URL must start with http:// or https://")

        target_url = url
        count = int(self.player_count)
        existing_names = []
        for i in range(count):
            try:
                p = json.loads(self.players[u256(i)])
                existing_names.append(p["name"])
            except Exception:
                pass
        names_list = ", ".join(existing_names)
        valid_labels = ", ".join(VALID_LABELS)

        def leader_fn():
            resp = gl.nondet.web.get(target_url)
            if not resp:
                return _normal_entry(target_url, "Unknown", "Submitted page could not be fetched.", "OTHER", [], False, "fetch_missing")
            if resp.status >= 500:
                return _normal_entry(target_url, "Unknown", "Submitted page was temporarily unavailable.", "OTHER", [], False, "fetch_transient")
            if resp.status != 200:
                return _normal_entry(target_url, "Unknown", f"Submitted page returned HTTP {resp.status}.", "OTHER", [], False, "fetch_failed")

            page_text = resp.body.decode("utf-8", errors="replace")[:4000]
            prompt = f"""You are curating the GenLayer ecosystem registry.
Analyze this project page and extract structured information.

URL: {target_url}
Page content:
{page_text}

Existing ecosystem players: {names_list}

Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{{
  "name": "<short project name, max 40 chars>",
  "description": "<one sentence, max 120 chars>",
  "label": "<ONE of: {valid_labels}>",
  "connections": ["<name from existing players list if clearly related, else omit>"]
}}

Rules:
- connections must only contain names from the existing players list
- label must be exactly one of the listed options
- If the page is not a real project (spam, error page, etc.), set label to "OTHER" and name to "Unknown"
"""
            try:
                raw = gl.nondet.exec_prompt(prompt)
                parsed = _parse_llm_json(raw)
                label = parsed.get("label", "OTHER")
                connections = [n for n in parsed.get("connections", []) if n in existing_names]
                approved = label in VALID_LABELS and label != "OTHER" and str(parsed.get("name", "Unknown")) != "Unknown"
                return _normal_entry(
                    target_url,
                    parsed.get("name", "Unknown"),
                    parsed.get("description", ""),
                    label,
                    connections,
                    approved,
                    "evaluated" if approved else "needs_review",
                )
            except Exception:
                return _normal_entry(target_url, "Unknown", "LLM evaluation returned an invalid response.", "OTHER", [], False, "llm_parse_failed")

        def validator_fn(leaders_res: gl.vm.Result) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            validator_result = leader_fn()
            leader_data = leaders_res.calldata
            return (
                validator_result["label"] == leader_data["label"]
                and validator_result["approved"] == leader_data["approved"]
                and validator_result["reason"] == leader_data["reason"]
                and set(validator_result["connections"]) == set(leader_data["connections"])
            )

        result = gl.vm.run_nondet(leader_fn, validator_fn)
        if not isinstance(result, gl.vm.Return):
            raise gl.vm.UserError(f"{ERROR_LLM} Consensus did not return an evaluation")
        enriched = result.calldata

        player_id = count
        entry = json.dumps({
            "id": player_id,
            "name": enriched["name"],
            "description": enriched["description"],
            "url": target_url,
            "label": enriched["label"],
            "connections": enriched["connections"],
            "submitter": _address_to_str(gl.message.sender_address),
            "approved": enriched["approved"],
            "reason": enriched["reason"],
        })
        self.players[u256(player_id)] = entry
        self.player_count = u256(player_id + 1)

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
    def get_submission_fee(self) -> int:
        return int(self.submission_fee)

    @gl.public.write
    def set_submission_fee(self, new_fee: int):
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Only owner can set submission fee")
        self.submission_fee = u256(new_fee)

    @gl.public.write
    def withdraw(self):
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Only owner can withdraw")
        amount = self.balance
        if int(amount) == 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Nothing to withdraw")
        gl.contract.transfer(self.owner, amount)
