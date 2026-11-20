# 1. Création du Namespace Kubernetes via Terraform
resource "kubernetes_namespace" "servicehome" {
  metadata {
    name = var.namespace
    labels = {
      "app.kubernetes.io/managed-by" = "terraform"
      "app.kubernetes.io/part-of"    = "servicehome-platform"
    }
  }
}

# 2. Provisionnement du ConfigMap applicatif
resource "kubernetes_config_map" "servicehome_config" {
  metadata {
    name      = "servicehome-config"
    namespace = kubernetes_namespace.servicehome.metadata[0].name
  }

  data = {
    DJANGO_DEBUG         = "0"
    DJANGO_ALLOWED_HOSTS = "localhost,127.0.0.1,backend,servicehome.local,*"
    DB_NAME              = "servicehome"
    DB_USER              = "servicehome"
    DB_HOST              = "postgres-postgis"
    DB_PORT              = "5432"
    REDIS_URL            = "redis://redis:6379/0"
  }
}

# 3. Provisionnement du Secret Kubernetes (DB & JWT)
resource "kubernetes_secret" "servicehome_secret" {
  metadata {
    name      = "servicehome-secret"
    namespace = kubernetes_namespace.servicehome.metadata[0].name
  }

  data = {
    DJANGO_SECRET_KEY = "tf-k8s-servicehome-secret-key-2026"
    DB_PASSWORD       = var.db_password
  }

  type = "Opaque"
}

# 4. Déploiement du Chart Helm ServiceHome via le provider Helm de Terraform
resource "helm_release" "servicehome_app" {
  name       = "servicehome-tf"
  namespace  = kubernetes_namespace.servicehome.metadata[0].name
  chart      = "${path.module}/../helm/servicehome"
  wait       = false
  depends_on = [kubernetes_config_map.servicehome_config, kubernetes_secret.servicehome_secret]

  set {
    name  = "namespace"
    value = var.namespace
  }

  set {
    name  = "backend.replicaCount"
    value = tostring(var.backend_replicas)
  }

  set {
    name  = "frontend.replicaCount"
    value = tostring(var.frontend_replicas)
  }

  set {
    name  = "backend.service.nodePort"
    value = "30802"
  }

  set {
    name  = "frontend.service.nodePort"
    value = "30202"
  }
}
