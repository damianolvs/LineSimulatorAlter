# apps/proyectos/serializers.py
from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer

from apps.catalogo.models import ComponenteVisual, EstructuraCFE, Modulo, SlotAnclaje
from apps.catalogo.serializers import ComponenteVisualSerializer, EstructuraCFESerializer, ModuloSerializer

from .models import Poste, PosteComponente, PosteModulo, Proyecto, Tramo, Vano


class ProyectoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Proyecto
        fields = ["id", "nombre", "ubicacion", "descripcion", "creado_en"]
        read_only_fields = ["creado_en"]


class TramoSerializer(GeoFeatureModelSerializer):
    class Meta:
        model = Tramo
        geo_field = "geom"
        fields = ["id", "proyecto", "nombre", "vano_maximo"]


class PosteModuloSerializer(serializers.ModelSerializer):
    modulo = ModuloSerializer(read_only=True)
    modulo_id = serializers.PrimaryKeyRelatedField(
        queryset=Modulo.objects.all(), source="modulo", write_only=True
    )

    class Meta:
        model = PosteModulo
        fields = ["id", "modulo", "modulo_id", "cantidad"]


class PosteComponenteSerializer(serializers.ModelSerializer):
    componente_visual = ComponenteVisualSerializer(read_only=True)
    componente_visual_id = serializers.PrimaryKeyRelatedField(
        queryset=ComponenteVisual.objects.all(), source="componente_visual", write_only=True
    )
    slot_id = serializers.PrimaryKeyRelatedField(
        queryset=SlotAnclaje.objects.all(),
        source="slot",
        write_only=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = PosteComponente
        fields = [
            "id", "componente_visual", "componente_visual_id", "slot_id",
            "modo", "x", "y", "rotacion", "espejo", "orden_z", "actualizado_en",
        ]
        read_only_fields = ["modo", "actualizado_en"]


class PosteSerializer(GeoFeatureModelSerializer):
    estructura = EstructuraCFESerializer(read_only=True)
    estructura_id = serializers.PrimaryKeyRelatedField(
        queryset=EstructuraCFE.objects.all(), source="estructura", write_only=True
    )
    angulo_deflexion = serializers.SerializerMethodField()
    modulos = PosteModuloSerializer(many=True, read_only=True)
    componentes = PosteComponenteSerializer(many=True, read_only=True)

    class Meta:
        model = Poste
        geo_field = "geom"
        fields = [
            "id", "tramo", "estructura", "estructura_id", "orden", "es_ancla",
            "angulo_deflexion", "modulos", "componentes",
        ]

    def get_angulo_deflexion(self, obj):
        return obj.angulo_deflexion


class VanoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vano
        fields = ["id", "poste_inicio", "poste_fin", "distancia", "flecha"]