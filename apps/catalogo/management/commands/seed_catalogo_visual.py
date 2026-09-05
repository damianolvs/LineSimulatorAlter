# apps/catalogo/management/commands/seed_catalogo_visual.py
from django.core.management.base import BaseCommand

from apps.catalogo.models import ComponenteVisual, SlotAnclaje


class Command(BaseCommand):
    help = "Crea el catálogo visual mínimo (cruceta + aislador pin) para probar resolver_layout_poste."

    def handle(self, *args, **options):
        cruceta, _ = ComponenteVisual.objects.update_or_create(
            codigo="cruceta",
            defaults=dict(nombre="Cruceta", ancho_px=120, alto_px=16, z_index=1),
        )
        aislador, _ = ComponenteVisual.objects.update_or_create(
            codigo="aislador_pin",
            defaults=dict(nombre="Aislador tipo pin", ancho_px=20, alto_px=30, z_index=2),
        )

        slot_cruceta, _ = SlotAnclaje.objects.update_or_create(
            codigo="cruceta_1", defaults=dict(nombre="Cruceta", x_local=100, y_local=130)
        )
        slot_cruceta.componentes_compatibles.set([cruceta])

        posiciones_aisladores = [
            ("aislador_izq", 60),
            ("aislador_centro", 100),
            ("aislador_der", 140),
        ]
        for codigo, x in posiciones_aisladores:
            slot, _ = SlotAnclaje.objects.update_or_create(
                codigo=codigo,
                defaults=dict(nombre=codigo.replace("_", " ").title(), x_local=x, y_local=110),
            )
            slot.componentes_compatibles.set([aislador])

        self.stdout.write(self.style.SUCCESS("Catálogo visual sembrado: 2 componentes, 4 slots."))