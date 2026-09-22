# apps/proyectos/services.py
import math

from django.contrib.gis.geos import LineString, Point
from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from pyproj import Transformer

from apps.reglas.services import offset_desde_punta_m

_transformer_a_utm = Transformer.from_crs("EPSG:4326", "EPSG:32613", always_xy=True)
_transformer_a_wgs84 = Transformer.from_crs("EPSG:32613", "EPSG:4326", always_xy=True)


def _a_utm(punto):
    x, y = _transformer_a_utm.transform(punto.x, punto.y)
    return x, y


def calcular_angulo_deflexion(poste):
    anterior = poste.tramo.postes.filter(orden=poste.orden - 1).first()
    siguiente = poste.tramo.postes.filter(orden=poste.orden + 1).first()
    if anterior is None or siguiente is None:
        return None

    xa, ya = _a_utm(anterior.geom)
    xp, yp = _a_utm(poste.geom)
    xs, ys = _a_utm(siguiente.geom)

    v_in = (xp - xa, yp - ya)
    v_out = (xs - xp, ys - yp)

    norma_in = math.hypot(*v_in)
    norma_out = math.hypot(*v_out)
    if norma_in == 0 or norma_out == 0:
        return None

    cos_theta = (v_in[0] * v_out[0] + v_in[1] * v_out[1]) / (norma_in * norma_out)
    cos_theta = max(-1.0, min(1.0, cos_theta))
    return math.degrees(math.acos(cos_theta))


def generar_vanos(tramo):
    from .models import Vano

    postes = list(tramo.postes.order_by("orden"))
    Vano.objects.filter(poste_inicio__tramo=tramo).delete()

    nuevos = []
    for anterior, siguiente in zip(postes, postes[1:]):
        xa, ya = _a_utm(anterior.geom)
        xs, ys = _a_utm(siguiente.geom)
        distancia = math.hypot(xs - xa, ys - ya)
        nuevos.append(Vano(poste_inicio=anterior, poste_fin=siguiente, distancia=distancia))

    Vano.objects.bulk_create(nuevos)
    return nuevos


_OFFSET_ANCLAS = 1_000_000
_OFFSET_PASO = 2_000_000


def sincronizar_geom_tramo(tramo):
    """Recalcula la línea del tramo a partir de sus postes, en orden. Sin al menos 2 postes queda vacía."""
    coordenadas = [(p.geom.x, p.geom.y) for p in tramo.postes.order_by("orden")]
    tramo.geom = LineString(coordenadas, srid=4326) if len(coordenadas) >= 2 else None
    tramo.save(update_fields=["geom"])
    # Todo cambio en los postes cuenta como edición del proyecto.
    type(tramo.proyecto).objects.filter(pk=tramo.proyecto_id).update(actualizado_en=timezone.now())


@transaction.atomic
def generar_postes_de_paso(tramo, estructura=None):
    """
    Regenera los postes de paso entre las anclas del tramo. `estructura` es la
    EstructuraCFE que llevarán; si no se indica, se usa la marcada como paso estándar.
    """
    from .models import Poste

    vano_maximo = tramo.vano_maximo
    anclas_ordenadas = list(tramo.postes.filter(es_ancla=True).order_by("orden"))
    if len(anclas_ordenadas) < 2:
        raise ValueError("Se necesitan al menos 2 postes ancla para generar postes de paso.")

    for i, ancla in enumerate(anclas_ordenadas):
        ancla.orden = _OFFSET_ANCLAS + i
    Poste.objects.bulk_update(anclas_ordenadas, ["orden"])

    tramo.postes.filter(es_ancla=False).delete()

    secuencia_final = [anclas_ordenadas[0]]
    nuevos_paso = []
    contador_paso = 0

    from apps.catalogo.models import EstructuraCFE

    estructura_paso = estructura or EstructuraCFE.objects.filter(es_paso_estandar=True).first()
    if not estructura_paso:
        raise ValueError("No se encontró una estructura CFE marcada como paso estándar.")

    for actual, siguiente in zip(anclas_ordenadas, anclas_ordenadas[1:]):
        xa, ya = _a_utm(actual.geom)
        xb, yb = _a_utm(siguiente.geom)
        distancia = math.hypot(xb - xa, yb - ya)
        n_subvanos = max(1, math.ceil(distancia / vano_maximo))

        for i in range(1, n_subvanos):
            t = i / n_subvanos
            x, y = xa + (xb - xa) * t, ya + (yb - ya) * t
            lon, lat = _transformer_a_wgs84.transform(x, y)

            paso = Poste(
                tramo=tramo,
                estructura=estructura_paso,
                es_ancla=False,
                geom=Point(lon, lat, srid=4326),
                orden=_OFFSET_PASO + contador_paso,
            )
            nuevos_paso.append(paso)
            secuencia_final.append(paso)
            contador_paso += 1

        secuencia_final.append(siguiente)

    Poste.objects.bulk_create(nuevos_paso)

    for i, poste in enumerate(secuencia_final, start=1):
        poste.orden = i
    Poste.objects.bulk_update(secuencia_final, ["orden"])
    sincronizar_geom_tramo(tramo)

    for poste in nuevos_paso:
        resolver_layout_poste(poste)

    return secuencia_final


