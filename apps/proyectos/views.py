# apps/proyectos/views.py
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from .models import Poste, PosteComponente, PosteModulo, Proyecto, Tramo, Vano
from .serializers import (
    PosteComponenteSerializer,
    PosteModuloSerializer,
    PosteSerializer,
    ProyectoSerializer,
    TramoSerializer,
    VanoSerializer,
)
from .services import generar_postes_de_paso, generar_vanos, resolver_layout_poste


class ProyectoViewSet(ModelViewSet):
    queryset = Proyecto.objects.all()
    serializer_class = ProyectoSerializer


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
        try:
            postes = generar_postes_de_paso(tramo)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        return Response(PosteSerializer(postes, many=True).data)

    @action(detail=True, methods=["post"], url_path="generar-vanos")
    def generar_vanos_action(self, request, pk=None):
        tramo = self.get_object()
        vanos = generar_vanos(tramo)
        return Response(VanoSerializer(vanos, many=True).data)


class PosteViewSet(ModelViewSet):
    serializer_class = PosteSerializer

    def get_queryset(self):
        qs = Poste.objects.select_related("estructura").prefetch_related(
            "modulos__modulo", "componentes__componente_visual"
        )
        tramo_id = self.request.query_params.get("tramo")
        if tramo_id:
            qs = qs.filter(tramo_id=tramo_id)
        return qs
    
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