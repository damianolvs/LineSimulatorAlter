# apps/reglas/admin.py
from django.contrib import admin

from .models import (
    ComponenteMecanico,
    DocumentoNormativo,
    EstructuraMT,
    PrefijoEstructuraMT,
    ReglaEmpotramiento,
    ReglaPosicionMaterial,
    SeccionNormativa,
    TipoEnsamble,
)


class SeccionNormativaInline(admin.TabularInline):
    model = SeccionNormativa
    extra = 0


@admin.register(DocumentoNormativo)
class DocumentoNormativoAdmin(admin.ModelAdmin):
    list_display = ["titulo", "codigo_especificacion", "edicion"]
    inlines = [SeccionNormativaInline]


@admin.register(SeccionNormativa)
class SeccionNormativaAdmin(admin.ModelAdmin):
    list_display = ["codigo", "titulo", "documento", "pagina_inicio", "pagina_fin"]
    list_filter = ["documento"]
    search_fields = ["codigo", "titulo"]


@admin.register(ReglaEmpotramiento)
class ReglaEmpotramientoAdmin(admin.ModelAdmin):
    list_display = ["altura_poste_m", "resistencia_kg", "tipo_terreno", "profundidad_cm", "verificado"]
    list_filter = ["tipo_terreno", "verificado"]
    ordering = ["altura_poste_m", "tipo_terreno"]


@admin.register(TipoEnsamble)
class TipoEnsambleAdmin(admin.ModelAdmin):
    list_display = ["codigo", "titulo", "subseccion", "fuente"]
    list_filter = ["subseccion"]
    search_fields = ["codigo", "titulo"]


@admin.register(PrefijoEstructuraMT)
class PrefijoEstructuraMTAdmin(admin.ModelAdmin):
    list_display = ["codigo", "nombre", "fuente"]


class ReglaPosicionMaterialInline(admin.TabularInline):
    model = ReglaPosicionMaterial
    fk_name = "tipo_estructura"
    extra = 1
    autocomplete_fields = ["material", "ensamble", "posicion_relativa_a"]


@admin.register(EstructuraMT)
class EstructuraMTAdmin(admin.ModelAdmin):
    list_display = ["codigo", "nombre", "prefijo", "categoria", "es_terminal", "verificado"]
    list_filter = ["prefijo", "categoria", "es_terminal", "verificado"]
    search_fields = ["codigo", "nombre"]
    inlines = [ReglaPosicionMaterialInline]


@admin.register(ComponenteMecanico)
class ComponenteMecanicoAdmin(admin.ModelAdmin):
    list_display = ["tipo", "clave", "resistencia_trabajo_kg", "factor_seguridad", "verificado"]
    list_filter = ["tipo", "verificado"]
    search_fields = ["clave"]


@admin.register(ReglaPosicionMaterial)
class ReglaPosicionMaterialAdmin(admin.ModelAdmin):
    list_display = ["tipo_estructura", "material", "descripcion", "cantidad", "altura_min_m", "altura_max_m", "verificado"]
    list_filter = ["verificado", "tipo_estructura"]
    search_fields = ["descripcion", "notas"]
    autocomplete_fields = ["tipo_estructura", "material", "ensamble", "posicion_relativa_a"]
