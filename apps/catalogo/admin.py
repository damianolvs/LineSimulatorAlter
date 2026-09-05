# apps/catalogo/admin.py
from django.contrib import admin

from .models import (
    ComponenteVisual,
    EstructuraCFE,
    EstructuraCFEMaterial,
    Material,
    Modulo,
    ModuloMaterial,
    SlotAnclaje,
)


class EstructuraCFEMaterialInline(admin.TabularInline):
    model = EstructuraCFEMaterial
    extra = 1


class ModuloMaterialInline(admin.TabularInline):
    model = ModuloMaterial
    extra = 1


@admin.register(EstructuraCFE)
class EstructuraCFEAdmin(admin.ModelAdmin):
    list_display = ("codigo", "nombre")
    search_fields = ("codigo", "nombre")
    inlines = [EstructuraCFEMaterialInline]


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = ("nombre", "codigo", "unidad", "cantidad_estimada")
    list_filter = ("unidad", "cantidad_estimada")
    search_fields = ("nombre", "codigo")


@admin.register(Modulo)
class ModuloAdmin(admin.ModelAdmin):
    list_display = ("nombre", "codigo")
    search_fields = ("nombre", "codigo")
    inlines = [ModuloMaterialInline]


@admin.register(ComponenteVisual)
class ComponenteVisualAdmin(admin.ModelAdmin):
    list_display = ("nombre", "codigo", "ancho_px", "alto_px", "z_index", "activo")
    list_filter = ("activo",)
    search_fields = ("nombre", "codigo")
    prepopulated_fields = {"codigo": ("nombre",)}


@admin.register(SlotAnclaje)
class SlotAnclajeAdmin(admin.ModelAdmin):
    list_display = ("nombre", "codigo", "x_local", "y_local")
    filter_horizontal = ("componentes_compatibles",)
    search_fields = ("nombre", "codigo")