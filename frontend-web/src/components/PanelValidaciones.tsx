// frontend-web/src/components/PanelValidaciones.tsx
import { CircleCheck, Info, OctagonAlert, TriangleAlert } from "lucide-react";
import type { ProblemaValidacion, ResultadoValidacion, SeveridadValidacion } from "../api/tipos";

const VISUAL: Record<SeveridadValidacion, { icono: typeof Info; color: string; nombre: string }> = {
  error: { icono: OctagonAlert, color: "#b3392c", nombre: "Error" },
  advertencia: { icono: TriangleAlert, color: "var(--color-accent)", nombre: "Advertencia" },
  info: { icono: Info, color: "var(--color-neutral-600)", nombre: "Información" },
};

interface Props {
  resultado: ResultadoValidacion | null;
  error: string | null;
  /** Se invoca al pulsar un problema ligado a un poste. */
  onIrAPoste: (problema: ProblemaValidacion) => void;
}

/** Revisión normativa del proyecto: lista de problemas de diseño, clicables cuando apuntan a un poste. */
export default function PanelValidaciones({ resultado, error, onIrAPoste }: Props) {
  if (error) {
    return (
      <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
        No se pudo revisar la normativa: {error}
      </p>
    );
  }
  if (!resultado) return <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>Revisando…</p>;

  const { errores, advertencias, info } = resultado.resumen;
  if (resultado.problemas.length === 0) {
    return (
      <p className="flex items-center gap-2" style={{ fontSize: 13, margin: 0 }}>
        <CircleCheck size={16} strokeWidth={1.8} style={{ color: "var(--color-accent)" }} />
        Sin observaciones normativas.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-muted num" style={{ fontSize: 12 }}>
        {errores} {errores === 1 ? "error" : "errores"} · {advertencias} {advertencias === 1 ? "advertencia" : "advertencias"} · {info} info
      </div>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {resultado.problemas.map((p, i) => {
          const { icono: Icono, color, nombre } = VISUAL[p.severidad];
          const contenido = (
            <>
              <Icono size={15} strokeWidth={1.8} style={{ color, flex: "none", marginTop: 2 }} aria-label={nombre} />
              <span>{p.mensaje}</span>
            </>
          );
          const estilo = { fontSize: 12.5, lineHeight: 1.4, borderLeft: `3px solid ${color}`, borderRadius: 2 };
          return (
            <li key={`${p.codigo}-${p.poste_id ?? "g"}-${i}`}>
              {p.poste_id !== null ? (
                <button
                  type="button"
                  title="Ver el poste en el mapa"
                  onClick={() => onIrAPoste(p)}
                  className="flex w-full cursor-pointer items-start gap-2 bg-transparent px-2 py-1.5 text-left"
                  style={{ ...estilo, font: "inherit", fontSize: 12.5, border: 0, borderLeft: estilo.borderLeft }}
                >
                  {contenido}
                </button>
              ) : (
                <div className="flex items-start gap-2 px-2 py-1.5" style={estilo}>
                  {contenido}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
