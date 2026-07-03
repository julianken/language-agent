# infra/ — deploy IaC (issue #11)

One Terraform tree spanning the `google` + `cloudflare` providers, per
[`docs/decisions/hosting-walking-skeleton.md`](../docs/decisions/hosting-walking-skeleton.md)
and its lexercon.com / dual-instance amendments. **Status: authored and
`plan`-proven; never applied.** See `INSTANCE.md` → Status.

## Layout

```
infra/
├── versions.tf   # provider pins + the GCS backend (bucket named, not created)
├── providers.tf
├── variables.tf  # gcp_project_id (TBD), gcp_region, cloudflare_* (all no
│                 # committed default — supplied at real-apply time)
├── locals.tf     # local.instances — the ONE map that differentiates ar/zh;
│                 # every module below is for_each'd over it
├── main.tf       # wires the four modules via for_each = local.instances
├── registry.tf   # the shared Artifact Registry repo (server + both sidecars)
├── wif.tf        # GitHub-OIDC / Workload Identity Federation, keyless CI deploy
├── outputs.tf
├── docker/
│   └── server.Dockerfile   # the ONE shared server image (no per-language image)
├── cloudbuild.yaml         # authored only — never submitted by this PR
├── scripts/
│   └── generate-secrets.sh # authored only — never run by this PR
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
  -var="cloudflare_account_id=dryrun-account-id" \
  -var="cloudflare_zone_id=dryrun-zone-id" \
  -var="cloudflare_api_token=dryrun-token-not-real"

rm override.tf   # never commit this — the tracked tree always shows the
                  # real GCS backend
terraform init -reconfigure -backend=false   # back to a clean validate-only state
```

`override.tf`, `*.tfstate*`, `.terraform/`, and any `*.tfvars` are
`.gitignore`d — none of this dry-run scaffolding is committed.

## What's real vs. placeholder right now

- `var.gcp_project_id` has **no committed default** — no GCP project exists
  for language-agent yet. The dry-run above supplies a placeholder id via
  `-var`; a real `plan`/`apply` needs the real project id once one exists.
- `var.cloudflare_*` are all placeholder-only for the same reason — the
  Cloudflare API token is a PR2 (keys-checkpoint) dependency.
- The GCS state bucket (`language-agent-tfstate`) and the WIF pool's
  first-use bootstrap are **not created by this tree** — they're the
  one-time out-of-band setup step before the first real `terraform init`
  against the real backend, per the sibling repos' own bootstrap pattern.

## Never run from this repo state

`terraform apply`, `gcloud secrets versions add` (via `scripts/generate-secrets.sh`),
`gcloud builds submit` / `docker push` (via `cloudbuild.yaml` /
`docker/server.Dockerfile`) — all three are authored and validated, never
executed, until the operator-confirmed real deploy at the keys checkpoint
(issue #11 PR2).
