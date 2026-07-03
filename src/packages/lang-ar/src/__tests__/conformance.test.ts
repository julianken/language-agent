// The TCK's ar instantiation (issue #9, step 3b): the ~10-line
// `describeLanguagePack` call ADR §4.1 promises, run against the REAL pack
// and the REAL sidecar (never a mock — the golden corpus's expected bands
// and annotation payloads are pinned from src/sidecars/ar's own Python test
// suite / deterministic fallback paths — see fixtures/golden/*.json).
import { describeLanguagePack } from "@la/lang-conformance";
import { pack } from "../pack.js";
import { fakes, fixtures } from "./conformance-adapters.js";

describeLanguagePack("lang-ar (real MSA verification sidecar)", () => pack, {
  fixtures,
  fakes,
});
