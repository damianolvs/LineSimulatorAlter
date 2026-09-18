// frontend-web/src/pages/PruebaSprites.tsx
//
// Página desechable para validar visualmente el sprite antes de integrarlo
// con datos reales. Móntala en una ruta temporal, ej.:
//   <Route path="/prueba-sprites" element={<PruebaSprites />} />
// y bórrala (junto con la ruta) cuando ya confirmes que todo se ve bien.
import { SpriteDefs, DIMENSIONES_COMPONENTE } from "./SpriteDefs";
import { construirIconoPoste, type PosteComponenteDTO } from "./construirIconoPoste";

const CODIGOS = Object.keys(DIMENSIONES_COMPONENTE).filter(
  (codigo) => codigo !== "aislador_set_3", // aún sin .svg fuente
);

// Datos falsos de un poste TS-3 (cruceta + 3 aisladores) con una retenida
// agregada a mano, solo para validar que construirIconoPoste + el sprite
// se combinan bien. No viene de la API.
const COMPONENTES_EJEMPLO: PosteComponenteDTO[] = [
  { id: 1, componente_visual_codigo: "cruceta", modo: "auto", x: 0, y: 60, rotacion: 0, espejo: false, orden_z: 1 },
  { id: 2, componente_visual_codigo: "aislador_pin", modo: "auto", x: -30, y: 44, rotacion: 0, espejo: false, orden_z: 2 },
  { id: 3, componente_visual_codigo: "aislador_pin", modo: "auto", x: 0, y: 44, rotacion: 0, espejo: false, orden_z: 2 },
  { id: 4, componente_visual_codigo: "aislador_pin", modo: "auto", x: 30, y: 44, rotacion: 0, espejo: false, orden_z: 2 },
  { id: 5, componente_visual_codigo: "retenida_ancla", modo: "manual", x: 60, y: 250, rotacion: 20, espejo: false, orden_z: 0 },
];

function SimboloIndividual({ codigo }: { codigo: string }) {
  const dims = DIMENSIONES_COMPONENTE[codigo];
  const escala = 3; // solo para que se vea a tamaño legible en esta página
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={dims.ancho * escala} height={dims.alto * escala}>
        <use href={`#${codigo}`} width={dims.ancho * escala} height={dims.alto * escala} />
      </svg>
      <code style={{ fontSize: 12 }}>{codigo}</code>
      <span style={{ fontSize: 11, color: "#777" }}>
        {dims.ancho} × {dims.alto}
      </span>
    </div>
  );
}

function PosteDeEjemplo() {
  const icono = construirIconoPoste(COMPONENTES_EJEMPLO);
  const margen = 100;
  const anchoLienzo = icono.poste.ancho + margen * 2;
  const altoLienzo = icono.poste.alto + 40;

  return (
    <svg
      width={anchoLienzo / 1.4}
      height={altoLienzo / 1.4}
      viewBox={`${-anchoLienzo / 2} 0 ${anchoLienzo} ${altoLienzo}`}
    >
      {/* Placeholder del cuerpo del poste — pendiente el símbolo real PoleOnly */}
      <rect
        x={-icono.poste.ancho / 2}
        y={40}
        width={icono.poste.ancho}
        height={icono.poste.alto}
        fill="#9a9a9a"
        stroke="#4a4a4a"
      />

      {icono.elementos.map((el) => (
        <g key={el.key} transform={`translate(0 40) ${el.transform}`}>
          {el.modo === "manual" && (
            <rect
              x={el.x - 3}
              y={el.y - 3}
              width={el.ancho + 6}
              height={el.alto + 6}
              fill="none"
              stroke="#b68235"
              strokeDasharray="3 2"
              strokeWidth={1}
            />
          )}
          <use href={`#${el.codigo}`} x={el.x} y={el.y} width={el.ancho} height={el.alto} />
        </g>
      ))}
    </svg>
  );
}

export function PruebaSprites() {
  return (
    <div style={{ padding: 32, fontFamily: "sans-serif" }}>
      <SpriteDefs />

      <h2>Símbolos del sprite (escala ×3 solo para esta vista)</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 32, marginBottom: 48 }}>
        {CODIGOS.map((codigo) => (
          <SimboloIndividual key={codigo} codigo={codigo} />
        ))}
      </div>

      <h2>Poste de ejemplo (cruceta + 3 aisladores + retenida manual)</h2>
      <p style={{ fontSize: 13, color: "#777", maxWidth: 480 }}>
        El borde punteado ámbar marca componentes en modo <code>manual</code> — así
        se distingue el estado sin depender de cambiar el color del SVG multicolor.
      </p>
      <PosteDeEjemplo />
    </div>
  );
}
