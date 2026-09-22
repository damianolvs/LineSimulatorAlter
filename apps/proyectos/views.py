# apps/proyectos/views.py
from django.db.models import Count
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from .models import Poste, PosteComponente, PosteModulo, Proyecto, Tramo, Vano
from .serializers import (
    PosteComponenteSerializer,
    PosteModuloSerializer,
    PosteSerializer,
    PostesPorCoordenadasSerializer,
    ProyectoSerializer,
    TramoSerializer,
    VanoSerializer,
)
from apps.catalogo.models import EstructuraCFE
from apps.reglas.services import desglose_estructura

from .services import (
    agregar_postes_por_coordenadas,
    generar_postes_de_paso,
    calcular_materiales_proyecto,
    generar_vanos,
    resolver_layout_poste,
    sincronizar_geom_tramo,
)


class ProyectoViewSet(ModelViewSet):
    queryset = Proyecto.objects.annotate(num_postes=Count("tramos__postes", distinct=True)).prefetch_related("tramos")
    serializer_class = ProyectoSerializer

    @action(detail=True, methods=["get"])
    def materiales(self, request, pk=None):
        """Lista de materiales del proyecto según las reglas normativas de cada estructura."""
        return Response(calcular_materiales_proyecto(self.get_object()))


class TramoViewSet(ModelViewSet):
    serializer_class = TramoSerializer

    def get_queryset(self):
        qs = Tramo.objects.all()
        proyecto_id = self.request.query_params.get("proyecto")
        if proyecto_id:
            qs = qs.filter(proyecto_id=proyecto_id)
        return qs

    @action(detail=True, methods=["post"], url_path="generar-postes-de-paso")
    def generar_postes_de_paso_action(self, request, pk=None):
        tramo = self.get_object()
        estructura = None
        estructura_id = request.data.get("estructura_id")
        if estructura_id:
            estructura = EstructuraCFE.objects.filter(pk=estructura_id).first()
            if estructura is None:
                return Response({"detail": "La estructura indicada no existe."}, status=400)
        try:
            postes = generar_postes_de_paso(tramo, estructura)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        # Solo un resumen: serializar todos los postes (con sus ángulos) es lento y el cliente los pide aparte.
        return Response({"total": len(postes), "pasos": sum(1 for p in postes if not p.es_ancla)})

    @action(detail=True, methods=["post"], url_path="agregar-postes")
    def agregar_postes_action(self, request, pk=None):
        """Agrega postes ancla por coordenadas [lng, lat], a continuación de los existentes."""
        tramo = self.get_object()
        datos = PostesPorCoordenadasSerializer(data=request.data)
        datos.is_valid(raise_exception=True)
        postes = agregar_postes_por_coordenadas(tramo, **datos.validated_data)
        return Response({"creados": len(postes), "ids": [p.id for p in postes]}, status=201)

    @action(detail=True, methods=["post"], url_path="generar-vanos")
    def generar_vanos_action(self, request, pk=None):
        tramo = self.get_object()
        vanos = generar_vanos(tramo)
        return Response(VanoSerializer(vanos, many=True).data)


class PosteViewSet(ModelViewSet):
    serializer_class = PosteSerializer

    def get_queryset(self):
        qs = Poste.objects.select_related("estructura__estructura_mt__prefijo").prefetch_related(
            "modulos__modulo", "componentes__componente_visual"
        )
        tramo_id = self.request.query_params.get("tramo")
        if tramo_id:
            qs = qs.filter(tramo_id=tramo_id)
        return qs

    def perform_create(self, serializer):
        poste = serializer.save()
        resolver_layout_poste(poste)
        sincronizar_geom_tramo(poste.tramo)

    def perform_update(self, serializer):
        estructura_anterior = serializer.instance.estructura_id
        posicion_anterior = serializer.instance.geom.coords
        nueva = serializer.validated_data.get("geom")
        # Fijar a mano la posición de un poste de paso lo vuelve ancla: así sobrevive a regenerar los de paso.
        movido = nueva is not None and any(abs(a - b) > 1e-9 for a, b in zip(nueva.coords, posicion_anterior))
        poste = serializer.save(es_ancla=True) if movido else serializer.save()
        if poste.estructura_id != estructura_anterior:
            resolver_layout_poste(poste)
        sincronizar_geom_tramo(poste.tramo)

    def perform_destroy(self, instance):
        tramo = instance.tramo
        instance.delete()
        sincronizar_geom_tramo(tramo)

    @action(detail=True, methods=["get"])
    def desglose(self, request, pk=None):
        """Empotramiento y materiales de la estructura del poste, con altura real sobre piso y fuente normativa."""
        poste = self.get_object()
        estructura_mt = poste.estructura.estructura_mt
        if estructura_mt is None:
            return Response({"detail": "Esta estructura aún no tiene reglas normativas digitalizadas."}, status=404)
        try:
            return Response(desglose_estructura(estructura_mt, poste.altura_m, poste.tipo_terreno, poste.resistencia_kg))
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)

    @action(detail=True, methods=["post"], url_path="resolver-layout")
    def resolver_layout_action(self, request, pk=None):
        poste = self.get_object()
        componentes = resolver_layout_poste(poste)
        return Response(PosteComponenteSerializer(componentes, many=True).data)


class VanoViewSet(ReadOnlyModelViewSet):
    """Solo lectura: los vanos se generan vía generar_vanos(), no se crean a mano."""
    queryset = Vano.objects.select_related("poste_inicio", "poste_fin")
    serializer_class = VanoSerializer


class PosteModuloViewSet(ModelViewSet):
    serializer_class = PosteModuloSerializer

    def get_queryset(self):
        return PosteModulo.objects.filter(poste_id=self.kwargs["poste_pk"])

    def perform_create(self, serializer):
        serializer.save(poste_id=self.kwargs["poste_pk"])


class PosteComponenteViewSet(ModelViewSet):
    serializer_class = PosteComponenteSerializer

    def get_queryset(self):
        return PosteComponente.objects.filter(poste_id=self.kwargs["poste_pk"])

    def perform_create(self, serializer):
        serializer.save(poste_id=self.kwargs["poste_pk"], modo=PosteComponente.Modo.MANUAL)

    def perform_update(self, serializer):
        serializer.save(modo=PosteComponente.Modo.MANUAL)