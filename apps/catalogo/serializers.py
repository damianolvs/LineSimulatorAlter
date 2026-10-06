# apps/catalogo/serializers.py
from rest_framework import serializers

from apps.reglas.serializers import EstructuraMTResumenSerializer

from .models import (
    Conductor,
    ComponenteVisual,
    EstructuraCFE,
    EstructuraCFEMaterial,
    Material,
    Modulo,
    ModuloMaterial,
    SlotAnclaje,
)


class MaterialSerializer(serializers.ModelSerializer):
    componente_visual_codigo = serializers.CharField(source="componente_visual.codigo", read_only=True, default=None)

    class Meta:
        model = Material
        fields = ["id", "codigo", "nombre", "unidad", "cantidad_estimada", "componente_visual_codigo"]


class EstructuraCFEMaterialSerializer(serializers.ModelSerializer):
    material = MaterialSerializer(read_only=True)

    class Meta:
        model = EstructuraCFEMaterial
        fields = ["id", "material", "cantidad"]


class EstructuraCFESerializer(serializers.ModelSerializer):
    materiales = EstructuraCFEMaterialSerializer(many=True, read_only=True)
    estructura_mt = EstructuraMTResumenSerializer(read_only=True)

    class Meta:
        model = EstructuraCFE
        fields = ["id", "codigo", "nombre", "descripcion", "es_paso_estandar", "estructura_mt", "materiales"]


class ModuloMaterialSerializer(serializers.ModelSerializer):
    material = MaterialSerializer(read_only=True)

    class Meta:
        model = ModuloMaterial
        fields = ["id", "material", "cantidad"]


class ModuloSerializer(serializers.ModelSerializer):
    materiales = ModuloMaterialSerializer(many=True, read_only=True)

    class Meta:
        model = Modulo
        fields = ["id", "codigo", "nombre", "descripcion", "materiales"]


class ComponenteVisualSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComponenteVisual
        fields = ["id", "codigo", "nombre", "descripcion", "ancho_px", "alto_px", "z_index", "activo"]


class SlotAnclajeSerializer(serializers.ModelSerializer):
    componentes_compatibles = ComponenteVisualSerializer(many=True, read_only=True)

    class Meta:
        model = SlotAnclaje
        fields = ["id", "codigo", "nombre", "x_local", "y_local", "componentes_compatibles"]


class ConductorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Conductor
        fields = [
            "id", "codigo", "nombre", "material", "calibre", "formacion", "seccion_mm2", "diametro_mm",
            "peso_kg_m", "carga_ruptura_kg", "modulo_elasticidad_kg_mm2", "coef_dilatacion_c", "verificado",
        ]

