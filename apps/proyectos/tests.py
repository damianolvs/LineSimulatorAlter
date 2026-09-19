# apps/proyectos/tests.py
from django.core.management import call_command
from rest_framework.test import APITestCase

from apps.catalogo.models import EstructuraCFE

from .models import Poste, PosteComponente, Tramo


def _feature(tramo_id, estructura_id, lng, lat, **propiedades):
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lng, lat]},
        "properties": {"tramo": tramo_id, "estructura_id": estructura_id, **propiedades},
    }


class FlujoProyectoTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_catalogo_visual", verbosity=0)
        call_command("cargar_reglas_cfe", verbosity=0)

    def _crear_proyecto(self, **extra):
        resp = self.client.post("/api/proyectos/proyectos/", {"nombre": "Línea norte", **extra}, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        return resp.json()

    def test_crear_proyecto_crea_primer_tramo_con_vano_indicado(self):
        proyecto = self._crear_proyecto(ubicacion="Chihuahua", vano_maximo=80)
        self.assertEqual(len(proyecto["tramo_ids"]), 1)
        self.assertEqual(Tramo.objects.get(pk=proyecto["tramo_ids"][0]).vano_maximo, 80)

    def test_crear_proyecto_usa_vano_estandar_por_defecto(self):
        proyecto = self._crear_proyecto()
        self.assertEqual(Tramo.objects.get(pk=proyecto["tramo_ids"][0]).vano_maximo, 109.0)

    def test_poste_nuevo_recibe_orden_y_componentes_de_sus_reglas(self):
        tramo_id = self._crear_proyecto()["tramo_ids"][0]
        estructura = EstructuraCFE.objects.get(codigo="TS3N")

        resp = self.client.post(
            "/api/proyectos/postes/",
            _feature(tramo_id, estructura.id, -106.0, 28.6, es_ancla=True, altura_m=12, resistencia_kg=750),
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        props = resp.json()["properties"]
        self.assertEqual(props["orden"], 1)
        self.assertEqual(props["empotramiento_cm"], 170)  # 12 m, terreno normal (03 00 02)

        codigos = sorted(c["componente_visual_codigo"] for c in props["componentes"])
        self.assertEqual(codigos, ["aislador_pin"] * 3 + ["cruceta"])
        cruceta = next(c for c in props["componentes"] if c["componente_visual_codigo"] == "cruceta")
        self.assertAlmostEqual(cruceta["y"], 0.2 * 42)  # 0.20 m desde la punta
        self.assertTrue(all(c["modo"] == "auto" and c["regla_origen"] for c in props["componentes"]))

    def test_dos_postes_forman_la_linea_del_tramo(self):
        tramo_id = self._crear_proyecto()["tramo_ids"][0]
        estructura_id = EstructuraCFE.objects.get(codigo="TS3N").id
        for lng in (-106.0, -105.99):
            self.client.post("/api/proyectos/postes/", _feature(tramo_id, estructura_id, lng, 28.6), format="json")

        tramo = Tramo.objects.get(pk=tramo_id)
        self.assertEqual(tramo.geom.num_points, 2)
        self.assertEqual(list(tramo.postes.values_list("orden", flat=True)), [1, 2])

    def test_cambiar_estructura_reemplaza_auto_y_respeta_manual(self):
        tramo_id = self._crear_proyecto()["tramo_ids"][0]
        ts3n = EstructuraCFE.objects.get(codigo="TS3N")
        rd3n = EstructuraCFE.objects.get(codigo="RD3N")
        resp = self.client.post("/api/proyectos/postes/", _feature(tramo_id, ts3n.id, -106.0, 28.6), format="json")
        poste = Poste.objects.get(pk=resp.json()["properties"]["id"])

        aislador = poste.componentes.filter(componente_visual__codigo="aislador_pin").first()
        self.client.patch(
            f"/api/proyectos/postes/{poste.id}/componentes/{aislador.id}/", {"x": 55}, format="json"
        )
        self.assertEqual(PosteComponente.objects.get(pk=aislador.pk).modo, "manual")

        resp = self.client.patch(
            f"/api/proyectos/postes/{poste.id}/", {"properties": {"estructura_id": rd3n.id}}, format="json"
        )
        self.assertEqual(resp.status_code, 200, resp.content)

        modos = set(poste.componentes.values_list("modo", flat=True))
        self.assertEqual(modos, {"auto", "manual"})
        self.assertTrue(PosteComponente.objects.filter(pk=aislador.pk).exists())
        reglas_rd3n = set(rd3n.estructura_mt.materiales.values_list("pk", flat=True))
        for c in poste.componentes.filter(modo="auto"):
            self.assertIn(c.regla_origen_id, reglas_rd3n)

    def test_desglose_da_altura_sobre_piso_segun_terreno(self):
        tramo_id = self._crear_proyecto()["tramo_ids"][0]
        estructura_id = EstructuraCFE.objects.get(codigo="TS3N").id
        resp = self.client.post(
            "/api/proyectos/postes/", _feature(tramo_id, estructura_id, -106.0, 28.6, tipo_terreno="duro"), format="json"
        )
        poste_id = resp.json()["properties"]["id"]

        desglose = self.client.get(f"/api/proyectos/postes/{poste_id}/desglose/").json()
        self.assertEqual(desglose["estructura"], "TS3N")
        self.assertEqual(desglose["empotramiento_cm"], 150)
        cruceta = next(m for m in desglose["materiales"] if m["descripcion"] == "Cruceta")
        self.assertAlmostEqual(cruceta["altura_sobre_piso_m"], 12 - 1.5 - 0.2)

    def test_desglose_sin_reglas_normativas_responde_404(self):
        tramo_id = self._crear_proyecto()["tramo_ids"][0]
        sin_reglas = EstructuraCFE.objects.create(codigo="sin-reglas", nombre="Sin reglas")
        resp = self.client.post("/api/proyectos/postes/", _feature(tramo_id, sin_reglas.id, -106.0, 28.6), format="json")
        self.assertEqual(self.client.get(f"/api/proyectos/postes/{resp.json()['properties']['id']}/desglose/").status_code, 404)

    def test_generar_postes_de_paso_con_estructura_elegida(self):
        tramo_id = self._crear_proyecto(vano_maximo=100)["tramo_ids"][0]
        ts3n = EstructuraCFE.objects.get(codigo="TS3N")
        for lng in (-106.0, -105.99):  # ~1 km entre anclas
            self.client.post(
                "/api/proyectos/postes/", _feature(tramo_id, ts3n.id, lng, 28.6, es_ancla=True), format="json"
            )
        resp = self.client.post(
            f"/api/proyectos/tramos/{tramo_id}/generar-postes-de-paso/", {"estructura_id": ts3n.id}, format="json"
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        pasos = Poste.objects.filter(tramo_id=tramo_id, es_ancla=False)
        self.assertEqual(resp.json(), {"total": pasos.count() + 2, "pasos": pasos.count()})
        self.assertGreater(pasos.count(), 5)
        self.assertTrue(all(p.componentes.count() == 4 for p in pasos))  # cruceta + 3 aisladores

    def test_opciones_de_poste_salen_de_la_tabla_de_empotramiento(self):
        opciones = self.client.get("/api/reglas/opciones-poste/").json()
        doce = next(a for a in opciones["alturas"] if a["altura_m"] == 12)
        self.assertEqual(doce["resistencias_kg"], [750])
        self.assertEqual({t["codigo"] for t in opciones["terrenos"]}, {"blando", "normal", "duro"})

    def test_proyecto_guarda_estado_y_tension_y_calcula_longitud(self):
        proyecto = self._crear_proyecto(tension_kv=34.5)
        self.assertEqual(proyecto["estado"], "en_diseno")
        self.assertEqual(proyecto["tension_kv"], 34.5)
        self.assertEqual(proyecto["longitud_m"], 0)

        tramo_id = proyecto["tramo_ids"][0]
        estructura_id = EstructuraCFE.objects.get(codigo="TS3N").id
        for lng in (-106.0, -105.99):  # ~1 km en longitud a esta latitud
            self.client.post("/api/proyectos/postes/", _feature(tramo_id, estructura_id, lng, 28.6), format="json")

        actualizado = self.client.get(f"/api/proyectos/proyectos/{proyecto['id']}/").json()
        self.assertGreater(actualizado["longitud_m"], 900)
        self.assertEqual(actualizado["num_postes"], 2)
        resp = self.client.patch(f"/api/proyectos/proyectos/{proyecto['id']}/", {"estado": "aprobado"}, format="json")
        self.assertEqual(resp.json()["estado"], "aprobado")

    def test_materiales_del_proyecto_suman_las_reglas_de_cada_poste(self):
        proyecto = self._crear_proyecto()
        tramo_id = proyecto["tramo_ids"][0]
        ts3n = EstructuraCFE.objects.get(codigo="TS3N").id
        sin_reglas = EstructuraCFE.objects.create(codigo="sin-reglas", nombre="Sin reglas")
        for lng, estructura in ((-106.0, ts3n), (-105.995, ts3n), (-105.99, sin_reglas.id)):
            self.client.post("/api/proyectos/postes/", _feature(tramo_id, estructura, lng, 28.6), format="json")

        bom = self.client.get(f"/api/proyectos/proyectos/{proyecto['id']}/materiales/").json()
        self.assertEqual(bom["resumen"]["num_postes"], 3)
        self.assertEqual(bom["resumen"]["num_vanos"], 2)
        self.assertEqual(bom["postes"], [{"altura_m": 12.0, "resistencia_kg": 750, "cantidad": 3}])

        por_codigo = {m["codigo"]: m for m in bom["materiales"]}
        self.assertEqual(por_codigo["aislador-tipo-pin"]["cantidad"], 6)  # 3 por cada TS3N
        self.assertEqual(por_codigo["cruceta-c4t"]["cantidad"], 2)
        self.assertEqual([p["estructura"] for p in bom["sin_reglas"]], ["sin-reglas"])
        self.assertEqual(len(bom["por_poste"]), 2)

    def test_rechaza_postes_con_coordenadas_fuera_de_rango(self):
        tramo_id = self._crear_proyecto()["tramo_ids"][0]
        estructura_id = EstructuraCFE.objects.get(codigo="TS3N").id
        resp = self.client.post("/api/proyectos/postes/", _feature(tramo_id, estructura_id, -468.7, 39.7), format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(Poste.objects.filter(tramo_id=tramo_id).exists())

