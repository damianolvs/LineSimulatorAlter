# apps/proyectos/serializers.py
from django.db import transaction
from django.db.models import Max
from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer

from apps.catalogo.models import ComponenteVisual, EstructuraCFE, Modulo, SlotAnclaje
from apps.catalogo.serializers import ComponenteVisualSerializer, EstructuraCFESerializer, ModuloSerializer

from apps.reglas.services import profundidad_empotramiento

from .services import longitud_proyecto_m
from .models import Poste, PosteComponente, PosteModulo, Proyecto, Tramo, Vano


class ProyectoSerializer(serializers.ModelSerializer):
    """
    Al crear un proyecto se crea también su primer tramo, con el `vano_maximo`
    indicado (por defecto el estándar CFE del modelo Tramo).
    """
    vano_maximo = serializers.FloatField(write_only=True, required=False, min_value=1)
    tramo_ids = serializers.PrimaryKeyRelatedField(source="tramos", many=True, read_only=True)
    num_postes = serializers.SerializerMethodField()
    longitud_m = serializers.SerializerMethodField()

    class Meta:
        model = Proyecto
        fields = [
            "id", "nombre", "ubicacion", "descripcion", "estado", "tension_kv", "creado_en", "actualizado_en",
            "vano_maximo", "tramo_ids", "num_postes", "longitud_m",
        ]
        read_only_fields = ["creado_en", "actualizado_en"]

    def get_longitud_m(self, obj):
        return longitud_proyecto_m(obj)

    def get_num_postes(self, obj):
        # `num_postes` viene anotado en el listado; se cuenta aparte solo al crear.
        anotado = getattr(obj, "num_postes", None)
        return anotado if anotado is not None else Poste.objects.filter(tramo__proyecto=obj).count()

    @transaction.atomic
    def create(self, validated_data):
        vano_maximo = validated_data.pop("vano_maximo", None)
        proyecto = super().create(validated_data)
        opciones = {"vano_maximo": vano_maximo} if vano_maximo else {}
        Tramo.objects.create(proyecto=proyecto, nombre="Tramo 1", **opciones)
        return proyecto


class TramoSerializer(GeoFeatureModelSerializer):
    class Meta:
        model = Tramo
        geo_field = "geom"
        id_field = False  # deja `id` dentro de `properties`, como lo lee el frontend
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
    componente_visual_codigo = serializers.SlugRelatedField(
        slug_field="codigo", source="componente_visual", read_only=True
    )
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

    regla_descripcion = serializers.CharField(source="regla_origen.descripcion", read_only=True, default="")
    material_codigo = serializers.CharField(source="regla_origen.material.codigo", read_only=True, default="")

    class Meta:
        model = PosteComponente
        fields = [
            "id", "componente_visual", "componente_visual_codigo", "componente_visual_id", "slot_id",
            "regla_origen", "regla_descripcion", "material_codigo", "indice", "modo", "x", "y", "rotacion", "espejo", "orden_z", "actualizado_en",
        ]
        read_only_fields = ["regla_origen", "indice", "modo", "actualizado_en"]


class PosteSerializer(GeoFeatureModelSerializer):
    estructura = EstructuraCFESerializer(read_only=True)
    estructura_id = serializers.PrimaryKeyRelatedField(
        queryset=EstructuraCFE.objects.all(), source="estructura", write_only=True
    )
    angulo_deflexion = serializers.SerializerMethodField()
    empotramiento_cm = serializers.SerializerMethodField()
    modulos = PosteModuloSerializer(many=True, read_only=True)
    componentes = PosteComponenteSerializer(many=True, read_only=True)

    class Meta:
        model = Poste
        geo_field = "geom"
        id_field = False
        fields = [
            "id", "tramo", "estructura", "estructura_id", "orden", "es_ancla", "geom",
            "altura_m", "resistencia_kg", "tipo_terreno", "empotramiento_cm",
            "angulo_deflexion", "modulos", "componentes",
        ]
        extra_kwargs = {"orden": {"required": False}}
        # El validador de unicidad (tramo, orden) exigiría `orden`; se asigna solo en create().
        validators = []

    def get_angulo_deflexion(self, obj):
        return obj.angulo_deflexion

    def validate_geom(self, geom):
        if not (-180 <= geom.x <= 180 and -90 <= geom.y <= 90):
            raise serializers.ValidationError("La posición debe estar dentro de ±180° de longitud y ±90° de latitud.")
        return geom

    def get_empotramiento_cm(self, obj):
        try:
            return profundidad_empotramiento(obj.altura_m, obj.tipo_terreno, obj.resistencia_kg)
        except ValueError:
            return None

    def create(self, validated_data):
        if "orden" not in validated_data:
            ultimo = Poste.objects.filter(tramo=validated_data["tramo"]).aggregate(m=Max("orden"))["m"]
            validated_data["orden"] = (ultimo or 0) + 1
        return super().create(validated_data)


class VanoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vano
        fields = ["id", "poste_inicio", "poste_fin", "distancia", "flecha"]