# Escala del dibujo del poste: 12 m = 504 unidades (ver construirIconoPoste.ts).
UNIDADES_POR_M = 42

# Separación horizontal entre piezas repetidas (aisladores) a lo largo de la cruceta.
SEPARACION_PIEZAS = 30

# Piezas que se montan encima de la pieza a la que están referidas, no a su mismo nivel.
MONTADOS_SOBRE_PADRE = {"aislador_pin"}

# Lado de la retenida respecto al poste, alternando por índice.
DESPLAZAMIENTO_RETENIDA = 40


def _x_local(componente_codigo: str, indice: int, cantidad: int) -> float:
    """Coordenada X (0 = eje del poste) de la pieza `indice` de `cantidad`."""
    if componente_codigo == "retenida_ancla":
        return DESPLAZAMIENTO_RETENIDA * (1 if indice % 2 == 0 else -1)
    return (indice - (cantidad - 1) / 2) * SEPARACION_PIEZAS


def _y_local(regla, componente) -> float:
    """Coordenada Y (0 = punta del poste, crece hacia abajo) de una regla de posición."""
    y = offset_desde_punta_m(regla) * UNIDADES_POR_M
    padre = regla.posicion_relativa_a
    if componente.codigo in MONTADOS_SOBRE_PADRE and padre and padre.material and padre.material.componente_visual:
        y -= (padre.material.componente_visual.alto_px + componente.alto_px) / 2
    return y


@transaction.atomic
def resolver_layout_poste(poste):
    """
    Genera/actualiza los PosteComponente en modo AUTO de un poste a partir de las
    reglas de posición de su estructura (apps.reglas). Nunca toca componentes en
    modo MANUAL: si una pieza ya fue ajustada a mano, se deja intacta. Los AUTO que
    la estructura actual ya no pide (p. ej. tras cambiarla) se eliminan.

    Solo se dibujan los materiales que tienen `componente_visual`; el resto
    (bastidor, tirante...) cuenta en el desglose pero no aparece en el poste.
    """
    from .models import PosteComponente

    estructura_mt = poste.estructura.estructura_mt
    if estructura_mt is None:
        return _resolver_layout_paso_estandar(poste)

    reglas = estructura_mt.materiales.select_related(
        "material__componente_visual", "posicion_relativa_a__material__componente_visual"
    )
    existentes = {(c.regla_origen_id, c.indice): c for c in poste.componentes.filter(regla_origen__isnull=False)}

    resultado, vigentes = [], set()
    for regla in reglas:
        componente = regla.material.componente_visual if regla.material else None
        if componente is None:
            continue
        cantidad = max(1, round(regla.cantidad))
        y = _y_local(regla, componente)
        for indice in range(cantidad):
            clave = (regla.pk, indice)
            vigentes.add(clave)
            x = _x_local(componente.codigo, indice, cantidad)
            existente = existentes.get(clave)
            if existente is None:
                instancia = PosteComponente.objects.create(
                    poste=poste, componente_visual=componente, regla_origen=regla, indice=indice,
                    modo=PosteComponente.Modo.AUTO, x=x, y=y, orden_z=componente.z_index,
                )
            elif existente.modo == PosteComponente.Modo.AUTO:
                existente.componente_visual, existente.x, existente.y = componente, x, y
                existente.orden_z = componente.z_index
                existente.save()
                instancia = existente
            else:
                instancia = existente  # MANUAL: el usuario ya lo ajustó
            resultado.append(instancia)

    # AUTO obsoletos: reglas que ya no aplican, o piezas de la receta fija anterior (sin regla).
    poste.componentes.filter(modo=PosteComponente.Modo.AUTO).exclude(
        pk__in=[c.pk for c in resultado]
    ).delete()
    return resultado


def _resolver_layout_paso_estandar(poste):
    """Receta fija (cruceta + 3 aisladores en slots) para estructuras aún sin regla normativa."""
    from apps.catalogo.models import ComponenteVisual, SlotAnclaje

    from .models import PosteComponente

    if not poste.estructura.es_paso_estandar:
        return []

    cruceta = ComponenteVisual.objects.get(codigo="cruceta")
    aislador = ComponenteVisual.objects.get(codigo="aislador_pin")

    receta = [
        ("cruceta_1", cruceta, 0),
        ("aislador_izq", aislador, 1),
        ("aislador_centro", aislador, 1),
        ("aislador_der", aislador, 1),
    ]

    resultado = []
    for codigo_slot, componente, orden_z in receta:
        slot = SlotAnclaje.objects.get(codigo=codigo_slot)
        existente = PosteComponente.objects.filter(poste=poste, slot=slot).first()

        if existente is None:
            instancia = PosteComponente.objects.create(
                poste=poste,
                componente_visual=componente,
                slot=slot,
                modo=PosteComponente.Modo.AUTO,
                x=slot.x_local,
                y=slot.y_local,
                orden_z=orden_z,
            )
        elif existente.modo == PosteComponente.Modo.AUTO:
            existente.componente_visual = componente
            existente.x = slot.x_local
            existente.y = slot.y_local
            existente.orden_z = orden_z
            existente.save()
            instancia = existente
        else:
            instancia = existente  # modo MANUAL: el usuario ya lo ajustó, no se toca

        resultado.append(instancia)

    return resultado


