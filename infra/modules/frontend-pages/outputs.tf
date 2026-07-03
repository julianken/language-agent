output "pages_default_domain" {
  value       = cloudflare_pages_project.frontend.subdomain
  description = "The internal language-agent.pages.dev-style default (INSTANCE.md's standing target); the custom domains above are what's actually public."
}

output "custom_domains" {
  value = { for key, inst in var.instances : key => inst.frontend_domain }
}
