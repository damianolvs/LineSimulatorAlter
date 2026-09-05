# apps/catalogo/serializers.py
from rest_framework import serializers

from .models import (
    ComponenteVisual,
    EstructuraCFE,
    EstructuraCFEMaterial,
    Material,
    Modulo,
    ModuloMaterial,
    SlotAnclaje,
)


class MaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Material
        fields = ["id", "codigo", "nombre", "unidad", "cantidad_estimada"]


class EstructuraCFEMaterialSerializer(serializers.ModelSerializer):
    material = MaterialSerializer(read_only=True)

    class Meta:
        model = EstructuraCFEMaterial
        fields = ["id", "material", "cantidad"]


class EstructuraCFESerializer(serializers.ModelSerializer):
    materiales = EstructuraCFEMaterialSerializer(many=True, read_only=True)

    class Meta:
        model = EstructuraCFE
        fields = ["id", "codigo", "nombre", "descripcion", "materiales"]


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