// frontend-web/src/components/SelectorEstructura.tsx
import type { EstructuraCFE, PrefijoEstructura } from "../api/tipos";

export const ETIQUETA_CATEGORIA: Record<string, string> = {
  paso_simple: "Paso simple",
  paso_doble: "Paso doble / deflexión moderada",
  deflexion: "Deflexión",
  remate: "Remate",
  anclaje: "Anclaje en línea",
  subestacion: "Entrada/salida de subestación",
};

interface Props {
  estructuras: EstructuraCFE[];
  prefijos: PrefijoEstructura[];
  valor: number | null;
  onCambiar: (id: number) => void;
  disabled?: boolean;
  /** Texto de la opción vacía; si se omite y hay valor, no se ofrece. */
  marcador?: string;
  className?: string;
  "aria-label"?: string;
  id?: string;
}

const SIN_REGLAS = "Sin reglas normativas";

/** Estructuras CFE agrupadas por familia (T, P, R, A...), con las no digitalizadas al final. */
export default function SelectorEstructura({
  estructuras,
  prefijos,
  valor,
  onCambiar,
  disabled,
  marcador,
  className,
  ...resto
}: Props) {
  const nombrePrefijo = new Map(prefijos.map((p) => [p.codigo, p.nombre]));
  const grupos = new Map<string, EstructuraCFE[]>();
  for (const e of estructuras) {
    const grupo = e.estructura_mt ? e.estructura_mt.prefijo_codigo : SIN_REGLAS;
    grupos.set(grupo, [...(grupos.get(grupo) ?? []), e]);
  }
  const ordenados = [...grupos.entries()].sort(([a], [b]) =>
    a === SIN_REGLAS ? 1 : b === SIN_REGLAS ? -1 : a.localeCompare(b),
  );

  return (
    <select
      value={valor ?? ""}
      disabled={disabled}
      id={resto.id}
      aria-label={resto["aria-label"]}
      onChange={(e) => e.target.value && onCambiar(Number(e.target.value))}
      className={`input ${className ?? ""}`}
    >
      {(valor === null || marcador) && <option value="">{marcador ?? "Elige una estructura…"}</option>}
      {ordenados.map(([grupo, lista]) => (
        <optgroup key={grupo} label={nombrePrefijo.get(grupo) ? `${grupo} — ${nombrePrefijo.get(grupo)}` : grupo}>
          {lista.map((e) => (
            <option key={e.id} value={e.id}>
              {e.codigo} — {e.nombre}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
