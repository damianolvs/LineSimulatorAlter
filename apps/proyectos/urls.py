# apps/proyectos/urls.py
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    PosteComponenteViewSet,
    PosteModuloViewSet,
    PosteViewSet,
    ProyectoViewSet,
    TramoViewSet,
    VanoViewSet,
)

router = DefaultRouter()
router.register("proyectos", ProyectoViewSet, basename="proyecto")
router.register("tramos", TramoViewSet, basename="tramo")
router.register("postes", PosteViewSet, basename="poste")
router.register("vanos", VanoViewSet, basename="vano")

urlpatterns = router.urls + [
    path(
        "postes/<int:poste_pk>/modulos/",
        PosteModuloViewSet.as_view({"get": "list", "post": "create"}),
        name="poste-modulos-list",
    ),
    path(
        "postes/<int:poste_pk>/modulos/<int:pk>/",
        PosteModuloViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="poste-modulos-detail",
    ),
    path(
        "postes/<int:poste_pk>/componentes/",
        PosteComponenteViewSet.as_view({"get": "list", "post": "create"}),
        name="poste-componentes-list",
    ),
    path(
        "postes/<int:poste_pk>/componentes/<int:pk>/",
        PosteComponenteViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="poste-componentes-detail",
    ),
]