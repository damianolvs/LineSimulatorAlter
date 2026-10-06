# apps/proyectos/flecha.py
"""
Cálculo de flecha y tensión de conductores, sin acceso a base de datos.

Modelo: vanos a nivel, sin viento ni hielo. La tensión horizontal se fija en la
condición de referencia (EDS: % de la carga de ruptura a `TEMPERATURA_REFERENCIA_C`)
sobre el vano regulador del tramo y se lleva a la temperatura de diseño con la
ecuación de cambio de estado (aproximación parabólica). La flecha de cada vano
se obtiene luego con la catenaria. Unidades: m, kg, mm², °C.
"""
import math
from dataclasses import dataclass

TEMPERATURA_REFERENCIA_C = 16.0


@dataclass(frozen=True)
class PropiedadesConductor:
    seccion_mm2: float
    peso_kg_m: float
    carga_ruptura_kg: float
    modulo_elasticidad_kg_mm2: float
    coef_dilatacion_c: float


def vano_regulador(vanos_m: list[float]) -> float:
    """Vano equivalente de una serie de vanos: raíz de ΣL³ / ΣL."""
    total = sum(vanos_m)
    if total <= 0:
        raise ValueError("Se necesita al menos un vano con longitud positiva.")
    return math.sqrt(sum(v ** 3 for v in vanos_m) / total)


def esfuerzo_en_estado(
    c: PropiedadesConductor, vano_m: float, esfuerzo_ref: float, temp_ref_c: float, temp_c: float
) -> float:
    """
    Esfuerzo horizontal (kg/mm²) a `temp_c`, dado el de referencia `esfuerzo_ref` a `temp_ref_c`.
    Resuelve  σ² (σ + αE·Δt + γ²L²E/(24σ₀²) − σ₀) = γ²L²E/24  por bisección.
    """
    gamma = c.peso_kg_m / c.seccion_mm2
    constante = gamma ** 2 * vano_m ** 2 * c.modulo_elasticidad_kg_mm2 / 24
    k = (
        c.coef_dilatacion_c * c.modulo_elasticidad_kg_mm2 * (temp_c - temp_ref_c)
        + constante / esfuerzo_ref ** 2
        - esfuerzo_ref
    )

    def residuo(sigma: float) -> float:
        return sigma ** 2 * (sigma + k) - constante

    bajo, alto = 1e-9, max(esfuerzo_ref, 1.0)
    while residuo(alto) < 0:
        alto *= 2
    for _ in range(200):
        medio = (bajo + alto) / 2
        if residuo(medio) < 0:
            bajo = medio
        else:
            alto = medio
    return (bajo + alto) / 2


def flecha_catenaria(vano_m: float, peso_kg_m: float, tension_h_kg: float) -> float:
    """Flecha (m) de un vano a nivel con tensión horizontal `tension_h_kg`."""
    a = tension_h_kg / peso_kg_m
    return a * (math.cosh(vano_m / (2 * a)) - 1)


def calcular_flechas(
    c: PropiedadesConductor, vanos_m: list[float], porcentaje_eds: float, temperatura_c: float
) -> dict:
    """Flecha de cada vano a `temperatura_c`, con la tensión fijada por el EDS sobre el vano regulador."""
    if not vanos_m:
        raise ValueError("No hay vanos que calcular.")
    regulador = vano_regulador(vanos_m)
    esfuerzo_eds = (porcentaje_eds / 100) * c.carga_ruptura_kg / c.seccion_mm2
    esfuerzo = esfuerzo_en_estado(c, regulador, esfuerzo_eds, TEMPERATURA_REFERENCIA_C, temperatura_c)
    tension = esfuerzo * c.seccion_mm2
    return {
        "vano_regulador_m": regulador,
        "tension_eds_kg": esfuerzo_eds * c.seccion_mm2,
        "tension_kg": tension,
        "flechas_m": [flecha_catenaria(v, c.peso_kg_m, tension) for v in vanos_m],
    }
