from rest_framework import generics
from rest_framework.permissions import AllowAny

from .models import Category
from .serializers import CategorySerializer


class CategoryListView(generics.ListAPIView):
    """Liste publique des catégories sans pagination."""

    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    pagination_class = None