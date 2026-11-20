output "kubernetes_namespace" {
  description = "Namespace Kubernetes provisionné par Terraform"
  value       = kubernetes_namespace.servicehome.metadata[0].name
}

output "helm_release_status" {
  description = "Statut du déploiement Helm ServiceHome"
  value       = helm_release.servicehome_app.status
}

output "service_endpoints" {
  description = "URLs locales d'accès aux services (NodePort)"
  value = {
    frontend_angular   = "http://localhost:30200"
    backend_django_api = "http://localhost:30800/api/docs/"
    prometheus_metrics = "http://localhost:30800/metrics"
    prometheus_ui      = "http://localhost:30090"
    grafana_dashboard  = "http://localhost:30300 (admin / admin)"
  }
}
