# apps/catalogo/views.py
from rest_framework.viewsets import ReadOnlyModelViewSet

from .models import ComponenteVisual, EstructuraCFE, Material, Modulo, SlotAnclaje
from .serializers import (
    ComponenteVisualSerializer,
    EstructuraCFESerializer,
    MaterialSerializer,
    ModuloSerializer,
    SlotAnclajeSerializer,
)


class EstructuraCFEViewSet(ReadOnlyModelViewSet):
    queryset = EstructuraCFE.objects.prefetch_related("materiales__material")
    serializer_class = EstructuraCFESerializer


class MaterialViewSet(ReadOnlyModelViewSet):
    queryset = Material.objects.all()
    serializer_class = MaterialSerializer


class ModuloViewSet(ReadOnlyModelViewSet):
    queryset = Modulo.objects.prefetch_related("materiales__material")
    serializer_class = ModuloSerializer


class ComponenteVisualViewSet(ReadOnlyModelViewSet):
    queryset = ComponenteVisual.objects.filter(activo=True)
    serializer_class = ComponenteVisualSerializer


class SlotAnclajeViewSet(ReadOnlyModelViewSet):
    queryset = SlotAnclaje.objects.prefetch_related("componentes_compatibles")
    serializer_class = SlotAnclajeSerializer