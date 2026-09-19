# apps/reglas/urls.py
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import EstructuraMTViewSet, OpcionesPosteView, PrefijoEstructuraMTViewSet

router = DefaultRouter()
router.register("estructuras-mt", EstructuraMTViewSet, basename="estructura-mt")
router.register("prefijos-estructura", PrefijoEstructuraMTViewSet, basename="prefijo-estructura")

urlpatterns = [path("opciones-poste/", OpcionesPosteView.as_view(), name="opciones-poste")] + router.urls
