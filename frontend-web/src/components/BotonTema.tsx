// frontend-web/src/components/BotonTema.tsx
import { Moon, Sun } from "lucide-react";
import { useTema } from "../lib/tema";

/** Alterna entre modo claro y oscuro; el icono muestra el modo al que se cambiaría. */
export default function BotonTema() {
  const { tema, alternar } = useTema();
  const oscuro = tema === "oscuro";
  return (
    <button
      type="button"
      className="btn btn-secondary btn-icon no-imprimir"
      aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={oscuro ? "Modo claro" : "Modo oscuro"}
      onClick={alternar}
    >
      {oscuro ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
    </button>
  );
}
