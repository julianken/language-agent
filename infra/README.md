# infra/ — deploy IaC (issue #11)

One Terraform tree spanning the `google` + `cloudflare` providers, per
[`docs/decisions/hosting-walking-skeleton.md`](../docs/decisions/hosting-walking-skeleton.md)
and its lexercon.com / dual-instance amendments. **Status: authored and
`plan`-proven; never applied.** See `INSTANCE.md` → Status.

## Layout

```
infra/
├── versions.tf         # provider pins + the GCS backend (bucket named, not created)
├── providers.tf
├── variables.tf        # gcp_project_id (TBD), gcp_region, cloudflare_* (all no
│                       # committed default — supplied at real-apply time)
├── locals.tf           # local.instances — the ONE map that differentiates ar/zh;
│                       # every module below is for_each'd over it
├── main.tf             # wires the four modules via for_each = local.instances
├── registry.tf         # the shared Artifact Registry repo (server + both sidecars)
├── anthropic-secret.tf # the SHARED Anthropic API key secret container (issue #11
│                       # PR2) — same key, both instances; container only, no value
├── wif.tf              # GitHub-OIDC / Workload Identity Federation, keyless CI deploy
├── outputs.tf
├── docker/
│   └── server.Dockerfile   # the ONE shared server image (no per-language image)
├── cloudbuild.yaml         # authored only — never submitted by this PR
├── scripts/
│   ├── generate-secrets.sh # authored only — never run by this PR
│   └── build-and-push.sh   # authored only — never run by this PR (issue #11 PR2):
│                           # builds + pushes server/sidecar-ar/sidecar-zh
└── modules/
    ├── cloud-run-service/  # multicontainer: server + this instance's sidecar
    ├── frontend-pages/     # ONE Cloudflare Pages project, two custom domains
    ├── dns-domain/         # per-instance proxied CNAME + Cloud Run domain mapping
    └── access-gate/        # per-instance rate-limit ruleset + Secret Manager container
```

## Validating without touching real cloud state

`terraform validate` doesn't need the committed `backend "gcs"` bucket to
exist — `terraform init -backend=false` skips backend initialization
entirely and is sufficient for `fmt`/`validate`.

`terraform plan` normally *does* need a backend to read/write state from, even
against an empty/nonexistent remote state. Since the `language-agent-tfstate`
GCS bucket doesn't exist yet (created out-of-band before the real apply,
exactly like `violin-scales/infra/backend.tf` documents for its own bucket),
a `plan` dry-run needs a scratch backend instead:

```sh
cd infra
terraform init -backend=false
terraform validate

# For a plannable dry-run only (never for the real apply): shadow the GCS
# backend with an uncommitted local one.
cat > override.tf <<'EOF'
terraform {
  backend "local" {}
}
EOF
terraform init -reconfigure
terraform plan \
  -var="gcp_project_id=language-agent-dryrun" \
  -var="cloudflare_account_id=dryrunaccountid00000000000000000" \
  -var="cloudflare_zone_id=dryrunzoneid000000000000000000000" \
  -var="cloudflare_api_token=dryrunA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7s8" \
  -target=module.access_gate -target=module.cloud_run_service \
  -target=module.dns_domain -target=module.frontend_pages \
  -target=google_secret_manager_secret.anthropic_api_key \
  -target=google_artifact_registry_repository.images

rm override.tf   # never commit this — the tracked tree always shows the
                  # real GCS backend
terraform init -reconfigure -backend=false   # back to a clean validate-only state
```

The `cloudflare_api_token` dummy value must satisfy the provider's own
client-side format check (`a-z`, `A-Z`, `0-9`, `-`, `_` — a too-short or
oddly-shaped string is rejected before any network call). The `-target`
flags scope the dry-run around `wif.tf`'s `data "google_project" "this"`
(and the one resource that consumes its output,
`google_service_account_iam_member.deploy_wif`) — that data source does a
LIVE read against the real Google Cloud Resource Manager API to resolve a
project NUMBER from the project id, which a placeholder `-var` project id
cannot satisfy without actually touching real GCP. Everything else in this
tree (all four `for_each`-instantiated modules, the registry, the shared
Anthropic secret) plans cleanly offline. `override.tf`, `*.tfstate*`,
`.terraform/`, and any `*.tfvars` are `.gitignore`d — none of this dry-run
scaffolding is committed.

## What's real vs. placeholder right now

- `var.gcp_project_id` has **no committed default** — no GCP project exists
  for language-agent yet. The dry-run above supplies a placeholder id via
  `-var`; a real `plan`/`apply` needs the real project id once one exists.
- `var.cloudflare_*` are all placeholder-only for the same reason — the
  Cloudflare API token is a keys-checkpoint dependency.
- The `anthropic-api-key` Secret Manager secret (`anthropic-secret.tf`,
  issue #11 PR2) is a **container only** — no `google_secret_manager_secret_version`
  with a real value exists anywhere in this tree. The value is added
  out-of-band at apply time (see "Never run from this repo state" below).
- The GCS state bucket (`language-agent-tfstate`) and the WIF pool's
  first-use bootstrap are **not created by this tree** — they're the
  one-time out-of-band setup step before the first real `terraform init`
  against the real backend, per the sibling repos' own bootstrap pattern.

## Never run from this repo state

`terraform apply`; `gcloud secrets versions add` (via
`scripts/generate-secrets.sh` for the two per-instance `SHARED_SECRET`s, or
directly for the shared `anthropic-api-key` — see `AGENTS.md` → "Working in
the tree" → deploy runbook for the exact command); `gcloud builds submit` /
`docker push` (via `cloudbuild.yaml` / `docker/server.Dockerfile`, or
`scripts/build-and-push.sh`, issue #11 PR2, for all three images) — every
one of these is authored and validated, never executed, until the
operator-confirmed real deploy at the keys checkpoint.
