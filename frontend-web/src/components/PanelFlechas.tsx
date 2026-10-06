// frontend-web/src/components/PanelFlechas.tsx
import type { FlechasTramo } from "../api/tipos";
import { codigoPoste, formatearNumero } from "../lib/formato";

interface Props {
  flechas: FlechasTramo | null;
  conductorAsignado: boolean;
}

/** Resumen de tensión y flecha del tramo con su conductor, a la temperatura máxima de diseño. */
export default function PanelFlechas({ flechas, conductorAsignado }: Props) {
  if (!conductorAsignado) {
    return (
      <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
        Elige un conductor en el panel izquierdo para calcular tensiones y flechas.
      </p>
    );
  }
  if (!flechas) {
    return (
      <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
        Se necesitan al menos 2 postes separados para calcular flechas.
      </p>
    );
  }

  const filas: [string, string][] = [
    ["Conductor", flechas.conductor],
    ["Vano regulador", `${formatearNumero(flechas.vano_regulador_m, 1)} m`],
    [`Tensión EDS (${flechas.porcentaje_eds} %)`, `${formatearNumero(flechas.tension_eds_kg, 0)} kg`],
    [`Tensión a ${flechas.temperatura_maxima_c} °C`, `${formatearNumero(flechas.tension_kg, 0)} kg`],
    ["Flecha máxima", `${formatearNumero(flechas.flecha_maxima_m, 2)} m`],
  ];

  return (
    <div className="flex flex-col gap-2.5">
      <table className="table" style={{ fontSize: 13 }}>
        <tbody>
          {filas.map(([nombre, valor]) => (
            <tr key={nombre}>
              <td style={{ paddingLeft: 0 }}>{nombre}</td>
              <td className="num" style={{ textAlign: "right", paddingRight: 0 }}>
                {valor}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <details style={{ fontSize: 12.5 }}>
        <summary className="cursor-pointer">Flecha por vano ({flechas.vanos.length})</summary>
        <table className="table num" style={{ fontSize: 12.5, marginTop: 6 }}>
          <tbody>
            {flechas.vanos.map((v) => (
              <tr key={v.desde}>
                <td style={{ paddingLeft: 0 }}>
                  {codigoPoste(v.desde)} → {codigoPoste(v.hasta)}
                </td>
                <td style={{ textAlign: "right" }}>{formatearNumero(v.distancia_m, 0)} m</td>
                <td style={{ textAlign: "right", paddingRight: 0 }}>{formatearNumero(v.flecha_m, 2)} m</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
