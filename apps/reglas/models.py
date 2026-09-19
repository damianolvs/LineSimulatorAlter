# apps/reglas/models.py
"""
Motor de reglas: encierra la normativa oficial de CFE que rige cómo se construyen
las líneas (profundidades de empotramiento, ensambles de herrajes, posición de
materiales sobre el poste, etc.), citando siempre su fuente exacta en el
documento normativo para poder auditar cada regla contra el PDF original.

Fuente principal: "Construcción de Instalaciones Aéreas en Media y Baja Tensión"
(Especificación CFE DCCIAMBT, febrero 2014). Es un documento legal/normativo de
CFE — cada regla debe poder rastrearse a su sección y página exactas.
"""
from django.db import models


class DocumentoNormativo(models.Model):
    """Un documento fuente (ej. la especificación CFE) del que se derivan las reglas."""
    titulo = models.CharField(max_length=250)
    codigo_especificacion = models.CharField(max_length=50, blank=True, help_text="Ej. CFE DCCIAMBT")
    edicion = models.CharField(max_length=50, blank=True, help_text="Ej. Febrero 2014")
    archivo = models.CharField(max_length=300, blank=True, help_text="Ruta o nombre del PDF fuente")

    class Meta:
        ordering = ["titulo"]

    def __str__(self):
        return f"{self.titulo} ({self.edicion})" if self.edicion else self.titulo


class SeccionNormativa(models.Model):
    """Una sección específica del documento (ej. '03 00 02'), para citar la fuente exacta de cada regla."""
    documento = models.ForeignKey(DocumentoNormativo, on_delete=models.CASCADE, related_name="secciones")
    codigo = models.CharField(max_length=20, help_text="Ej. '03 00 02'")
    titulo = models.CharField(max_length=250)
    pagina_inicio = models.PositiveIntegerField(null=True, blank=True)
    pagina_fin = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["documento", "codigo"]
        unique_together = [("documento", "codigo")]

    def __str__(self):
        return f"{self.codigo} — {self.titulo}"


class ReglaEmpotramiento(models.Model):
    """
    Profundidad de empotramiento de un poste según su altura/resistencia y el tipo
    de terreno. Tabla de la sección 03 00 02 — verificada: coincide exactamente
    con la fórmula de respaldo del propio documento para terreno normal
    (altura del poste en dm + 50 cm), confirmada contra los 6 renglones de la tabla.
    """
    TERRENO_CHOICES = [
        ("blando", "Blando — arena, arcilla suelta y arcilla con arena"),
        ("normal", "Normal — tierra común"),
        ("duro", "Duro — tepetate, grava y roca"),
    ]

    altura_poste_m = models.FloatField()
    resistencia_kg = models.PositiveIntegerField()
    tipo_terreno = models.CharField(max_length=10, choices=TERRENO_CHOICES)
    profundidad_cm = models.PositiveIntegerField()
    fuente = models.ForeignKey(SeccionNormativa, on_delete=models.PROTECT, related_name="reglas_empotramiento")
    verificado = models.BooleanField(
        default=False, help_text="True si un técnico confirmó el valor contra el PDF fuente"
    )
    notas = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["altura_poste_m", "tipo_terreno"]
        unique_together = [("altura_poste_m", "resistencia_kg", "tipo_terreno")]

    def __str__(self):
        return f"{self.altura_poste_m}m/{self.resistencia_kg}kg — {self.get_tipo_terreno_display()}: {self.profundidad_cm}cm"


class TipoEnsamble(models.Model):
    """
    Catálogo de ensambles de herrajes/retenidas/conductores/equipo (sección 04),
    identificados por su clave (ej. 'H004'). Es la biblioteca de referencia de
    montajes citada desde los dibujos de cada estructura; el detalle gráfico vive
    en el PDF, aquí solo se cita título y fuente para poder enlazarlo.
    """
    SUBSECCION_CHOICES = [
        ("H0", "Herrajes"),
        ("R0", "Retenidas"),
        ("C0", "Conductores y cables"),
        ("E0", "Equipo"),
    ]

    codigo = models.CharField(max_length=10, unique=True, help_text="Ej. 'H004'")
    subseccion = models.CharField(max_length=2, choices=SUBSECCION_CHOICES)
    titulo = models.CharField(max_length=250)
    fuente = models.ForeignKey(SeccionNormativa, on_delete=models.PROTECT, related_name="ensambles")

    class Meta:
        ordering = ["subseccion", "codigo"]

    def __str__(self):
        return f"{self.codigo} — {self.titulo}"


class PrefijoEstructuraMT(models.Model):
    """
    Prefijo de familia de estructuras de media tensión (sección 05: T, P, R, A, D, V, C, H).
    Registro de referencia para cuando se digitalice el catálogo completo de
    estructuras (05 00 00, ~356 páginas) con sus alturas y posiciones reales de
    material — todavía no incluido, ver ReglaPosicionMaterial.
    """
    codigo = models.CharField(max_length=2, unique=True, help_text="Ej. 'T', 'P', 'R'...")
    nombre = models.CharField(max_length=100, help_text="Ej. 'Estructuras tipo T'")
    fuente = models.ForeignKey(SeccionNormativa, on_delete=models.PROTECT, related_name="prefijos_estructura")

    class Meta:
        ordering = ["codigo"]

    def __str__(self):
        return f"{self.codigo} — {self.nombre}"


