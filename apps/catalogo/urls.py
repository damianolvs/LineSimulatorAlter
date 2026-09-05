# apps/catalogo/urls.py
from rest_framework.routers import DefaultRouter

from .views import (
    ComponenteVisualViewSet,
    EstructuraCFEViewSet,
    MaterialViewSet,
    ModuloViewSet,
    SlotAnclajeViewSet,
)

router = DefaultRouter()
router.register("estructuras", EstructuraCFEViewSet, basename="estructura")
router.register("materiales", MaterialViewSet, basename="material")
router.register("modulos", ModuloViewSet, basename="modulo")
router.register("componentes-visuales", ComponenteVisualViewSet, basename="componente-visual")
router.register("slots-anclaje", SlotAnclajeViewSet, basename="slot-anclaje")

urlpatterns = router.urls