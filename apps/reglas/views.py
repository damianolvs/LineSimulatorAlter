# apps/reglas/views.py
from django.db import transaction
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ReadOnlyModelViewSet

from .models import EstructuraMT, PrefijoEstructuraMT, ReglaEmpotramiento, ReglaPosicionMaterial
from .serializers import EstructuraMTSerializer, PrefijoEstructuraMTSerializer, RevisionEstructuraSerializer


class EstructuraMTViewSet(ReadOnlyModelViewSet):
    """Catálogo de estructuras de media tensión. Lectura; la edición y validación pasan por `revision`."""
    queryset = EstructuraMT.objects.select_related("prefijo", "fuente").prefetch_related(
        "materiales__material", "materiales__fuente"
    )
    serializer_class = EstructuraMTSerializer

    @action(detail=True, methods=["post"])
    def revision(self, request, pk=None):
        """
        Revisión técnica de una estructura en una sola operación atómica: aplica los datos generales y la lista
        completa de materiales (los que ya no vienen se eliminan). Con `validar` la marca como verificada junto con
        todas sus reglas; sin él, cualquier cambio la devuelve a "por verificar".
        """
        estructura = self.get_object()
        entrada = RevisionEstructuraSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data

        with transaction.atomic():
            for campo in ("nombre", "categoria", "angulo_min", "angulo_max", "es_terminal", "descripcion"):
                setattr(estructura, campo, datos[campo])

            existentes = {r.id: r for r in estructura.materiales.select_for_update()}
            conservar = set()
            for linea in datos["materiales"]:
                valores = {
                    "material": linea["material"],
                    "descripcion": linea.get("descripcion", ""),
                    "cantidad": linea["cantidad"],
                    "condicion": linea.get("condicion", ""),
                    "cantidad_estimada": linea["cantidad_estimada"],
                }
                regla = existentes.get(linea.get("id"))
                if linea.get("id") is not None and regla is None:
                    raise ValidationError({"materiales": f"La regla {linea['id']} no pertenece a esta estructura."})
                if regla is None:
                    regla = ReglaPosicionMaterial(tipo_estructura=estructura, fuente=estructura.fuente)
                for campo, valor in valores.items():
                    setattr(regla, campo, valor)
                regla.verificado = datos["validar"]
                regla.save()
                conservar.add(regla.id)
            estructura.materiales.exclude(id__in=conservar).delete()

            estructura.verificado = datos["validar"]
            estructura.save()

        estructura = self.get_queryset().get(pk=estructura.pk)
        return Response(self.get_serializer(estructura).data)


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
