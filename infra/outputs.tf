output "frontend_urls" {
  value = { for key, inst in local.instances : key => "https://${inst.frontend_domain}" }
}

output "api_urls" {
  value = { for key, inst in local.instances : key => "https://${inst.api_domain}" }
}

output "cloud_run_service_names" {
  value = { for key, mod in module.cloud_run_service : key => mod.service_name }
}

output "shared_secret_ids" {
  value = { for key, mod in module.access_gate : key => mod.shared_secret_id }
}

output "deploy_service_account_email" {
  value = google_service_account.deploy.email
}
