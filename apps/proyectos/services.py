# apps/proyectos/services.py
import math

from django.contrib.gis.geos import Point
from django.db import transaction
from pyproj import Transformer

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


@transaction.atomic
def generar_postes_de_paso(tramo):
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

    estructura_paso = EstructuraCFE.objects.filter(es_paso_estandar=True).first()
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

    return secuencia_final


def resolver_layout_poste(poste):
    """
    Genera/actualiza los PosteComponente en modo AUTO de un poste, según su
    EstructuraCFE. Nunca toca componentes en modo MANUAL — si el slot ya tiene
    uno ajustado a mano, lo deja intacto.

    Primera versión: solo cubre la estructura de paso estándar (poste 12m +
    cruceta + 3 aisladores). Las reglas de otras estructuras se agregan después.
    """
    from apps.catalogo.models import ComponenteVisual, SlotAnclaje

    from .models import PosteComponente

    if not poste.estructura.es_paso_estandar:
        return []  # aún no hay reglas definidas para otros tipos de estructura

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