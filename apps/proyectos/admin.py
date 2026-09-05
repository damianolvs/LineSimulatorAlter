# apps/proyectos/admin.py
from django.contrib.gis import admin as gis_admin
from django.contrib import admin

from .models import Poste, PosteComponente, PosteModulo, Proyecto, Tramo, Vano


class PosteModuloInline(admin.TabularInline):
    model = PosteModulo
    extra = 1


class PosteComponenteInline(admin.TabularInline):
    model = PosteComponente
    extra = 1


@admin.register(Proyecto)
class ProyectoAdmin(admin.ModelAdmin):
    list_display = ("nombre", "ubicacion", "creado_en")
    search_fields = ("nombre", "ubicacion")


@admin.register(Tramo)
class TramoAdmin(gis_admin.GISModelAdmin):
    list_display = ("nombre", "proyecto")
    list_filter = ("proyecto",)


@admin.register(Poste)
class PosteAdmin(gis_admin.GISModelAdmin):
    list_display = ("tramo", "orden", "estructura", "es_ancla")
    list_filter = ("es_ancla", "estructura")
    inlines = [PosteModuloInline, PosteComponenteInline]


@admin.register(Vano)
class VanoAdmin(admin.ModelAdmin):
    list_display = ("poste_inicio", "poste_fin", "distancia", "flecha")