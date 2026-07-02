# Third-party data license notice — morphology-db-msa-r13 (GPL-2.0)

This sidecar's Docker image pulls the **CAMeL Tools MSA morphology
database** at **build time** (`camel_data -i morphology-db-msa-r13`, loaded
at runtime as the `calima-msa-r13` analyzer DB). That data package is
licensed under the **GNU General Public License v2** — the full license
text ships alongside this notice ([`GPL-2.0.txt`](GPL-2.0.txt)), and this
`licenses/` directory is copied into the image at `/licenses` so the notice
travels with the data it covers.

Scope, precisely (this is epic #3's Risk #1 mitigation, per issue #7's AC):

- **GPL-2.0** — the `morphology-db-msa-r13` **data** package only. It is
  downloaded from the CAMeL Lab data distribution during `docker build` and
  baked into the image (`CAMELTOOLS_DATA=/opt/camel-data`); it is **not**
  committed to this repository.
- **MIT** — the [`camel-tools`](https://pypi.org/project/camel-tools/)
  Python library (CAMeL Lab, New York University Abu Dhabi), which reads
  that database.
- **MIT** — this repository's own code, including this sidecar's service
  code (see the repository root [`LICENSE`](../../../../LICENSE)). The GPL-2
  data rides in the image as data; the service code neither links it into a
  derived work of the DB nor changes license because of it. Anyone
  redistributing the **built image** is distributing the GPL-2 data package
  and must preserve this notice and the license text.

Provenance: the CAMeL Tools data catalogue names `morphology-db-msa-r13`'s
license as GPL-2.0 (the research doc and
`docs/decisions/hosting-walking-skeleton.md` record the same). The
LDC-gated `calima-msa-s31` database is deliberately **not** used (epic #3
Open Question #5).
