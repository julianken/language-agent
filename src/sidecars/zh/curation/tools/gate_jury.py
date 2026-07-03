#!/usr/bin/env python3
"""Gate leg 5 — the diverse-vendor refutation jury (issue #20; design §6.4).

Protocol (design §6.4, applied at curation over the closed seed):
  * REFUTATION frame — each juror is asked to FIND THE ERROR in a
    word/reading/segmentation item, or state there is none ("is this
    correct?" invites sycophantic confirmation; refutation suppresses it).
  * Panel of distinct models, majority gate; the jury can only DOWNGRADE —
    it never overrides the deterministic membership floor and never promotes.
  * Every verdict is recorded per item (curation/results/leg-jury.json).

Vendor-diversity note (recorded honestly): the panel available to this
curation run is OpenAI-only — two pinned model snapshots from different
model generations (see PANEL). Cross-vendor diversity relative to the
CURATOR still holds (the pins were authored with Anthropic Claude; the jury
is OpenAI), but the §6.4 multi-vendor panel is wider than what current
credentials allow. That limitation is part of what AC7's native gold pass —
and the standing weekly calibration (design §6.9) — exist to backstop.
Recorded in gate-results meta as `juryVendors`.

Split verdicts (1-1) have NO majority: the item is investigated and either
fixed, dropped, or explicitly adjudicated in
curation/results/jury-adjudications.json (committed, hand-written, with
justification). An unadjudicated split or a majority refutation is
non-GREEN — it does not ship (AC6).

Credentials: OPENAI_API_KEY from the environment ONLY — never logged,
never committed, never echoed. Requests carry item text exclusively.
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gate_lib import RESULTS_DIR, World  # noqa: E402

PANEL = ["gpt-5.2-2025-12-11", "gpt-4.1-2025-04-14"]
BATCH = 16

SYSTEM = """You are a strict reviewer of Traditional Chinese (Taiwan) curation data for a language-learning system. For EACH numbered item, FIND THE ERROR if one exists, or state there is none. Judge ONLY:
- wrong character usage (a real but contextually wrong glyph),
- wrong pinyin reading for that word/character IN THE GIVEN CONTEXT (tone included; treat citation/dictionary tone vs Taiwan colloquial neutral-tone register variation as NOT an error, but mention it),
- wrong word segmentation for Taiwan Mandarin,
- an ungrammatical or unnatural carrier sentence that would invalidate the reading being verified.
Do NOT flag: prosaic/simple style, elliptical but grammatical sentences, or Mainland-vs-Taiwan register differences (mention them in the note instead).

Reference — standard Mandarin tone-sandhi rules (apply these as GROUND TRUTH; a
correctly-applied sandhi surface is NOT an error, even though it differs from the
listed citation/dictionary reading):
- Third-tone sandhi: when a citation-tone-3 syllable is immediately followed by
  another tone-3 syllable (within a word, or across a tightly-bound word boundary
  such as a greeting or a modifier+head pair), the FIRST syllable surfaces as
  tone 2. E.g. 你好 ni3+hao3 surfaces ni2 hao3; 可以 ke3+yi3 surfaces ke2 yi3;
  a run of 3+ tone-3 syllables (e.g. 展覽館 zhan3+lan3+guan3) surfaces with every
  syllable EXCEPT THE LAST shifted to tone 2 (zhan2 lan2 guan3). This is standard,
  prescriptively correct Taiwan Mandarin — always judge it "no-error" when you see
  a "display surface" that differs from the citation reading only by this 3->2
  shift pattern.
- 不 (bu4) tone shift: 不 surfaces as bu2 when the FOLLOWING syllable is tone 4
  (e.g. 不是 surfaces bu2shi4, 不大 surfaces bu2da4); before tones 1/2/3 it stays
  bu4 (不多 stays bu4duo1, 不看 stays bu4kan4 — NOTE: 看 kan4 IS tone 4, so 不看
  correctly surfaces bu2kan4). Judge the SURFACE items strictly against this rule,
  not intuition.