class EstructuraMT(models.Model):
    """
    Catálogo real de estructuras de media tensión (sección 05), identificadas por
    su código de codificación oficial CFE (ej. 'TS3N', 'PD2'). Es la fuente de
    verdad de las reglas de construcción, con trazabilidad a la sección/página
    exacta del documento.

    En este proyecto (LineSimulatorAlter) cada `catalogo.EstructuraCFE` se enlaza
    con su regla vía `EstructuraCFE.estructura_mt`: EstructuraCFE aporta lo visual
    (SVG, ícono de mapa, BOM comercial) y EstructuraMT aporta la normativa.
    """
    CATEGORIA_CHOICES = [
        ("paso_simple", "Paso simple"),
        ("paso_doble", "Paso doble / deflexión moderada"),
        ("deflexion", "Deflexión"),
        ("remate", "Remate"),
        ("anclaje", "Anclaje en línea"),
        ("subestacion", "Entrada/salida de subestación"),
    ]

    codigo = models.CharField(max_length=20, unique=True, help_text="Ej. 'TS3N', 'PD2'...")
    prefijo = models.ForeignKey(PrefijoEstructuraMT, on_delete=models.PROTECT, related_name="estructuras")
    nombre = models.CharField(max_length=150, blank=True)
    categoria = models.CharField(max_length=20, choices=CATEGORIA_CHOICES, blank=True)
    angulo_min = models.FloatField(null=True, blank=True, help_text="Grados. Vacío si no aplica.")
    angulo_max = models.FloatField(null=True, blank=True, help_text="Grados. Vacío si no aplica.")
    es_terminal = models.BooleanField(default=False)
    descripcion = models.TextField(blank=True)
    fuente = models.ForeignKey(SeccionNormativa, on_delete=models.PROTECT, related_name="estructuras")
    verificado = models.BooleanField(
        default=False, help_text="True si un técnico confirmó los datos contra el PDF fuente"
    )

    class Meta:
        ordering = ["prefijo", "codigo"]
        verbose_name = "Estructura de media tensión"
        verbose_name_plural = "Estructuras de media tensión"

    def __str__(self):
        return f"{self.codigo} — {self.nombre}" if self.nombre else self.codigo


class ComponenteMecanico(models.Model):
    """
    Postes y crucetas con su resistencia mecánica de trabajo (sección 05 00 03,
    hoja 5) — usados para validar qué componente soporta la carga de una
    estructura. Datos verificados: coinciden en dos extracciones independientes
    del PDF (tabla y texto narrativo de la misma página).
    """
    TIPO_CHOICES = [("poste", "Poste"), ("cruceta", "Cruceta")]

    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    clave = models.CharField(max_length=30, help_text="Ej. 'PC-11-700', 'PV-200'")
    carga_ruptura_kg = models.FloatField(null=True, blank=True)
    resistencia_fibra_kg_cm2 = models.FloatField(null=True, blank=True)
    limite_fluencia_kg_cm2 = models.FloatField(null=True, blank=True)
    factor_seguridad = models.FloatField()
    resistencia_trabajo_kg = models.FloatField()
    fuente = models.ForeignKey(SeccionNormativa, on_delete=models.PROTECT, related_name="componentes_mecanicos")
    verificado = models.BooleanField(default=True)

    class Meta:
        ordering = ["tipo", "clave"]
        unique_together = [("tipo", "clave")]

    def __str__(self):
        return f"{self.tipo.upper()} {self.clave} — {self.resistencia_trabajo_kg}kg"


class ReglaPosicionMaterial(models.Model):
    """
    Qué material lleva cada estructura (cantidad y condición — lo que antes
    cubría catalogo.EstructuraMaterial) y dónde va en el eje vertical del poste.
    Es la base para el futuro editor de diagramas de poste del frontend.
    Todavía sin poblar con datos reales de la sección 05 (catálogo completo de
    estructuras) — el esquema queda listo para irse llenando sin tener que
    rediseñar el modelo.

    `posicion_relativa_a` permite modelar dependencias como "el aislador pedestal
    cuelga del extremo de la cruceta": en vez de una altura fija e independiente,
    su posición se calcula relativa a la posición de otro material del mismo poste.
    """
    tipo_estructura = models.ForeignKey(
        EstructuraMT, on_delete=models.CASCADE, related_name="materiales",
        null=True, blank=True,
    )
    material = models.ForeignKey(
        "catalogo.Material", on_delete=models.PROTECT, related_name="reglas_posicion",
        null=True, blank=True,
    )
    ensamble = models.ForeignKey(
        TipoEnsamble, on_delete=models.SET_NULL, related_name="reglas_posicion",
        null=True, blank=True, help_text="Ensamble de la sección 04 que describe este montaje, si aplica",
    )
    posicion_relativa_a = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="dependientes",
        help_text="Si este material se posiciona en función de otro (ej. aislador respecto a la cruceta)",
    )
    descripcion = models.CharField(max_length=200, blank=True)
    cantidad = models.FloatField(default=1)
    condicion = models.CharField(
        max_length=200, blank=True, help_text="Ej. 'solo si 3F-4H', 'por conductor', 'según ensamble'"
    )
    cantidad_estimada = models.BooleanField(
        default=False, help_text="True si la cantidad es un supuesto y debe validarse contra catálogo real"
    )
    altura_min_m = models.FloatField(null=True, blank=True)
    altura_max_m = models.FloatField(null=True, blank=True)
    offset_relativo_m = models.FloatField(
        null=True, blank=True,
        help_text="Desplazamiento en metros respecto a 'posicion_relativa_a', si aplica",
    )
    fuente = models.ForeignKey(
        SeccionNormativa, on_delete=models.PROTECT, related_name="reglas_posicion_material",
        null=True, blank=True,
    )
    verificado = models.BooleanField(default=False)
    notas = models.TextField(blank=True)

    class Meta:
        ordering = ["tipo_estructura", "altura_min_m"]

    def __str__(self):
        objetivo = self.material.nombre if self.material else (self.descripcion or "material")
        tipo = self.tipo_estructura.codigo if self.tipo_estructura else "?"
        return f"{tipo}: {objetivo}"
