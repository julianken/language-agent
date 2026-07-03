# src/sidecars/zh/curation — the zh curation toolchain (issue #20)

The offline curation pipeline that produced the real `@la/lang-zh/assets`
seed sliver (58 Traditional words), the C9 context enumeration (267
contexts), and the segmenter-normalization map — every item pre-verified
through the **full offline machine gate** before shipping (ADR dual-instance
amendment, Decisions 1/5: the full gate runs AT CURATION; the deployed
sidecar runs deterministic legs only).

**This directory is NEVER deployed.** It is the only container/profile in
the tree permitted to run g2pW / HanLP / OpenCC / torch (Decision 5). The
deployed zh sidecar's torch-free property is inviolable and untouched:
`../.dockerignore` excludes `curation/` from the sidecar image build
context, `scripts/assert-deterministic-only.sh` re-verifies the built image
in CI on every PR, and no deploy manifest references this directory.

## The heteronym policy (verbatim — ADR Decision 1, normative wording)

> no surface form carries two sliver `reading_id`s; every non-sliver
> alternate CC-CEDICT reading of a sliver word is confirmed
> closed-world-unreachable at curation (machine-checked injectivity +
> reviewed unreachability); head-set singles admitted per C3/C9.

("Head-set singles" = the v0 sliver function-word subset, C3: {的, 了, 不,
一} plus 嗎/呢 — the gloss is for readers; the committed validator/docs text
carries the ADR's exact token. The full §6.8 head set — 的/地/得, 了, 不,
一, 行, 重, 著, 和 — is NOT implemented in v0.) The machine-checked
injectivity half lives in `tools/validate_assets.py` (its failure text
carries this policy verbatim — AC2); the reviewed-unreachability half is the
per-word `altReadings` record in `sliver/words.json` (AC3).

## Layout

| Path | What |
| --- | --- |
| `sliver/words.json` | The hand-curated sliver SOURCE: 58 TOCFL/SC-TOP band-1 Traditional words (one flagged exemplar exception, 展覽館), Sinica-frequency-informed ranks, hand-pinned readings, per-word alternate-reading unreachability reviews, the variant→MOE map |
| `sliver/contexts-grammar.json` | The C9 role grammar — the committed definition of "reachable"; expanded to the 267-entry context table |
| `corpus/sentences.json` | 55 cleanroom curated sentences (every sliver word covered; pinned AS-standard cuts) |
| `corpus/c9-carriers.generated.json` | One generated carrier sentence per C9 context (builder-verified to realize its exact context) |
| `tools/build_assets.py` | sources → `src/packages/lang-zh/assets/*` (deterministic; derives the jieba normalization map from real cuts) |
| `tools/validate_assets.py` | The curation validator: C1–C9 + per-char consistency + gate-results enforcement; `--selftest` proves the AC5 hard-fail fixtures |
| `tools/gate_*.py` | The offline gate legs (below) |
| `tools/run_gate.py` | Merges leg results into `results/gate-results.json` |
| `results/` | The committed per-item gate record (AC6) + per-leg detail |
| `baseline/g2pw-drift-baseline.json` | The recorded g2pW drift baseline (Decision 5; N4 inherits it) |
| `goldpass/` | The AC7 native-checker task package (Prolific-ready; see its README) |

## Curation constraints C1–C9 (issue #20; all machine-checked where checkable)

- **C1** closed-world reading injectivity (validator; hard fail) + reviewed
  non-sliver-reading unreachability (`words.json` altReadings).
- **C2** no word carries two sliver reading_ids; no standalone
  行/重/長/得/地/著/和 (validator FORBIDDEN_STANDALONE).
- **C3** singles exactly {的, 了, 不, 一, 嗎, 呢}; multi-char words containing
  referent-(2) characters excluded (validator).
- **C4** segmentation-collision scan: the only decomposable sliver word is
  你好 (the documented >1-cover exemplar, golden fixture 10); residual
  cross-unit compositions (大學-class adjacencies) are caught hot by #19's
  >1-cover regenerate / vote-YELLOW (validator + recorded).
- **C5** no erhua; neutral-tone words pinned to their CC-CEDICT citation
  form (朋友 péngyou, 學生 xuésheng, …) (validator).
- **C6** no 離合詞 — `spanGroup` stays fake-covered in the TCK until the
  separable-verb expansion child (validator list check + hand review).
- **C7** 兩/二 role split explicit (two-quantity vs two-digit) (validator).
- **C8** TOCFL band-1 spine, Sinica-frequency-informed hand ordering,
  cleanroom provenance (below).