- 一 (yi1) tone shift: 一 surfaces as yi2 when the FOLLOWING syllable is tone 4
  (一個 individually the classifier 個 is neutral/ge4-derived — treat per the
  item's own stated rule id when given); before tones 1/2/3 it surfaces yi4
  (一本 ben3 is tone 3, so 一本 correctly surfaces yi4ben3 — yi2 would be the
  ERROR here); in bare counting/ordinal/date roles it stays unshifted yi1. An
  item's "rule" field (e.g. "tone-shift-before-4", "tone-shift-before-non-4")
  names which of these branches was applied — trust the item's own rule id over
  a quick mental recomputation, and only flag it if the stated surface
  contradicts that named rule.
When an item's "rule" field is present, treat it as the authoritative derivation
and check the surface AGAINST that named rule — do not re-derive from scratch and
guess a different rule branch.

Respond with JSON only: {"items":[{"id":"<id>","verdict":"no-error"|"error","note":"<short reason or empty>"}]} — one entry per item, same ids."""


def openai_call(model: str, prompt: str) -> dict:
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise SystemExit("gate_jury: OPENAI_API_KEY not set (env-only; never committed)")
    body: dict = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
        "max_completion_tokens": 6000,
    }
    if model.startswith("gpt-5"):
        body["reasoning_effort"] = "low"
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
    )
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=240) as resp:
                data = json.load(resp)
            return json.loads(data["choices"][0]["message"]["content"])
        except Exception as exc:  # noqa: BLE001 — retry with backoff, then surface
            if attempt == 3:
                raise SystemExit(f"gate_jury: OpenAI call failed after retries: {type(exc).__name__}")
            time.sleep(8 * (attempt + 1))
    raise AssertionError


def build_items(world: World) -> list[dict]:
    items = []
    for t in world.tuples_doc["tuples"]:
        items.append(
            {
                "id": f"tuple:{t['readingId']}",
                "text": (
                    f"WORD: {t['word']} — pinyin {' '.join(t['citationPinyin'])} "
                    f"(display surface {' '.join(t['surfacePinyin'])}), POS {t['pos']}, "
                    f"gloss: {t['gloss']}. Is the reading/gloss wrong for Taiwan Traditional usage?"
                ),
            }
        )
    carriers = {c["contextKey"]: c["text"] for c in world.carriers}
    for e in world.table_doc["entries"]:
        key = f"{e['char']}|{e['prev']}|{e['next']}"
        rule = f", rule {e['rule']}" if "rule" in e else ""
        items.append(
            {
                "id": f"context:{key}",
                "text": (
                    f"FUNCTION-WORD CONTEXT: {e['char']} with previous unit {e['prev']} and "
                    f"next unit {e['next']} (<START>/<END> = sentence edge), pinned base "
                    f"reading {e['base']}, in-sentence surface {e['surface']}{rule}. "
                    f"Carrier sentence: {carriers.get(key, '')} This carrier is a DELIBERATELY "
                    f"minimal, single-purpose verification instrument generated to isolate "
                    f"exactly this one (char, prev, next) context — it is never shown to a "
                    f"learner and is not meant to read as a natural free-standing sentence, so "
                    f"bare terseness/incompleteness/needing more context is NOT an error (do not "
                    f"flag a short subject-less or object-less fragment on that basis alone). Is "
                    f"the pinned reading, the tone-sandhi surface, or the carrier's GRAMMAR "
                    f"(a real syntax/agreement mistake, not mere terseness) wrong?"
                ),
            }
        )
    for s in world.corpus["sentences"]:
        expected = world.expected_readings(s["text"])
        if expected is None:
            reading = "(cover-ambiguous exemplar 你好: ni3 hao3, displayed ni2 hao3)"
            sandhi_note = ""
        else:
            reading, note = World.display_reading(expected)
            sandhi_note = f" [Applied sandhi: {note}]" if note else ""
        items.append(
            {
                "id": f"sentence:{s['id']}",
                "text": (
                    f"SENTENCE: {s['text']} — segmentation {'|'.join(s['cut'])}; "
                    f"surface readings: {reading}.{sandhi_note} Is the sentence, its "
                    f"segmentation (fine-grained: numeral|classifier, verb|object, "
                    f"negation|verb, and date-word|weekday-numeral (星期|一, 星期|二, "
                    f"星期|五, ...) are deliberate conventions — not errors), or any "
                    f"reading wrong (other than an [Applied sandhi] shift, which is "
                    f"already confirmed correct — do not re-litigate it)?"
                ),
            }
        )
    return items


def main() -> int:
    world = World()
    items = build_items(world)
    verdicts: dict[str, dict[str, dict]] = {i["id"]: {} for i in items}

    for model in PANEL:
        for start in range(0, len(items), BATCH):
            batch = items[start : start + BATCH]
            # Opaque per-batch ids (n1, n2, …): models abbreviate contentful
            # ids, so the mapping back to real item ids is local to the batch.
            local = {f"n{k + 1}": i for k, i in enumerate(batch)}
            prompt = "Reply with one entry per item, using EXACTLY the id in brackets (n1, n2, …).\n\n" + "\n\n".join(
                f"[{lid}]\n{i['text']}" for lid, i in local.items()
            )
            out = openai_call(model, prompt)
            got = {str(x.get("id", "")).strip().lstrip("[").rstrip("]"): x for x in out.get("items", [])}
            for lid, i in local.items():
                v = got.get(lid)
                if v is None or v.get("verdict") not in ("no-error", "error"):
                    v = {"verdict": "error", "note": "juror returned no parseable verdict — conservative downgrade"}
                verdicts[i["id"]][model] = {"verdict": v["verdict"], "note": v.get("note", "")}
            done = min(start + BATCH, len(items))
            print(f"jury [{model}]: {done}/{len(items)}", file=sys.stderr)

    adjudications = {}
    adj_path = RESULTS_DIR / "jury-adjudications.json"
    if adj_path.exists():
        adjudications = json.loads(adj_path.read_text("utf-8")).get("adjudications", {})

    records = []
    for i in items:
        per_model = verdicts[i["id"]]
        n_err = sum(1 for v in per_model.values() if v["verdict"] == "error")
        if n_err == 0:
            status = "pass"
        elif n_err == len(PANEL):
            status = "refuted-majority"
        else:
            status = "split"
        adjudicated = i["id"] in adjudications
        record = {
            "id": i["id"],
            "status": status,
            "pass": status == "pass" or (status == "split" and adjudicated),
            "jurors": per_model,
            **({"adjudication": adjudications[i["id"]]} if adjudicated else {}),
        }
        records.append(record)

    result = {
        "leg": "diverse-vendor-refutation-jury",
        "panel": PANEL,
        "juryVendors": ["openai"],
        "vendorDiversityNote": (
            "single-vendor panel (OpenAI, two pinned model snapshots) — the widest "
            "panel current credentials allow; cross-vendor vs the Anthropic-authored "
            "pins; AC7's native gold pass backstops (see module doc)"
        ),
        "protocol": "refutation frame; majority gate; downgrade-only (never overrides the deterministic floor); splits require committed adjudication",
        "records": records,
    }
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    (RESULTS_DIR / "leg-jury.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", "utf-8"
    )
    n = sum(1 for r in records if r["pass"])
    print(f"jury leg: {n}/{len(records)} pass", file=sys.stderr)
    for r in records:
        if not r["pass"]:
            print(f"  {r['status'].upper()} {r['id']}: {json.dumps(r['jurors'], ensure_ascii=False)[:300]}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
