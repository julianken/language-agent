output "shared_secret_id" {
  value       = google_secret_manager_secret.shared_secret.secret_id
  description = "Consumed by the cloud-run-service module's server container env (value_source.secret_key_ref) and by infra/scripts/generate-secrets.sh."
}

# The edge rate-limit ruleset moved to the root-level ../rate-limit.tf (one
# consolidated zone ruleset with a rule per instance — Cloudflare allows only
# one http_ratelimit ruleset per zone). No per-instance ruleset output.
