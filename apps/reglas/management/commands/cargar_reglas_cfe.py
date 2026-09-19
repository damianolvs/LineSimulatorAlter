# apps/reglas/management/commands/cargar_reglas_cfe.py
import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.catalogo.models import ComponenteVisual, EstructuraCFE, Material
from apps.reglas.models import (
    ComponenteMecanico,
    DocumentoNormativo,
    EstructuraMT,
    PrefijoEstructuraMT,
    ReglaEmpotramiento,
    ReglaPosicionMaterial,
    SeccionNormativa,
    TipoEnsamble,
)

ARCHIVO_DATOS = Path(__file__).resolve().parents[2] / "data" / "reglas_cfe.json"

# Material (código) -> ComponenteVisual (código) con el que se dibuja sobre el poste.
# Los materiales que no aparecen aquí (bastidor, tirante, riostra...) no se dibujan todavía.
SIMBOLO_POR_MATERIAL = {
    "cruceta-c4t": "cruceta",
    "cruceta-doble-anclaje": "cruceta",
    "cruceta-h": "cruceta",
    "cruceta-remate": "cruceta",
    "aislador-tipo-pin": "aislador_pin",
    "aislador-suspension-remate": "aislador_remate",
    "aislador-deflexion": "aislador_remate",
    "cadena-aisladores": "aislador_remate",
    "abrazadera-suspension-ag": "aislador_remate",
    "anclaje-retenida": "retenida_ancla",
}


def _cargar_normativa(datos: dict) -> dict[str, SeccionNormativa]:
    doc_datos = datos["documento"]
    documento, _ = DocumentoNormativo.objects.update_or_create(
        codigo_especificacion=doc_datos["codigo_especificacion"], defaults=doc_datos
    )
    secciones = {}
    for s in datos["secciones"]:
        secciones[s["codigo"]], _ = SeccionNormativa.objects.update_or_create(
            documento=documento, codigo=s["codigo"], defaults=s
        )
    return secciones


def _cargar_catalogos_simples(datos: dict, secciones: dict) -> None:
    for e in datos["ensambles"]:
        TipoEnsamble.objects.update_or_create(
            codigo=e["codigo"],
            defaults={"subseccion": e["subseccion"], "titulo": e["titulo"], "fuente": secciones[e["fuente"]]},
        )
    for e in datos["empotramientos"]:
        clave = {k: e[k] for k in ("altura_poste_m", "resistencia_kg", "tipo_terreno")}
        defaults = {k: e[k] for k in ("profundidad_cm", "verificado", "notas")}
        ReglaEmpotramiento.objects.update_or_create(**clave, defaults={**defaults, "fuente": secciones[e["fuente"]]})
    for c in datos["componentes_mecanicos"]:
        campos = {k: v for k, v in c.items() if k not in ("tipo", "clave", "fuente")}
        ComponenteMecanico.objects.update_or_create(
            tipo=c["tipo"], clave=c["clave"], defaults={**campos, "fuente": secciones[c["fuente"]]}
        )


def _cargar_estructuras(datos: dict, secciones: dict) -> dict[str, EstructuraMT]:
    prefijos = {}
    for p in datos["prefijos"]:
        prefijos[p["codigo"]], _ = PrefijoEstructuraMT.objects.update_or_create(
            codigo=p["codigo"], defaults={"nombre": p["nombre"], "fuente": secciones[p["fuente"]]}
        )
    estructuras = {}
    for e in datos["estructuras"]:
        campos = {k: v for k, v in e.items() if k not in ("codigo", "prefijo", "fuente")}
        estructuras[e["codigo"]], _ = EstructuraMT.objects.update_or_create(
            codigo=e["codigo"],
            defaults={**campos, "prefijo": prefijos[e["prefijo"]], "fuente": secciones[e["fuente"]]},
        )
    return estructuras


def _cargar_materiales(datos: dict) -> dict[str, Material]:
    simbolos = {c.codigo: c for c in ComponenteVisual.objects.all()}
    materiales = {}
    for m in datos["materiales"]:
        simbolo = simbolos.get(SIMBOLO_POR_MATERIAL.get(m["codigo"]))
        materiales[m["codigo"]], _ = Material.objects.update_or_create(
            codigo=m["codigo"],
            defaults={"nombre": m["nombre"], "unidad": m["unidad"].upper(), "componente_visual": simbolo},
        )
    return materiales


def _cargar_reglas_posicion(datos: dict, secciones, estructuras, materiales) -> None:
    ensambles = {e.codigo: e for e in TipoEnsamble.objects.all()}
    creadas: list[ReglaPosicionMaterial] = []
    for r in datos["reglas_posicion"]:
        campos = {
            k: r[k]
            for k in ("cantidad", "condicion", "cantidad_estimada", "altura_min_m", "altura_max_m",
                      "offset_relativo_m", "verificado", "notas")
        }
        regla, _ = ReglaPosicionMaterial.objects.update_or_create(
            tipo_estructura=estructuras[r["estructura"]],
            material=materiales.get(r["material"]),
            descripcion=r["descripcion"],
            defaults={
                **campos,
                "ensamble": ensambles.get(r["ensamble"]),
                "fuente": secciones.get(r["fuente"]),
            },
        )
        creadas.append(regla)
    # `relativa_a` es el índice (base 0) de otra regla dentro de la misma lista.
    for regla, r in zip(creadas, datos["reglas_posicion"]):
        padre = creadas[r["relativa_a"]] if r["relativa_a"] is not None else None
        if regla.posicion_relativa_a_id != (padre.pk if padre else None):
            regla.posicion_relativa_a = padre
            regla.save(update_fields=["posicion_relativa_a"])


def _enlazar_catalogo_visual(estructuras: dict[str, EstructuraMT]) -> None:
    """Crea una EstructuraCFE por cada EstructuraMT para poder elegirla al colocar postes."""
    for codigo, estructura_mt in estructuras.items():
        EstructuraCFE.objects.update_or_create(
            codigo=codigo,
            defaults={"nombre": estructura_mt.nombre or codigo, "estructura_mt": estructura_mt},
        )


class Command(BaseCommand):
    help = "Carga la normativa CFE (empotramientos, estructuras y posiciones de material) desde data/reglas_cfe.json."

    @transaction.atomic
    def handle(self, *args, **options):
        datos = json.loads(ARCHIVO_DATOS.read_text(encoding="utf-8"))
        secciones = _cargar_normativa(datos)
        _cargar_catalogos_simples(datos, secciones)
        estructuras = _cargar_estructuras(datos, secciones)
        materiales = _cargar_materiales(datos)
        _cargar_reglas_posicion(datos, secciones, estructuras, materiales)
        _enlazar_catalogo_visual(estructuras)
        self.stdout.write(self.style.SUCCESS(
            f"Reglas CFE cargadas: {len(estructuras)} estructuras, {len(materiales)} materiales, "
            f"{len(datos['reglas_posicion'])} reglas de posición, {len(datos['empotramientos'])} empotramientos."
        ))