@transaction.atomic
def agregar_postes_por_coordenadas(tramo, puntos, estructura, altura_m=12.0, resistencia_kg=750, tipo_terreno="normal"):
    """
    Crea postes ancla a continuación de los que ya tiene el tramo, uno por punto
    `(lng, lat)` y en ese orden. Es todo o nada: si algo falla no queda ninguno.
    """
    from .models import Poste

    ultimo_orden = tramo.postes.aggregate(m=Max("orden"))["m"] or 0
    creados = []
    for i, (lng, lat) in enumerate(puntos, start=1):
        poste = Poste.objects.create(
            tramo=tramo, estructura=estructura, orden=ultimo_orden + i, es_ancla=True,
            geom=Point(lng, lat, srid=4326),
            altura_m=altura_m, resistencia_kg=resistencia_kg, tipo_terreno=tipo_terreno,
        )
        resolver_layout_poste(poste)
        creados.append(poste)
    sincronizar_geom_tramo(tramo)
    return creados


def longitud_proyecto_m(proyecto) -> float:
    """Longitud total de la línea del proyecto, en metros (proyectada a UTM 13N)."""
    total = 0.0
    for tramo in proyecto.tramos.all():
        if tramo.geom:
            total += tramo.geom.transform(32613, clone=True).length
    return total


def calcular_materiales_proyecto(proyecto) -> dict:
    """
    Lista de materiales del proyecto a partir de las reglas normativas de cada
    estructura (apps.reglas): cuántos postes de cada altura/resistencia, cuánto
    de cada material en total y el desglose por poste. Los postes cuya estructura
    aún no tiene reglas se reportan en `sin_reglas` en vez de contarse en silencio.
    """
    from .models import Poste

    postes = list(
        Poste.objects.filter(tramo__proyecto=proyecto)
        .select_related("estructura__estructura_mt", "tramo")
        .order_by("tramo_id", "orden")
    )
    reglas_por_estructura: dict[int, list] = {}
    postes_por_tipo: dict[tuple[float, int], int] = {}
    materiales: dict[str, dict] = {}
    por_poste, sin_reglas = [], []
    num_vanos, suma_vanos = 0, 0.0

    for poste in postes:
        clave_poste = (poste.altura_m, poste.resistencia_kg)
        postes_por_tipo[clave_poste] = postes_por_tipo.get(clave_poste, 0) + 1

        estructura_mt = poste.estructura.estructura_mt
        if estructura_mt is None:
            sin_reglas.append({"poste_id": poste.id, "orden": poste.orden, "estructura": poste.estructura.codigo})
            continue
        if estructura_mt.pk not in reglas_por_estructura:
            reglas_por_estructura[estructura_mt.pk] = list(
                estructura_mt.materiales.select_related("material").filter(material__isnull=False)
            )
        lineas = []
        for regla in reglas_por_estructura[estructura_mt.pk]:
            material = regla.material
            acumulado = materiales.setdefault(material.codigo, {
                "codigo": material.codigo, "nombre": material.nombre, "unidad": material.unidad,
                "cantidad": 0.0, "verificado": True, "cantidad_estimada": False,
            })
            acumulado["cantidad"] += regla.cantidad
            acumulado["verificado"] &= regla.verificado
            acumulado["cantidad_estimada"] |= regla.cantidad_estimada
            lineas.append({"material": material.nombre, "codigo": material.codigo, "unidad": material.unidad,
                           "cantidad": regla.cantidad, "verificado": regla.verificado})
        por_poste.append({
            "poste_id": poste.id, "orden": poste.orden, "estructura": poste.estructura.codigo,
            "altura_m": poste.altura_m, "resistencia_kg": poste.resistencia_kg, "materiales": lineas,
        })

    for anterior, siguiente in zip(postes, postes[1:]):
        if anterior.tramo_id == siguiente.tramo_id:
            xa, ya = _a_utm(anterior.geom)
            xs, ys = _a_utm(siguiente.geom)
            num_vanos += 1
            suma_vanos += math.hypot(xs - xa, ys - ya)

    lista = sorted(materiales.values(), key=lambda m: m["nombre"])
    return {
        "resumen": {
            "num_postes": len(postes),
            "num_vanos": num_vanos,
            "vano_promedio_m": suma_vanos / num_vanos if num_vanos else None,
            "longitud_m": suma_vanos,
            "piezas": sum(m["cantidad"] for m in lista),
            "partidas": len(lista),
            "partidas_sin_verificar": sum(1 for m in lista if not m["verificado"]),
        },
        "postes": [
            {"altura_m": a, "resistencia_kg": r, "cantidad": n}
            for (a, r), n in sorted(postes_por_tipo.items())
        ],
        "materiales": lista,
        "por_poste": por_poste,
        "sin_reglas": sin_reglas,
    }
