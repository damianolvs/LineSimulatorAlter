# apps/proyectos/models.py
from django.contrib.gis.db import models as gis_models
from django.core.exceptions import ValidationError
from django.db import models


class Proyecto(models.Model):
    """Un proyecto de línea de media tensión, contenedor de tramos."""
    nombre = models.CharField(max_length=150)
    ubicacion = models.CharField(max_length=200, blank=True)
    descripcion = models.TextField(blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Proyecto"
        verbose_name_plural = "Proyectos"
        ordering = ["-creado_en"]

    def __str__(self):
        return self.nombre


class Tramo(models.Model):
    proyecto = models.ForeignKey(Proyecto, related_name="tramos", on_delete=models.CASCADE)
    nombre = models.CharField(max_length=150, blank=True)
    geom = gis_models.LineStringField(srid=4326, null=True, blank=True)
    vano_maximo = models.FloatField(
        default=109.0,
        help_text="Distancia máxima en metros entre postes consecutivos. Estándar CFE: 109 m, ajustable por proyecto."
    )

    class Meta:
        verbose_name = "Tramo"
        verbose_name_plural = "Tramos"

    def __str__(self):
        return self.nombre or f"Tramo {self.pk}"


class Poste(models.Model):
    """Un poste dentro de un tramo, ya sea colocado por el usuario (ancla) o generado automáticamente (paso)."""
    tramo = models.ForeignKey(Tramo, related_name="postes", on_delete=models.CASCADE)
    estructura = models.ForeignKey(
        "catalogo.EstructuraCFE", related_name="postes", on_delete=models.PROTECT
    )
    orden = models.PositiveIntegerField(help_text="Posición del poste dentro de la secuencia del tramo.")
    es_ancla = models.BooleanField(
        default=False,
        help_text="True si el usuario lo colocó deliberadamente; False si se generó automáticamente como poste de paso."
    )
    geom = gis_models.PointField(srid=4326)

    class Meta:
        verbose_name = "Poste"
        verbose_name_plural = "Postes"
        ordering = ["tramo", "orden"]
        unique_together = [("tramo", "orden")]

    def __str__(self):
        return f"Poste {self.orden} — {self.tramo}"

    @property
    def angulo_deflexion(self):
        """
        Ángulo de deflexión respecto a los postes vecinos, calculado al vuelo
        (no persistido). La implementación real vive en apps/proyectos/services.py
        y usa pyproj para proyectar a UTM 13N antes de calcular el ángulo.
        """
        from .services import calcular_angulo_deflexion
        return calcular_angulo_deflexion(self)


class Vano(models.Model):
    """El espacio entre dos postes consecutivos (por 'orden') dentro del mismo tramo."""
    poste_inicio = models.ForeignKey(Poste, related_name="vanos_como_inicio", on_delete=models.CASCADE)
    poste_fin = models.ForeignKey(Poste, related_name="vanos_como_fin", on_delete=models.CASCADE)
    distancia = models.FloatField(help_text="Distancia en metros, calculada vía pyproj (UTM 13N).")
    flecha = models.FloatField(null=True, blank=True, help_text="Flecha del conductor, pendiente de cálculo.")

    class Meta:
        verbose_name = "Vano"
        verbose_name_plural = "Vanos"
        unique_together = [("poste_inicio", "poste_fin")]

    def clean(self):
        if self.poste_inicio.tramo_id != self.poste_fin.tramo_id:
            raise ValidationError("poste_inicio y poste_fin deben pertenecer al mismo tramo.")

    def __str__(self):
        return f"Vano {self.poste_inicio.orden}→{self.poste_fin.orden} ({self.poste_inicio.tramo})"


class PosteModulo(models.Model):
    """Un módulo condicional (retenida, transformador, etc.) asignado a un poste, con cantidad."""
    poste = models.ForeignKey(Poste, related_name="modulos", on_delete=models.CASCADE)
    modulo = models.ForeignKey("catalogo.Modulo", related_name="postes", on_delete=models.PROTECT)
    cantidad = models.PositiveSmallIntegerField(default=1)

    class Meta:
        verbose_name = "Módulo de poste"
        verbose_name_plural = "Módulos de poste"
        unique_together = [("poste", "modulo")]

    def __str__(self):
        return f"{self.poste} · {self.modulo.nombre} × {self.cantidad}"


class PosteComponente(models.Model):
    """Una instancia de accesorio visual colocado en un poste específico, en modo auto o manual."""

    class Modo(models.TextChoices):
        AUTO = "auto", "Automático"
        MANUAL = "manual", "Manual"

    poste = models.ForeignKey(Poste, related_name="componentes", on_delete=models.CASCADE)
    componente_visual = models.ForeignKey(
        "catalogo.ComponenteVisual", related_name="instancias", on_delete=models.PROTECT
    )
    slot = models.ForeignKey(
        "catalogo.SlotAnclaje", null=True, blank=True, related_name="ocupantes", on_delete=models.SET_NULL
    )
    modo = models.CharField(max_length=6, choices=Modo.choices, default=Modo.AUTO)

    x = models.FloatField()
    y = models.FloatField()
    rotacion = models.FloatField(default=0)
    espejo = models.BooleanField(default=False)
    orden_z = models.PositiveSmallIntegerField(default=0)

    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Componente de poste"
        verbose_name_plural = "Componentes de poste"
        ordering = ["orden_z"]

    def __str__(self):
        return f"{self.poste} · {self.componente_visual.nombre} ({self.modo})"