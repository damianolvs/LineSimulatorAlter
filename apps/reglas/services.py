# apps/reglas/services.py
"""
Motor de reglas: funciones que aplican la normativa CFE para calcular parámetros
reales de construcción, en vez de dejarlos como valores fijos en el código de
otras apps. Cada función debe poder señalar de qué sección normativa sale su
resultado.
"""
from .models import EstructuraMT, ReglaEmpotramiento, ReglaPosicionMaterial


def profundidad_empotramiento(altura_poste_m: float, tipo_terreno: str, resistencia_kg: int | None = None) -> float:
    """
    Profundidad de empotramiento en cm, según la sección 03 00 02 "Cepas para
    postes de concreto".

    Busca primero una fila exacta de la tabla (altura + resistencia + terreno).
    Si no hay coincidencia exacta de resistencia para esa altura/terreno, usa la
    fila más cercana. Si no hay ninguna fila para esa altura, cae a la fórmula de
    respaldo del propio documento — solo válida para terreno normal:

        profundidad = altura del poste en dm + 50 cm
    """
    qs = ReglaEmpotramiento.objects.filter(altura_poste_m=altura_poste_m, tipo_terreno=tipo_terreno)
    if resistencia_kg is not None:
        exacta = qs.filter(resistencia_kg=resistencia_kg).first()
        if exacta:
            return exacta.profundidad_cm
    coincidencia = qs.order_by("resistencia_kg").first()
    if coincidencia:
        return coincidencia.profundidad_cm

    if tipo_terreno == "normal":
        return altura_poste_m * 10 + 50

    raise ValueError(
        f"No hay regla de empotramiento para altura={altura_poste_m}m, terreno={tipo_terreno}, "
        "y la fórmula de respaldo solo aplica a terreno normal. Verifica la tabla en la sección 03 00 02."
    )


def offset_desde_punta_m(regla: ReglaPosicionMaterial) -> float:
    """Suma los offsets de una regla y sus dependencias hasta llegar a la punta del poste."""
    total = regla.offset_relativo_m or 0
    if regla.posicion_relativa_a_id:
        total += offset_desde_punta_m(regla.posicion_relativa_a)
    return total


def altura_sobre_piso_m(regla: ReglaPosicionMaterial, altura_poste_m: float, tipo_terreno: str,
                         resistencia_kg: int | None = None) -> float:
    """
    Altura real de un material sobre el nivel de piso, en metros.

    `ReglaPosicionMaterial.offset_relativo_m` mide desde la punta del poste hacia
    abajo (o desde otro material, si `posicion_relativa_a` está definido) — es
    terreno-independiente, tal como lo acota el documento. Para conocer la altura
    sobre el suelo hay que restar también cuánto del poste queda enterrado, que sí
    depende del tipo de terreno (sección 03 00 02).
    """
    empotramiento_m = profundidad_empotramiento(altura_poste_m, tipo_terreno, resistencia_kg) / 100
    return altura_poste_m - empotramiento_m - offset_desde_punta_m(regla)


def desglose_estructura(estructura: EstructuraMT, altura_poste_m: float, tipo_terreno: str,
                        resistencia_kg: int | None = None) -> dict:
    """
    Empotramiento y lista de materiales (con su altura real sobre piso y fuente
    normativa) de una estructura montada en un poste concreto.
    """
    reglas = estructura.materiales.select_related("material", "fuente", "posicion_relativa_a")
    materiales = [
        {
            "regla_id": r.id,
            "material": r.material.nombre if r.material else r.descripcion,
            "descripcion": r.descripcion,
            "cantidad": r.cantidad,
            "condicion": r.condicion,
            "altura_sobre_piso_m": round(altura_sobre_piso_m(r, altura_poste_m, tipo_terreno, resistencia_kg), 2),
            "fuente": r.fuente.codigo if r.fuente else None,
            "verificado": r.verificado,
        }
        for r in reglas
    ]
    return {
        "estructura": estructura.codigo,
        "empotramiento_cm": profundidad_empotramiento(altura_poste_m, tipo_terreno, resistencia_kg),
        "materiales": materiales,
    }
