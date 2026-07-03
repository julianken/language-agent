# See modules/cloud-run-service/versions.tf for why this is required per
# child module.
terraform {
  required_providers {
    cloudflare = {
      source = "cloudflare/cloudflare"
    }
  }
}
