variable "instance_key" {
  type        = string
  description = "The one instance-differentiating value (\"ar\" or \"zh\") — drives the resource/SA naming, the LANGUAGE env var, and (via the caller) the sidecar image. Nothing else in this module branches on it."
}

variable "location" {
  type        = string
  description = "GCP region for the Cloud Run service."
}

variable "gcp_project_id" {
  type        = string
  description = "GCP project id (for IAM member strings and secret references)."
}

variable "server_image" {
  type        = string
  description = "The ONE server image shared by both instances — no per-language server image exists (the registry's lazy import means the unselected pack never loads either way)."
}

variable "sidecar_image" {
  type        = string
  description = "This instance's verification sidecar image (src/sidecars/ar or src/sidecars/zh). The single per-instance driver of which language's sidecar runs."
}

variable "server_port" {
  type        = number
  description = "Server container's HTTP port (the ingress container)."
  default     = 8080
}

variable "sidecar_port" {
  type        = number
  description = "Sidecar container's HTTP port (localhost-only — never an ingress port)."
  default     = 8081
}

variable "sidecar_memory" {
  type        = string
  description = "Sidecar container memory. 1Gi per the hosting ADR (measured RSS ~400MB ar / ~143MiB zh; 1Gi covers both with headroom since 512Mi is too tight once the HTTP layer sits on top)."
  default     = "1Gi"
}

variable "readyz_period_seconds" {
  type        = number
  description = "Sidecar startup_probe period_seconds — sized per-instance from that sidecar's documented /readyz warmup (see infra/locals.tf)."
}

variable "readyz_failure_threshold" {
  type        = number
  description = "Sidecar startup_probe failure_threshold — paired with readyz_period_seconds so failure_threshold * period_seconds comfortably covers the documented warmup."
}

variable "shared_secret_id" {
  type        = string
  description = "Secret Manager secret_id (short id, not full resource name) holding this instance's server-side shared secret for the access gate. Distinct per instance — never reused across ar/zh."
}

variable "min_instance_count" {
  type        = number
  description = "Cloud Run min instance count. 0 per the hosting ADR (scale-to-zero is a hard constraint)."
  default     = 0
}

variable "max_instance_count" {
  type        = number
  description = "Cloud Run max instance count for the walking skeleton."
  default     = 3
}
