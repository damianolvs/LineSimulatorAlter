# apps/proyectos/tests.py
from django.core.management import call_command
from rest_framework.test import APITestCase

from apps.catalogo.models import Conductor, EstructuraCFE

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

    def test_agregar_postes_por_coordenadas_crea_anclas_en_orden(self):
        tramo_id = self._crear_proyecto()["tramo_ids"][0]
        estructura_id = EstructuraCFE.objects.get(codigo="TS3N").id
        resp = self.client.post(
            f"/api/proyectos/tramos/{tramo_id}/agregar-postes/",
            {"estructura_id": estructura_id, "puntos": [[-106.0, 28.6], [-105.99, 28.61]]},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertEqual(resp.json()["creados"], 2)
        postes = list(Poste.objects.filter(tramo_id=tramo_id).order_by("orden"))
        self.assertEqual([p.orden for p in postes], [1, 2])
        self.assertTrue(all(p.es_ancla and p.componentes.count() == 4 for p in postes))
        self.assertEqual(postes[1].geom.coords, (-105.99, 28.61))
        self.assertEqual(Tramo.objects.get(pk=tramo_id).geom.num_points, 2)

        # Un segundo lote continúa la numeración.
        self.client.post(
            f"/api/proyectos/tramos/{tramo_id}/agregar-postes/",
            {"estructura_id": estructura_id, "puntos": [[-105.98, 28.62]]}, format="json",
        )
        self.assertEqual(Poste.objects.filter(tramo_id=tramo_id).order_by("orden").last().orden, 3)

    def test_agregar_postes_por_coordenadas_es_todo_o_nada(self):
        tramo_id = self._crear_proyecto()["tramo_ids"][0]
        estructura_id = EstructuraCFE.objects.get(codigo="TS3N").id
        resp = self.client.post(
            f"/api/proyectos/tramos/{tramo_id}/agregar-postes/",
            {"estructura_id": estructura_id, "puntos": [[-106.0, 28.6], [-468.7, 28.6]]},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("punto 2", str(resp.json()))
        self.assertFalse(Poste.objects.filter(tramo_id=tramo_id).exists())

    def test_mover_poste_de_paso_lo_vuelve_ancla_y_sobrevive_a_regenerar(self):
        tramo_id = self._crear_proyecto(vano_maximo=100)["tramo_ids"][0]
        ts3n = EstructuraCFE.objects.get(codigo="TS3N")
        for lng in (-106.0, -105.99):
            self.client.post("/api/proyectos/postes/", _feature(tramo_id, ts3n.id, lng, 28.6, es_ancla=True), format="json")
        self.client.post(f"/api/proyectos/tramos/{tramo_id}/generar-postes-de-paso/", {"estructura_id": ts3n.id}, format="json")

        paso = Poste.objects.filter(tramo_id=tramo_id, es_ancla=False).order_by("orden").first()
        resp = self.client.patch(
            f"/api/proyectos/postes/{paso.id}/",
            {"geometry": {"type": "Point", "coordinates": [-105.9975, 28.6003]}, "properties": {}},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        paso.refresh_from_db()
        self.assertTrue(paso.es_ancla)

        self.client.post(f"/api/proyectos/tramos/{tramo_id}/generar-postes-de-paso/", {"estructura_id": ts3n.id}, format="json")
        self.assertTrue(Poste.objects.filter(pk=paso.pk, es_ancla=True).exists())

    def test_editar_datos_sin_mover_no_cambia_el_tipo_de_poste(self):
        tramo_id = self._crear_proyecto(vano_maximo=100)["tramo_ids"][0]
        ts3n = EstructuraCFE.objects.get(codigo="TS3N")
        for lng in (-106.0, -105.99):
            self.client.post("/api/proyectos/postes/", _feature(tramo_id, ts3n.id, lng, 28.6, es_ancla=True), format="json")
        self.client.post(f"/api/proyectos/tramos/{tramo_id}/generar-postes-de-paso/", {"estructura_id": ts3n.id}, format="json")
        paso = Poste.objects.filter(tramo_id=tramo_id, es_ancla=False).first()
        self.client.patch(f"/api/proyectos/postes/{paso.id}/", {"properties": {"altura_m": 9, "resistencia_kg": 450}}, format="json")
        paso.refresh_from_db()
        self.assertFalse(paso.es_ancla)



class ValidacionesProyectoTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_catalogo_visual", verbosity=0)
        call_command("cargar_reglas_cfe", verbosity=0)

    def _proyecto_con_postes(self, puntos, estructuras, **extra):
        proyecto = self.client.post(
            "/api/proyectos/proyectos/", {"nombre": "Validación", **extra}, format="json"
        ).json()
        tramo_id = proyecto["tramo_ids"][0]
        for (lng, lat), codigo in zip(puntos, estructuras):
            estructura = EstructuraCFE.objects.get(codigo=codigo)
            resp = self.client.post(
                "/api/proyectos/postes/", _feature(tramo_id, estructura.id, lng, lat, es_ancla=True), format="json"
            )
            self.assertEqual(resp.status_code, 201, resp.content)
        return proyecto

    def _validar(self, proyecto):
        resp = self.client.get(f"/api/proyectos/proyectos/{proyecto['id']}/validaciones/")
        self.assertEqual(resp.status_code, 200, resp.content)
        return resp.json()

    @staticmethod
    def _codigos(resultado):
        return {p["codigo"] for p in resultado["problemas"]}

    def test_linea_correcta_no_tiene_errores_ni_advertencias(self):
        proyecto = self._proyecto_con_postes(
            [(-106.0, 28.6), (-105.9995, 28.6), (-105.999, 28.6)], ["RD3N", "TS3N", "RD3N"]
        )
        resultado = self._validar(proyecto)
        self.assertEqual(resultado["resumen"]["errores"], 0)
        self.assertEqual(resultado["resumen"]["advertencias"], 0)

    def test_vano_mayor_al_maximo_del_tramo(self):
        proyecto = self._proyecto_con_postes([(-106.0, 28.6), (-105.99, 28.6)], ["RD3N", "RD3N"], vano_maximo=100)
        self.assertIn("vano_excede_maximo", self._codigos(self._validar(proyecto)))

    def test_postes_duplicados_son_error(self):
        proyecto = self._proyecto_con_postes([(-106.0, 28.6), (-106.0, 28.6)], ["RD3N", "RD3N"])
        resultado = self._validar(proyecto)
        self.assertGreaterEqual(resultado["resumen"]["errores"], 1)
        self.assertIn("postes_muy_cercanos", self._codigos(resultado))

    def test_deflexion_fuerte_con_estructura_de_paso_simple(self):
        # Giro de ~90° en el poste 2 con una estructura tangente.
        proyecto = self._proyecto_con_postes(
            [(-106.0, 28.6), (-105.9995, 28.6), (-105.9995, 28.6005)], ["RD3N", "TS3N", "RD3N"]
        )
        problema = next(p for p in self._validar(proyecto)["problemas"] if p["codigo"] == "deflexion_excede_categoria")
        self.assertEqual(problema["orden"], 2)

    def test_deflexion_fuera_del_rango_capturado_es_error(self):
        proyecto = self._proyecto_con_postes(
            [(-106.0, 28.6), (-105.9995, 28.6), (-105.9995, 28.6005)], ["RD3N", "TS3N", "RD3N"]
        )
        ts3n = EstructuraCFE.objects.get(codigo="TS3N").estructura_mt
        ts3n.angulo_min, ts3n.angulo_max = 0, 10
        ts3n.save()
        resultado = self._validar(proyecto)
        self.assertIn("deflexion_fuera_de_rango", self._codigos(resultado))
        self.assertGreaterEqual(resultado["resumen"]["errores"], 1)

    def test_remate_en_medio_de_la_linea(self):
        proyecto = self._proyecto_con_postes(
            [(-106.0, 28.6), (-105.9995, 28.6), (-105.999, 28.6)], ["RD3N", "RD3N", "RD3N"]
        )
        problema = next(p for p in self._validar(proyecto)["problemas"] if p["codigo"] == "remate_intermedio")
        self.assertEqual(problema["orden"], 2)

    def test_extremo_sin_remate_e_info_de_estructura_sin_reglas(self):
        EstructuraCFE.objects.create(codigo="sin-reglas", nombre="Sin reglas")
        proyecto = self._proyecto_con_postes([(-106.0, 28.6), (-105.9995, 28.6)], ["TS3N", "sin-reglas"])
        codigos = self._codigos(self._validar(proyecto))
        self.assertIn("extremo_sin_remate", codigos)
        self.assertIn("estructura_sin_reglas", codigos)

    def test_tramo_con_un_solo_poste_esta_incompleto(self):
        proyecto = self._proyecto_con_postes([(-106.0, 28.6)], ["RD3N"])
        self.assertIn("tramo_incompleto", self._codigos(self._validar(proyecto)))


class ConductorYFlechaTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_catalogo_visual", verbosity=0)
        call_command("cargar_reglas_cfe", verbosity=0)
        call_command("seed_conductores", verbosity=0)

    def _tramo_con_postes(self, longitudes_lng=(-106.0, -105.999, -105.998)):
        proyecto = self.client.post("/api/proyectos/proyectos/", {"nombre": "Flecha"}, format="json").json()
        tramo_id = proyecto["tramo_ids"][0]
        estructura_id = EstructuraCFE.objects.get(codigo="TS3N").id
        for lng in longitudes_lng:
            self.client.post("/api/proyectos/postes/", _feature(tramo_id, estructura_id, lng, 28.6), format="json")
        return tramo_id

    def test_catalogo_de_conductores(self):
        conductores = self.client.get("/api/catalogo/conductores/").json()
        self.assertGreaterEqual(len(conductores), 5)
        self.assertTrue(all(not c["verificado"] for c in conductores))

    def test_sin_conductor_no_hay_flechas(self):
        tramo_id = self._tramo_con_postes()
        self.assertEqual(self.client.get(f"/api/proyectos/tramos/{tramo_id}/flechas/").status_code, 404)

    def test_asignar_conductor_y_calcular_flechas(self):
        tramo_id = self._tramo_con_postes()
        linnet = Conductor.objects.get(codigo="acsr-336-4-linnet")
        resp = self.client.patch(
            f"/api/proyectos/tramos/{tramo_id}/", {"properties": {"conductor": linnet.id}}, format="json"
        )
        self.assertEqual(resp.status_code, 200, resp.content)

        datos = self.client.get(f"/api/proyectos/tramos/{tramo_id}/flechas/").json()
        self.assertEqual(datos["conductor"], "ACSR 336.4 Linnet")
        self.assertEqual(len(datos["vanos"]), 2)
        self.assertAlmostEqual(datos["tension_eds_kg"], 0.2 * 6396, places=0)
        # En caliente el cable se afloja: menos tensión que en EDS y flecha mayor que la de EDS.
        self.assertLess(datos["tension_kg"], datos["tension_eds_kg"])
        vano = datos["vanos"][0]
        flecha_eds = linnet.peso_kg_m * vano["distancia_m"] ** 2 / (8 * datos["tension_eds_kg"])
        self.assertGreater(vano["flecha_m"], flecha_eds)

    def test_generar_vanos_guarda_la_flecha(self):
        tramo_id = self._tramo_con_postes()
        Tramo.objects.filter(pk=tramo_id).update(conductor=Conductor.objects.get(codigo="acsr-1-0-raven"))
        vanos = self.client.post(f"/api/proyectos/tramos/{tramo_id}/generar-vanos/").json()
        self.assertTrue(all(v["flecha"] > 0 for v in vanos))

    def test_validacion_avisa_tramo_sin_conductor(self):
        tramo_id = self._tramo_con_postes()
        proyecto_id = Tramo.objects.get(pk=tramo_id).proyecto_id
        resultado = self.client.get(f"/api/proyectos/proyectos/{proyecto_id}/validaciones/").json()
        self.assertIn("tramo_sin_conductor", {p["codigo"] for p in resultado["problemas"]})
