# apps/catalogo/models.py
from django.db import models


class EstructuraCFE(models.Model):
    codigo = models.SlugField(max_length=20, unique=True)
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField(blank=True)
    es_paso_estandar = models.BooleanField(
        default=False,
        help_text="Marca esta estructura como la que usan los postes de paso generados automáticamente (según CFE: 12m, cruceta PT/PR, 3 aisladores de porcelana). Debe haber exactamente una."
    )

    class Meta:
        verbose_name = "Estructura CFE"
        verbose_name_plural = "Estructuras CFE"
        ordering = ["codigo"]

    def __str__(self):
        return f"{self.codigo} — {self.nombre}"


class Material(models.Model):
    """Un ítem del catálogo de materiales (aislador, cruceta, conductor, etc.)."""

    class Unidad(models.TextChoices):
        PIEZA = "PZA", "Pieza"
        METRO = "M", "Metro"
        KILOGRAMO = "KG", "Kilogramo"
        LOTE = "LOTE", "Lote"

    codigo = models.SlugField(max_length=50, unique=True)
    nombre = models.CharField(max_length=150)
    unidad = models.CharField(max_length=10, choices=Unidad.choices, default=Unidad.PIEZA)
    cantidad_estimada = models.BooleanField(
        default=False,
        help_text="Marca si la cantidad requerida aún necesita validarse contra catálogo real de proveedor."
    )

    class Meta:
        verbose_name = "Material"
        verbose_name_plural = "Materiales"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class EstructuraCFEMaterial(models.Model):
    """Cuánto de un material requiere una estructura CFE (para generar el BOM)."""
    estructura = models.ForeignKey(EstructuraCFE, related_name="materiales", on_delete=models.CASCADE)
    material = models.ForeignKey(Material, related_name="estructuras", on_delete=models.PROTECT)
    cantidad = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        verbose_name = "Material por estructura"
        verbose_name_plural = "Materiales por estructura"
        unique_together = [("estructura", "material")]

    def __str__(self):
        return f"{self.estructura.codigo} · {self.material.nombre} × {self.cantidad}"


class Modulo(models.Model):
    """Accesorio condicional que se agrega a un poste sin ser parte de la estructura base
    (retenida, derivación, sistema de tierra, transformador, seccionamiento)."""
    codigo = models.SlugField(max_length=50, unique=True)
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField(blank=True)

    class Meta:
        verbose_name = "Módulo"
        verbose_name_plural = "Módulos"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class ModuloMaterial(models.Model):
    """Cuánto de un material requiere un módulo (para generar el BOM)."""
    modulo = models.ForeignKey(Modulo, related_name="materiales", on_delete=models.CASCADE)
    material = models.ForeignKey(Material, related_name="modulos", on_delete=models.PROTECT)
    cantidad = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        verbose_name = "Material por módulo"
        verbose_name_plural = "Materiales por módulo"
        unique_together = [("modulo", "material")]

    def __str__(self):
        return f"{self.modulo.codigo} · {self.material.nombre} × {self.cantidad}"


class ComponenteVisual(models.Model):
    """
    Un accesorio dibujable que puede colocarse sobre un poste
    (cruceta, aislador, transformador, retenida, etc.).
    Cada uno corresponde a un <symbol> dentro del sprite SVG del frontend.
    """
    codigo = models.SlugField(
        max_length=50,
        unique=True,
        help_text="Debe coincidir con el id del <symbol> en el sprite SVG (ej. 'cruceta', 'aislador_pin')."
    )
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField(blank=True)

    ancho_px = models.PositiveSmallIntegerField(
        help_text="Ancho del símbolo en el sistema de coordenadas local del poste."
    )
    alto_px = models.PositiveSmallIntegerField(
        help_text="Alto del símbolo en el sistema de coordenadas local del poste."
    )
    z_index = models.PositiveSmallIntegerField(
        default=0,
        help_text="Orden de dibujo: valores mayores se dibujan encima."
    )
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Componente visual"
        verbose_name_plural = "Componentes visuales"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class SlotAnclaje(models.Model):
    """
    Punto de anclaje predefinido en el sistema de coordenadas local del poste
    (ej. 'tope', 'cruceta_1', 'punto_retenida'). El resolver de layout lo usa
    como posición por defecto y como referencia de "snap" al editar manualmente.
    """
    codigo = models.SlugField(max_length=50, unique=True)
    nombre = models.CharField(max_length=100)

    x_local = models.FloatField(help_text="Coordenada X en el sistema local del poste (ej. viewBox 300x1200).")
    y_local = models.FloatField(help_text="Coordenada Y en el sistema local del poste.")

    componentes_compatibles = models.ManyToManyField(
        ComponenteVisual,
        related_name="slots_compatibles",
        blank=True,
        help_text="Tipos de componente que pueden ocupar este slot."
    )

    class Meta:
        verbose_name = "Slot de anclaje"
        verbose_name_plural = "Slots de anclaje"
        ordering = ["codigo"]

    def __str__(self):
        return self.nombre