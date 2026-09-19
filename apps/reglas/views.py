# apps/reglas/views.py
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ReadOnlyModelViewSet

from .models import EstructuraMT, PrefijoEstructuraMT, ReglaEmpotramiento
from .serializers import EstructuraMTSerializer, PrefijoEstructuraMTSerializer


class EstructuraMTViewSet(ReadOnlyModelViewSet):
    """Catálogo de estructuras de media tensión. Solo lectura: se administra desde /admin/."""
    queryset = EstructuraMT.objects.select_related("prefijo").prefetch_related("materiales__material").all()
    serializer_class = EstructuraMTSerializer


class PrefijoEstructuraMTViewSet(ReadOnlyModelViewSet):
    """Familias de estructuras (T, P, R, A, D, V, C, H)."""
    queryset = PrefijoEstructuraMT.objects.all()
    serializer_class = PrefijoEstructuraMTSerializer


class OpcionesPosteView(APIView):
    """
    Combinaciones de poste que la norma contempla (sección 03 00 02): alturas con su
    resistencia y los terrenos disponibles, para poblar el formulario de poste.
    """

    def get(self, request):
        alturas: dict[float, set[int]] = {}
        for altura, resistencia in ReglaEmpotramiento.objects.values_list("altura_poste_m", "resistencia_kg"):
            alturas.setdefault(altura, set()).add(resistencia)
        return Response({
            "alturas": [
                {"altura_m": altura, "resistencias_kg": sorted(resistencias)}
                for altura, resistencias in sorted(alturas.items())
            ],
            "terrenos": [{"codigo": c, "nombre": n} for c, n in ReglaEmpotramiento.TERRENO_CHOICES],
        })
