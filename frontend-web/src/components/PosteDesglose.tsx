// frontend-web/src/components/PosteDesglose.tsx
import { obtenerDesglose } from "../api/proyectos";
import { useCargar } from "../hooks/useCargar";
import type { PosteConIcono } from "../hooks/useTramoConPostes";
import { formatearCantidad } from "../lib/formato";

/** Empotramiento y materiales de la estructura del poste, con su altura real sobre piso (motor de reglas). */
export default function PosteDesglose({ poste }: { poste: PosteConIcono }) {
  const { datos, cargando, error } = useCargar(
    () => obtenerDesglose(poste.id),
    // Cualquier dato que cambie la normativa aplicable obliga a recalcular.
    [poste.id, poste.estructura.id, poste.alturaM, poste.resistenciaKg, poste.tipoTerreno],
  );

  if (cargando && !datos) return <p className="text-muted">Calculando…</p>;
  if (error) return <p className="text-muted">{error}</p>;
  if (!datos) return null;

  return (
    <div>
      <p style={{ fontSize: 13 }}>
        Empotramiento <strong className="num">{datos.empotramiento_cm} cm</strong> · sección 03 00 02
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>Material</th>
            <th style={{ textAlign: "right" }}>Cant.</th>
            <th style={{ textAlign: "right" }}>Altura sobre piso</th>
            <th>Fuente</th>
          </tr>
        </thead>
        <tbody>
          {datos.materiales.map((m) => (
            <tr key={m.regla_id} title={m.condicion || undefined}>
              <td>
                <span style={{ fontFamily: "var(--font-heading)", fontSize: 15 }}>{m.descripcion || m.material}</span>
                {!m.verificado && (
                  <span className="text-muted" title="Pendiente de verificar contra el documento normativo">
                    {" "}
                    *
                  </span>
                )}
              </td>
              <td className="num" style={{ textAlign: "right" }}>
                {formatearCantidad(m.cantidad)}
              </td>
              <td className="num" style={{ textAlign: "right" }}>
                {m.altura_sobre_piso_m.toFixed(2)} m
              </td>
              <td className="num text-muted" style={{ fontSize: 12 }}>
                {m.fuente ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-muted" style={{ fontSize: 11.5, marginTop: 8 }}>
        * Regla aún sin verificar por un técnico contra el documento normativo.
      </p>
    </div>
  );
}
