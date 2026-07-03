output "frontend_urls" {
  description = "Path-routed under the apex router (language-router-gateway plan, Task 8) — no per-instance subdomain anymore. Both resolve through the same cloudflare_worker_route/cloudflare_worker_script in worker.tf."
  value       = { for key, inst in local.instances : key => "https://lexercon.com${inst.base_path}" }
}

# api_urls (the old direct https://api.lexercon.com / https://zh-api.lexercon.com
# per-instance API subdomains) is DROPPED, not repointed: there is no
# longer a public API origin distinct from the frontend one — the Worker
# proxies BOTH under the same lexercon.com host at <base_path>/api/*
# (e.g. https://lexercon.com/ar/api/*), which frontend_urls above already
# expresses. A caller that needs the raw backend origin (rare — direct
# run.app access is meant to be reachable only via the Worker's
# shared-secret header) should read cloud_run_service_names below and
# resolve module.cloud_run_service[<key>].service_uri directly.

output "cloud_run_service_names" {
  value = { for key, mod in module.cloud_run_service : key => mod.service_name }
}

output "shared_secret_ids" {
  value = { for key, mod in module.access_gate : key => mod.shared_secret_id }
}

output "anthropic_secret_id" {
  value       = google_secret_manager_secret.anthropic_api_key.secret_id
  description = "The shared Secret Manager secret_id (both instances read the SAME key) — pass to `gcloud secrets versions add <this> --data-file=-` out-of-band at apply time."
}

output "deploy_service_account_email" {
  value = google_service_account.deploy.email
}
