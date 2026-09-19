# apps/catalogo/management/commands/seed_catalogo_visual.py
from django.core.management.base import BaseCommand
from apps.catalogo.models import ComponenteVisual, SlotAnclaje


from django.core.management.base import BaseCommand

from apps.catalogo.models import ComponenteVisual, SlotAnclaje


class Command(BaseCommand):
    help = "Crea el catálogo visual (herrajes de poste) para probar resolver_layout_poste."

    def handle(self, *args, **options):
        cruceta, _ = ComponenteVisual.objects.update_or_create(
            codigo="cruceta",
            defaults=dict(nombre="Cruceta", ancho_px=84, alto_px=16, z_index=1),
        )
        aislador, _ = ComponenteVisual.objects.update_or_create(
            codigo="aislador_pin",
            defaults=dict(nombre="Aislador tipo pin", ancho_px=7, alto_px=12, z_index=3),
        )
        ComponenteVisual.objects.update_or_create(
            codigo="aislador_set_3",
            defaults=dict(nombre="Set de 3 aisladores tipo pin", ancho_px=25, alto_px=12, z_index=3),
        )
        ComponenteVisual.objects.update_or_create(
            codigo="aislador_remate",
            defaults=dict(nombre="Aislador de remate (polimérico)", ancho_px=17, alto_px=4, z_index=3),
        )
        ComponenteVisual.objects.update_or_create(
            codigo="cortacircuito_fusible",
            defaults=dict(nombre="Cortacircuito fusible", ancho_px=9, alto_px=23, z_index=2),
        )
        ComponenteVisual.objects.update_or_create(
            codigo="retenida_ancla",
            defaults=dict(nombre="Retenida + ancla (8 m estándar)", ancho_px=30, alto_px=64, z_index=0),
        )
        ComponenteVisual.objects.update_or_create(
            codigo="riostra_secundaria",
            defaults=dict(nombre="Riostra secundaria (carretes)", ancho_px=9, alto_px=19, z_index=2),
        )
        ComponenteVisual.objects.update_or_create(
            codigo="apartarrayos",
            defaults=dict(nombre="Apartarrayos", ancho_px=7, alto_px=15, z_index=2),
        )
        ComponenteVisual.objects.update_or_create(
            codigo="transformador",
            defaults=dict(nombre="Transformador con boquilla", ancho_px=21, alto_px=29, z_index=1),
        )

        # --- Slots (sin cambios: solo cruceta + 3 aisladores participan en resolver_layout_poste) ---
        slot_cruceta, _ = SlotAnclaje.objects.update_or_create(
            codigo="cruceta_1", defaults=dict(nombre="Cruceta", x_local=100, y_local=130)
        )
        slot_cruceta.componentes_compatibles.set([cruceta])

        posiciones_aisladores = [
            ("aislador_izq", 60), ("aislador_centro", 100), ("aislador_der", 140),
        ]
        for codigo, x in posiciones_aisladores:
            slot, _ = SlotAnclaje.objects.update_or_create(
                codigo=codigo,
                defaults=dict(nombre=codigo.replace("_", " ").title(), x_local=x, y_local=110),
            )
            slot.componentes_compatibles.set([aislador])

        self.stdout.write(self.style.SUCCESS("Catálogo visual sembrado: 9 componentes, 4 slots."))