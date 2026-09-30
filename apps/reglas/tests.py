# apps/reglas/tests.py
from django.core.management import call_command
from rest_framework.test import APITestCase


class CatalogoEstructurasTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_catalogo_visual", verbosity=0)
        call_command("cargar_reglas_cfe", verbosity=0)

    def test_estructura_trae_fuente_y_materiales_con_codigo(self):
        estructuras = self.client.get("/api/reglas/estructuras-mt/").json()
        ts3n = next(e for e in estructuras if e["codigo"] == "TS3N")
        self.assertEqual(ts3n["prefijo_codigo"], "T")
        self.assertTrue(ts3n["fuente_codigo"])
        pin = next(m for m in ts3n["materiales"] if m["material_codigo"] == "aislador-tipo-pin")
        self.assertEqual(pin["cantidad"], 3)
        self.assertTrue(pin["fuente_codigo"])

    def test_catalogo_de_materiales_y_prefijos(self):
        self.assertTrue(self.client.get("/api/catalogo/materiales/").json())
        prefijos = {p["codigo"] for p in self.client.get("/api/reglas/prefijos-estructura/").json()}
        self.assertLessEqual({"T", "R", "A"}, prefijos)


class RevisionEstructuraTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_catalogo_visual", verbosity=0)
        call_command("cargar_reglas_cfe", verbosity=0)

    def _estructura(self):
        return next(e for e in self.client.get("/api/reglas/estructuras-mt/").json() if e["codigo"] == "TS3N")

    def _cuerpo(self, e, **extra):
        cuerpo = {
            "nombre": e["nombre"], "categoria": e["categoria"], "angulo_min": e["angulo_min"],
            "angulo_max": e["angulo_max"], "es_terminal": e["es_terminal"], "descripcion": e["descripcion"],
            "materiales": [
                {"id": m["id"], "material": m["material_id"], "descripcion": m["descripcion"],
                 "cantidad": m["cantidad"], "condicion": m["condicion"], "cantidad_estimada": m["cantidad_estimada"]}
                for m in e["materiales"]
            ],
        }
        cuerpo.update(extra)
        return cuerpo

    def test_validar_marca_estructura_y_reglas(self):
        e = self._estructura()
        r = self.client.post(f"/api/reglas/estructuras-mt/{e['id']}/revision/", self._cuerpo(e, validar=True), format="json")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()["verificado"])
        self.assertTrue(all(m["verificado"] for m in r.json()["materiales"]))

    def test_editar_sin_validar_quita_la_verificacion_y_quita_materiales(self):
        e = self._estructura()
        self.client.post(f"/api/reglas/estructuras-mt/{e['id']}/revision/", self._cuerpo(e, validar=True), format="json")
        cuerpo = self._cuerpo(e, nombre="Nombre corregido")
        cuerpo["materiales"] = cuerpo["materiales"][1:]
        r = self.client.post(f"/api/reglas/estructuras-mt/{e['id']}/revision/", cuerpo, format="json").json()
        self.assertEqual(r["nombre"], "Nombre corregido")
        self.assertFalse(r["verificado"])
        self.assertEqual(len(r["materiales"]), len(e["materiales"]) - 1)

    def test_no_valida_sin_materiales_ni_reglas_ajenas(self):
        e = self._estructura()
        r = self.client.post(f"/api/reglas/estructuras-mt/{e['id']}/revision/", self._cuerpo(e, materiales=[], validar=True), format="json")
        self.assertEqual(r.status_code, 400)
        cuerpo = self._cuerpo(e)
        cuerpo["materiales"][0]["id"] = 10**9
        r = self.client.post(f"/api/reglas/estructuras-mt/{e['id']}/revision/", cuerpo, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(len(self._estructura()["materiales"]), len(e["materiales"]))
