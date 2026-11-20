variable "kubeconfig_path" {
  description = "Chemin vers le fichier kubeconfig local (Docker Desktop ou Minikube)"
  type        = string
  default     = "~/.kube/config"
}

variable "kube_context" {
  description = "Contexte Kubernetes cible (ex: docker-desktop ou minikube)"
  type        = string
  default     = "docker-desktop"
}

variable "namespace" {
  description = "Namespace Kubernetes dédié au provisionnement Terraform IaC de ServiceHome"
  type        = string
  default     = "servicehome-iac"
}

variable "backend_replicas" {
  description = "Nombre initial de pods Backend Django/Daphne"
  type        = number
  default     = 2
}

variable "frontend_replicas" {
  description = "Nombre initial de pods Frontend Angular"
  type        = number
  default     = 2
}

variable "db_password" {
  description = "Mot de passe PostgreSQL/PostGIS"
  type        = string
  default     = "servicehome"
  sensitive   = true
}
