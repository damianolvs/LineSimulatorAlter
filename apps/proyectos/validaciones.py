# apps/proyectos/validaciones.py
"""
Validación de un proyecto contra la normativa CFE digitalizada en apps.reglas.
No modifica nada: devuelve una lista de problemas con severidad, para que el
diseñador los corrija. Cada problema apunta al poste/tramo afectado.
"""
import math

from apps.reglas.services import profundidad_empotramiento

from .services import _a_utm, deflexion_entre

ERROR, ADVERTENCIA, INFO = "error", "advertencia", "info"

# Separación mínima entre postes consecutivos; por debajo, casi seguro es un punto duplicado.
DISTANCIA_MINIMA_M = 3.0

# Deflexión máxima por categoría cuando la estructura no trae `angulo_min`/`angulo_max`
# propios. Son valores de referencia (advertencia, no error): ajustarlos aquí o, mejor,
# capturar el rango real en el catálogo de la estructura.
DEFLEXION_MAXIMA_POR_CATEGORIA = {"paso_simple": 5.0, "paso_doble": 30.0}


def _problema(severidad, codigo, mensaje, poste=None, tramo=None):
    return {
        "severidad": severidad,
        "codigo": codigo,
        "mensaje": mensaje,
        "tramo_id": tramo.id if tramo else (poste.tramo_id if poste else None),
        "poste_id": poste.id if poste else None,
        "orden": poste.orden if poste else None,
    }


def _validar_deflexion(poste, estructura_mt, angulo):
    if estructura_mt is None or angulo is None:
        return None
    minimo, maximo = estructura_mt.angulo_min, estructura_mt.angulo_max
    if minimo is not None or maximo is not None:
        if (minimo is not None and angulo < minimo) or (maximo is not None and angulo > maximo):
            rango = f"{minimo if minimo is not None else 0:g}°–{f'{maximo:g}°' if maximo is not None else '∞'}"
            return _problema(
                ERROR, "deflexion_fuera_de_rango",
                f"Poste {poste.orden}: la deflexión de {angulo:.1f}° está fuera del rango de "
                f"{estructura_mt.codigo} ({rango}).", poste,
            )
        return None
    limite = DEFLEXION_MAXIMA_POR_CATEGORIA.get(estructura_mt.categoria)
    if limite is not None and angulo > limite:
        return _problema(
            ADVERTENCIA, "deflexion_excede_categoria",
            f"Poste {poste.orden}: deflexión de {angulo:.1f}° con {estructura_mt.codigo} "
            f"({estructura_mt.get_categoria_display().lower()}); se espera hasta {limite:g}°. "
            "Considera una estructura de deflexión o remate.", poste,
        )
    return None


def validar_proyecto(proyecto) -> dict:
    from .models import Poste

    problemas = []
    sin_regla_ordenes: dict[str, list[int]] = {}
    empotramientos: dict[tuple, str | None] = {}
    reglas_sin_verificar: set[str] = set()

    for tramo in proyecto.tramos.all():
        postes = list(
            Poste.objects.filter(tramo=tramo)
            .select_related("estructura__estructura_mt")
            .order_by("orden")
        )
        if len(postes) < 2:
            problemas.append(_problema(
                ADVERTENCIA, "tramo_incompleto",
                f"{tramo}: necesita al menos 2 postes para formar una línea.", tramo=tramo,
            ))
        ultimo = len(postes) - 1

        for i, poste in enumerate(postes):
            estructura_mt = poste.estructura.estructura_mt
            anterior = postes[i - 1] if i > 0 else None
            siguiente = postes[i + 1] if i < ultimo else None

            # Vano hacia el siguiente poste.
            if siguiente is not None:
                xa, ya = _a_utm(poste.geom)
                xs, ys = _a_utm(siguiente.geom)
                distancia = math.hypot(xs - xa, ys - ya)
                if distancia < DISTANCIA_MINIMA_M:
                    problemas.append(_problema(
                        ERROR, "postes_muy_cercanos",
                        f"Postes {poste.orden} y {siguiente.orden}: solo {distancia:.1f} m de separación "
                        "(¿punto duplicado?).", poste,
                    ))
                elif distancia > tramo.vano_maximo:
                    problemas.append(_problema(
                        ADVERTENCIA, "vano_excede_maximo",
                        f"Vano {poste.orden}→{siguiente.orden}: {distancia:.0f} m supera el máximo de "
                        f"{tramo.vano_maximo:g} m. Genera postes de paso.", poste,
                    ))

            # Estructura vs. deflexión y posición en la línea.
            if anterior is not None and siguiente is not None:
                p = _validar_deflexion(poste, estructura_mt, deflexion_entre(anterior, poste, siguiente))
                if p:
                    problemas.append(p)
                if estructura_mt is not None and (estructura_mt.es_terminal or estructura_mt.categoria == "remate"):
                    problemas.append(_problema(
                        ADVERTENCIA, "remate_intermedio",
                        f"Poste {poste.orden}: {estructura_mt.codigo} es una estructura de remate "
                        "y no está en un extremo del tramo.", poste,
                    ))
            elif estructura_mt is not None and len(postes) >= 2 and not (
                estructura_mt.es_terminal or estructura_mt.categoria in ("remate", "subestacion")
            ):
                problemas.append(_problema(
                    INFO, "extremo_sin_remate",
                    f"Poste {poste.orden}: extremo del tramo con {estructura_mt.codigo}, que no es de remate.",
                    poste,
                ))

            # Normativa digitalizada disponible.
            if estructura_mt is None:
                sin_regla_ordenes.setdefault(poste.estructura.codigo, []).append(poste.orden)
            elif not estructura_mt.verificado:
                reglas_sin_verificar.add(estructura_mt.codigo)

            clave = (poste.altura_m, poste.tipo_terreno, poste.resistencia_kg)
            if clave not in empotramientos:
                try:
                    profundidad_empotramiento(clave[0], clave[1], clave[2])
                    empotramientos[clave] = None
                except ValueError:
                    empotramientos[clave] = (
                        f"No hay regla de empotramiento para {poste.altura_m:g} m en terreno {poste.tipo_terreno}."
                    )
            if empotramientos[clave]:
                problemas.append(_problema(
                    ERROR, "empotramiento_sin_regla", f"Poste {poste.orden}: {empotramientos[clave]}", poste,
                ))

    for codigo, ordenes in sin_regla_ordenes.items():
        problemas.append(_problema(
            INFO, "estructura_sin_reglas",
            f"{codigo} aún no tiene reglas normativas digitalizadas "
            f"({len(ordenes)} poste{'s' if len(ordenes) != 1 else ''}): no entra en el desglose de materiales.",
        ))
    if reglas_sin_verificar:
        problemas.append(_problema(
            INFO, "reglas_sin_verificar",
            "Estructuras con reglas sin verificar contra el PDF de CFE: "
            + ", ".join(sorted(reglas_sin_verificar)) + ".",
        ))

    orden_severidad = {ERROR: 0, ADVERTENCIA: 1, INFO: 2}
    problemas.sort(key=lambda p: (orden_severidad[p["severidad"]], p["tramo_id"] or 0, p["orden"] or 0))
    return {
        "resumen": {
            "errores": sum(p["severidad"] == ERROR for p in problemas),
            "advertencias": sum(p["severidad"] == ADVERTENCIA for p in problemas),
            "info": sum(p["severidad"] == INFO for p in problemas),
        },
        "problemas": problemas,
    }