- **C9** every reachable context of every single enumerated (the role
  grammar closed over the sliver), closure under single-adjacency, hard-
  pattern exclusions (no V+不/得+了 enumeration; ordinal 一 only via
  `rule: ordinal-date`), surface-shift consistency mirroring the sidecar's
  resolver — machine-expanded, machine-verified, exported as
  `src/packages/lang-zh/assets/c9-context-table.json` — **the same artifact
  `src/sidecars/zh` consumes** (its baked `data/lexicon.json` is
  build-generated from it; #19's `headset-context-pinned` leg reads it hot).

## The offline machine gate (per tuple + per context + per sentence)

| Leg | Tool | What it proves |
| --- | --- | --- |
| membership | committed CC-CEDICT(Traditional)/Unihan extracts | citation is a real reading; per-char syllables attested (design §6.1 — citation layer only) |
| g2pW base-reading | g2pw 0.1.1 (G2PWModel-v2-onnx, Traditional-native) over corpus + all 267 carriers | context-appropriate base readings (design §6.2) |
| multi-segmenter vote | pypinyin reading voter; jieba through the SHIPPED normalization map (sidecar-identical); AS-configured HanLP reference | boundary conventions normalized, genuine disagreements surfaced (design §6.3/§6.7) |
| sandhi resolver | stdlib mirror of `app/legs/sandhi.py` | surface pins legal; C9 shifts consistent; corpus display-shaped |
| refutation jury | OpenAI panel (two pinned snapshots), refutation frame, majority gate, downgrade-only | the contextually-wrong-but-dictionary-valid case (design §6.4) |
| OpenCC screen | OpenCC 1.4.0 t2s/s2t roundtrip | advisory flag for S→T-hazard glyphs (design §6.6 context) |

Every non-exact agreement is recorded per position under a documented
equivalence class (`tools/gate_lib.py`): `singles-surface` (sandhi-aware
tools emit bú/yí), `neutral-register` (citation-vs-colloquial tone-5), and
`attested-variant` (same-CEDICT-entry `Taiwan pr.`/`also pr.` — 期 qí,
誰 shuí). **Nothing outside these classes ships**: a genuine disagreement is
dropped or corrected (AC6 — all-GREEN under the legs run to date).
Vendor-diversity note: the jury panel available to this run is single-vendor
(OpenAI; recorded in `results/leg-jury.json` and `gate-results.json` meta) —
cross-vendor relative to the Anthropic-authored pins, and backstopped by the
AC7 native gold pass.

The **one-time native-checker gold pass (AC7)** is deliberately NOT a
machine leg: it is the separate human completion step (`goldpass/`,
GAPS.md row) — the machine PR's claims never bundle it.

## Provenance note (C8 / AC8)

The sliver is **cleanroom-curated**: words were hand-selected against the
public TOCFL/SC-TOP band-1 level definition; ordering is hand-ranked,
informed by familiarity with published Academia Sinica balanced-corpus
frequency bands — **no frequency list, wordlist file, or dictionary content
was copied**. Glosses and corpus sentences are original prose. CC-CEDICT and
Unihan are consulted as membership *authorities* (their licensed extracts
ship in `../data/` with attribution in `../data/NOTICE.md`); Sinica corpora
were not accessed. 展覽館 (off-band) is retained deliberately as the #19
golden-fixture within-word third-tone-run exemplar, flagged
`tocfl: exemplar-exception`.

## Running it

```sh
# curation env (or the container below)
uv venv .venv -p 3.12 && uv pip install --python .venv/bin/python -r requirements.txt

# 1. rebuild assets from sources (deterministic)
python3 tools/build_assets.py
# 2. regenerate the sidecar's membership extracts for the new closed world
#    (download instructions in ../scripts/extract_membership.py), then:
python3 ../scripts/extract_membership.py --cedict /tmp/cedict.txt --unihan /tmp/Unihan_Readings.txt
python3 ../scripts/build_lexicon.py
# 3. run the legs (see run_gate.py docstring for the exact commands)
# 4. merge + validate
python3 tools/run_gate.py
python3 tools/validate_assets.py

# the container (CI drift job uses exactly this; never deployed)
docker build -t language-agent/curation-zh:dev .
docker run --rm -v "$(git rev-parse --show-toplevel)":/repo -w /repo \
  language-agent/curation-zh:dev \
  python3 src/sidecars/zh/curation/tools/gate_g2pw.py \
    --check src/sidecars/zh/curation/baseline/g2pw-drift-baseline.json
```

## The scheduled g2pW drift job (Decision 5)

`.github/workflows/drift-g2pw.yml` (weekly + manual dispatch; **non-blocking
by construction** — never a PR gate) builds this container and re-runs real
g2pW over the corpus + all C9 carriers, diffing the per-position fingerprint
against `baseline/g2pw-drift-baseline.json`. A red run means g2pW drifted
against the pinned readings / C9 table — the alarm that keeps invariant I1
honest from the skeleton onward. This issue's first recorded run IS the
baseline; N4 inherits it as its acceptance floor and does not re-enable the
job. Logged generated turns join the corpus once a deployed system produces
them (pre-deploy: none exist).
