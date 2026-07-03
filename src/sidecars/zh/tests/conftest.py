"""Shared test fixtures.

`client` serves the real baked data; `poisoned_client` serves a test-only
data directory whose 茶 tuple pins a WRONG reading (chā) — proving the
citation-membership floor RED-fails a wrongly-pinned/corrupted table (the
"wrong-reading" golden case). The poisoned directory is built at test time
from the real data — nothing wrong ever lives in the shipped tables.
"""

from __future__ import annotations

import json
import shutil
import sys
import time
from pathlib import Path

import pytest

SIDECAR_ROOT = Path(__file__).resolve().parent.parent
if str(SIDECAR_ROOT) not in sys.path:
    sys.path.insert(0, str(SIDECAR_ROOT))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import create_app  # noqa: E402
from app.state import _build_jieba_voter, load_tables  # noqa: E402


def _wait_ready(client: TestClient, timeout: float = 60.0) -> None:
    deadline = time.time() + timeout
    while client.get("/readyz").status_code != 200:
        if time.time() > deadline:
            raise RuntimeError("sidecar did not become ready")
        time.sleep(0.05)


@pytest.fixture(scope="session")
def tables():
    return load_tables()


@pytest.fixture(scope="session")
def voter(tables):
    return _build_jieba_voter(tables)


@pytest.fixture(scope="session")
def gate(tables, voter):
    from app.gate import VerifyGate

    return VerifyGate(tables, voter)


@pytest.fixture(scope="session")
def client(voter):
    with TestClient(create_app(voter=voter)) as c:
        _wait_ready(c)
        yield c


@pytest.fixture(scope="session")
def poisoned_client(tmp_path_factory, voter):
    data_dir = tmp_path_factory.mktemp("poisoned-data")
    for f in (SIDECAR_ROOT / "data").glob("*.json"):
        shutil.copy(f, data_dir / f.name)
    lexicon_path = data_dir / "lexicon.json"
    lexicon = json.loads(lexicon_path.read_text("utf-8"))
    lexicon["words"]["茶"]["citationPinyin"] = ["cha1"]
    lexicon["words"]["茶"]["surfacePinyin"] = ["cha1"]
    lexicon_path.write_text(json.dumps(lexicon, ensure_ascii=False), "utf-8")
    with TestClient(create_app(data_dir=data_dir, voter=voter)) as c:
        _wait_ready(c)
        yield c
