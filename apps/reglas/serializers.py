# apps/reglas/serializers.py
from rest_framework import serializers

from .models import EstructuraMT, PrefijoEstructuraMT, ReglaPosicionMaterial


class ReglaPosicionMaterialResumenSerializer(serializers.ModelSerializer):
    """Vista resumida de un material de la estructura, para el catálogo (sin las cotas de posición)."""
    material_nombre = serializers.SerializerMethodField()

    class Meta:
        model = ReglaPosicionMaterial
        fields = ["material_nombre", "cantidad", "condicion", "cantidad_estimada", "verificado"]

    def get_material_nombre(self, obj):
        return obj.material.nombre if obj.material else obj.descripcion


class EstructuraMTSerializer(serializers.ModelSerializer):
    """Catálogo de estructuras de media tensión — reemplaza a catalogo.TipoEstructura."""
    prefijo_codigo = serializers.ReadOnlyField(source="prefijo.codigo")
    materiales = ReglaPosicionMaterialResumenSerializer(many=True, read_only=True)

    class Meta:
        model = EstructuraMT
        fields = [
            "id", "codigo", "nombre", "prefijo_codigo", "categoria", "angulo_min", "angulo_max",
            "es_terminal", "descripcion", "verificado", "materiales",
        ]


class PrefijoEstructuraMTSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrefijoEstructuraMT
        fields = ["id", "codigo", "nombre"]


class EstructuraMTResumenSerializer(serializers.ModelSerializer):
    """Datos normativos mínimos de una estructura, para anidar en el catálogo de estructuras CFE."""
    prefijo_codigo = serializers.ReadOnlyField(source="prefijo.codigo")

    class Meta:
        model = EstructuraMT
        fields = ["codigo", "prefijo_codigo", "categoria", "angulo_min", "angulo_max", "es_terminal", "verificado"]
