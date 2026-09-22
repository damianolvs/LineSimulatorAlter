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
