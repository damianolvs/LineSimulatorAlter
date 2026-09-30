# apps/reglas/serializers.py
from rest_framework import serializers

from apps.catalogo.models import Material

from .models import EstructuraMT, PrefijoEstructuraMT, ReglaPosicionMaterial


class ReglaPosicionMaterialResumenSerializer(serializers.ModelSerializer):
    """Vista resumida de un material de la estructura, para el catálogo (sin las cotas de posición)."""
    material_nombre = serializers.SerializerMethodField()
    material_id = serializers.PrimaryKeyRelatedField(source="material", read_only=True)
    material_codigo = serializers.CharField(source="material.codigo", read_only=True, default="")
    fuente_codigo = serializers.CharField(source="fuente.codigo", read_only=True, default="")

    class Meta:
        model = ReglaPosicionMaterial
        fields = [
            "id", "material_id", "material_nombre", "material_codigo", "descripcion", "cantidad", "condicion",
            "cantidad_estimada", "verificado", "fuente_codigo",
        ]

    def get_material_nombre(self, obj):
        return obj.material.nombre if obj.material else obj.descripcion


class EstructuraMTSerializer(serializers.ModelSerializer):
    """Catálogo de estructuras de media tensión — reemplaza a catalogo.TipoEstructura."""
    prefijo_codigo = serializers.ReadOnlyField(source="prefijo.codigo")
    fuente_codigo = serializers.ReadOnlyField(source="fuente.codigo")
    fuente_titulo = serializers.ReadOnlyField(source="fuente.titulo")
    fuente_pagina = serializers.ReadOnlyField(source="fuente.pagina_inicio")
    materiales = ReglaPosicionMaterialResumenSerializer(many=True, read_only=True)

    class Meta:
        model = EstructuraMT
        fields = [
            "id", "codigo", "nombre", "prefijo_codigo", "categoria", "angulo_min", "angulo_max",
            "es_terminal", "descripcion", "verificado", "fuente_codigo", "fuente_titulo", "fuente_pagina",
            "materiales",
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



class ReglaRevisionSerializer(serializers.Serializer):
    """Una línea de material en la revisión: con `id` modifica la regla existente, sin `id` crea una nueva."""
    id = serializers.IntegerField(required=False)
    material = serializers.PrimaryKeyRelatedField(queryset=Material.objects.all())
    descripcion = serializers.CharField(required=False, allow_blank=True, max_length=200)
    cantidad = serializers.FloatField(min_value=0)
    condicion = serializers.CharField(required=False, allow_blank=True, max_length=200)
    cantidad_estimada = serializers.BooleanField(required=False, default=False)


class RevisionEstructuraSerializer(serializers.Serializer):
    """Cuerpo de la revisión técnica de una estructura: datos generales, lista completa de materiales y si se valida."""
    nombre = serializers.CharField(max_length=150, allow_blank=True)
    categoria = serializers.ChoiceField(choices=EstructuraMT.CATEGORIA_CHOICES, allow_blank=True)
    angulo_min = serializers.FloatField(allow_null=True)
    angulo_max = serializers.FloatField(allow_null=True)
    es_terminal = serializers.BooleanField()
    descripcion = serializers.CharField(allow_blank=True)
    materiales = ReglaRevisionSerializer(many=True)
    validar = serializers.BooleanField(default=False)

    def validate(self, datos):
        minimo, maximo = datos["angulo_min"], datos["angulo_max"]
        if minimo is not None and maximo is not None and minimo > maximo:
            raise serializers.ValidationError({"angulo_min": "El ángulo mínimo no puede ser mayor que el máximo."})
        materiales = datos["materiales"]
        repetidos = [m["material"].nombre for i, m in enumerate(materiales)
                     if any(o["material"] == m["material"] and o.get("descripcion", "") == m.get("descripcion", "")
                            for o in materiales[:i])]
        if repetidos:
            raise serializers.ValidationError({"materiales": f"Material repetido: {repetidos[0]}."})
        if datos["validar"] and not materiales:
            raise serializers.ValidationError(
                {"materiales": "No se puede validar una estructura sin materiales."}
            )
        return datos
