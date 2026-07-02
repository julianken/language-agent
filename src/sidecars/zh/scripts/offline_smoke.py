#!/usr/bin/env python3
"""Offline runtime smoke — runs INSIDE the container (stdlib only).

CI starts the image with `--network=none` and `docker exec`s this script:
it exercises the full endpoint surface against 127.0.0.1, proving the
sidecar serves real verdicts with NO network access (no runtime data fetch —
issue #19 AC: "builds and runs with network access disabled at runtime").
"""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000"


def get(path: str) -> tuple[int, dict]:
    try:
        with urllib.request.urlopen(f"{BASE}{path}", timeout=5) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as err:
        return err.code, json.loads(err.read())


def post(path: str, payload: dict) -> tuple[int, dict]:
    request = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(payload).encode(),
        headers={"content-type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as resp:
        return resp.status, json.loads(resp.read())


def main() -> int:
    deadline = time.time() + 60
    status = None
    while time.time() < deadline:
        try:
            status, _ = get("/readyz")
            if status == 200:
                break
        except (urllib.error.URLError, ConnectionError):
            pass
        time.sleep(0.5)
    assert status == 200, f"/readyz never reached 200 (last: {status})"

    status, health = get("/healthz")
    assert (status, health) == (200, {"status": "ok"}), health

    status, caps = get("/v1/capabilities")
    assert status == 200
    assert caps["language"] == "zh"
    assert caps["verificationLegs"] == [
        "cedict-unihan-membership",
        "seed-closed-world",
        "headset-context-pinned",
        "sandhi-resolver",
        "segmenter-vote",
        "numeral-rule",
    ], caps

    # A pass case and a RED case, fully offline.
    status, body = post(
        "/v1/verify",
        {
            "targetText": "你喝茶嗎？",
            "intents": [
                {"id": "drink", "description": "asks about drinking"},
                {"id": "tea", "description": "the drink offered is tea"},
            ],
        },
    )
    assert status == 200
    bands = [t["band"] for t in body["tokens"]]
    assert bands == ["GREEN"] * 5, bands

    status, body = post(
        "/v1/verify",
        {"targetText": "你喝咖啡嗎？", "intents": [{"id": "drink", "description": "d"}]},
    )
    assert status == 200
    assert body["tokens"][0]["band"] == "RED", body

    print("offline smoke PASSED: /healthz, /readyz, /v1/capabilities, /v1/verify all served with network disabled")
    return 0


if __name__ == "__main__":
    sys.exit(main())
