"""Instance constants the ar sidecar declares on the shared contract.

`CONTRACT_VERSION` must equal BOTH `@la/contract`'s `CONTRACT_VERSION` and
the shared spec's `info.version` (exact equality; in-tree packs deploy
lockstep — ADR §1.2, §3.5). tests/test_capabilities.py enforces the
lockstep against the hand-authored openapi.yaml, so a spec version bump
that forgets this constant fails the suite rather than skewing silently.
"""

LANGUAGE = "ar"

CONTRACT_VERSION = "0.1.0"

# Opaque leg ids (engine logs them, never branches on them). The set is the
# issue #7 walking-skeleton scope: two deterministic legs ONLY — the
# diverse-LLM refutation jury and the 2nd diacritizer (CATT) are named
# follow-ups, not part of the skeleton.
LEG_DEDIAC = "dediac-roundtrip"
LEG_MORPH = "camel-morph"
VERIFICATION_LEGS: tuple[str, ...] = (LEG_DEDIAC, LEG_MORPH)

# The module-owned annotation-payload schema id — must match
# `@la/lang-ar`'s AR_ANNOTATIONS_SCHEMA_ID (the zod schema is the single
# canonical source; src/packages/lang-ar/ar-annotations.schema.json is
# generated from it and this sidecar's fixtures validate against that
# artifact).
ANNOTATION_SCHEMA_ID = "ar-annotations/v1"

FEATURES: tuple[str, ...] = ()

# The analyzer database (research: the correct, non-gated minimal install;
# calima-msa-s31 is LDC-gated and off the table per epic Open Question #5).
# Pulled at image build via `camel_data -i morphology-db-msa-r13` — GPL-2
# data, see licenses/NOTICE.md.
MORPHOLOGY_DB = "calima-msa-r13"
