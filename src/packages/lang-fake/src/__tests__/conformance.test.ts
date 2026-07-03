// The TCK's first instantiation (issue #17): the ~10-line
// `describeLanguagePack` call ADR §4.1 promises. Runs all six §4.2 law
// categories + the golden-fixture harness against the MAX-topology fake.
import { describeLanguagePack } from "@la/lang-conformance";
import { pack } from "../pack.js";
import { fakes, fixtures } from "./conformance-adapters.js";

describeLanguagePack("lang-fake (MAX-topology fixture pack)", () => pack, {
  fixtures,
  fakes,
});
