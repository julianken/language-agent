output "shared_secret_id" {
  value       = google_secret_manager_secret.shared_secret.secret_id
  description = "Consumed by the cloud-run-service module's server container env (value_source.secret_key_ref) and by infra/scripts/generate-secrets.sh."
}

output "ruleset_id" {
  value = cloudflare_ruleset.api_rate_limit.id
}
