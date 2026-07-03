# Child modules don't inherit the root's provider SOURCE address
# automatically (only provider configuration does) — each module using a
# provider must declare it here, confirmed by a real `terraform init`
# failure this PR's validation loop hit and fixed (registry.terraform.io
# defaults an undeclared "google" local name to the legacy hashicorp/google
# implied source, which happens to resolve, but cloudflare's did not).
terraform {
  required_providers {
    google = {
      source = "hashicorp/google"
    }
  }
}
