from django.core.management.base import BaseCommand

from apps.catalogo.models import Conductor

# Valores típicos de catálogo de conductores ACSR (peso, diámetro y carga de ruptura de tablas
# comerciales; módulo y dilatación finales aproximados). Se cargan SIN verificar: confirmar
# contra la ficha del fabricante o la especificación CFE antes de usarlos en un diseño real.
CONDUCTORES = [
    # codigo, nombre, calibre, formación, sección mm², diámetro mm, kg/m, ruptura kg, E kg/mm², α 1/°C
    ("acsr-1-0-raven", "ACSR 1/0 Raven", "1/0 AWG", "6/1", 62.4, 10.11, 0.216, 1987, 8100, 19.1e-6),
    ("acsr-3-0-pigeon", "ACSR 3/0 Pigeon", "3/0 AWG", "6/1", 99.3, 12.75, 0.342, 3003, 8100, 19.1e-6),
    ("acsr-266-8-partridge", "ACSR 266.8 Partridge", "266.8 kcmil", "26/7", 157.2, 16.31, 0.545, 5126, 7730, 18.9e-6),
    ("acsr-336-4-linnet", "ACSR 336.4 Linnet", "336.4 kcmil", "26/7", 198.3, 18.29, 0.689, 6396, 7730, 18.9e-6),
    ("acsr-477-hawk", "ACSR 477 Hawk", "477 kcmil", "26/7", 281.0, 21.79, 0.976, 8845, 7730, 18.9e-6),
]


class Command(BaseCommand):
    help = "Carga el catálogo inicial de conductores ACSR (sin verificar)."

    def handle(self, *args, **options):
        for codigo, nombre, calibre, formacion, seccion, diametro, peso, ruptura, modulo, alfa in CONDUCTORES:
            Conductor.objects.update_or_create(
                codigo=codigo,
                defaults=dict(
                    nombre=nombre, material=Conductor.Material.ACSR, calibre=calibre, formacion=formacion,
                    seccion_mm2=seccion, diametro_mm=diametro, peso_kg_m=peso, carga_ruptura_kg=ruptura,
                    modulo_elasticidad_kg_mm2=modulo, coef_dilatacion_c=alfa,
                ),
            )
        self.stdout.write(self.style.SUCCESS(f"{len(CONDUCTORES)} conductores cargados."))
