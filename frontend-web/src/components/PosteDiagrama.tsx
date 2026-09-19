// frontend-web/src/components/PosteDiagrama.tsx
import { useRef, useState } from "react";
import type { PosteComponente } from "../api/tipos";
import { construirIconoPoste } from "../pages/construirIconoPoste";

/** Escala del dibujo: 12 m = 504 unidades (ver construirIconoPoste.ts). */
const UNIDADES_POR_M = 42;
const MARGEN_X = 120;
const MARGEN_SUPERIOR = 40;
const MARGEN_INFERIOR = 24;

interface Arrastre {
  id: number;
  x: number;
  y: number;
  /** Distancia entre el puntero y el origen del componente al empezar a arrastrar. */
  dx: number;
  dy: number;
}

interface Props {
  componentes: PosteComponente[];
  /** Profundidad enterrada del poste (cm); dibuja la línea de piso. Null si se desconoce. */
  empotramientoCm: number | null;
  /** Altura total del poste (m), para la cota del costado. */
  alturaM: number;
  seleccionadoId: number | null;
  onSeleccionar: (id: number | null) => void;
  /** Se llama al soltar un componente arrastrado, con su nueva posición local. */
  onMover: (id: number, x: number, y: number) => void;
}

function aCoordenadasSvg(svg: SVGSVGElement, clientX: number, clientY: number) {
  const punto = svg.createSVGPoint();
  punto.x = clientX;
  punto.y = clientY;
  const matriz = svg.getScreenCTM();
  return matriz ? punto.matrixTransform(matriz.inverse()) : punto;
}

const redondear = (n: number) => Math.round(n * 10) / 10;

/**
 * Vista lateral del poste con sus componentes. Requiere <SpriteDefs /> montado
 * en algún punto de la app. Los componentes se pueden arrastrar; el resultado
 * se entrega con `onMover` (el padre decide si lo persiste).
 */
export default function PosteDiagrama({
  componentes,
  empotramientoCm,
  alturaM,
  seleccionadoId,
  onSeleccionar,
  onMover,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);

  const efectivos = componentes.map((c) => (arrastre?.id === c.id ? { ...c, x: arrastre.x, y: arrastre.y } : c));
  const icono = construirIconoPoste(efectivos);
  const { ancho, alto } = icono.poste;
  const pisoY = empotramientoCm === null ? null : alto - (empotramientoCm / 100) * UNIDADES_POR_M;

  const iniciarArrastre = (e: React.PointerEvent, id: number) => {
    const svg = svgRef.current;
    const componente = componentes.find((c) => c.id === id);
    if (!svg || !componente) return;
    e.stopPropagation();
    svg.setPointerCapture(e.pointerId);
    const p = aCoordenadasSvg(svg, e.clientX, e.clientY);
    onSeleccionar(id);
    setArrastre({ id, x: componente.x, y: componente.y, dx: p.x - componente.x, dy: p.y - componente.y });
  };

  const arrastrar = (e: React.PointerEvent) => {
    if (!arrastre || !svgRef.current) return;
    const p = aCoordenadasSvg(svgRef.current, e.clientX, e.clientY);
    setArrastre({ ...arrastre, x: redondear(p.x - arrastre.dx), y: redondear(p.y - arrastre.dy) });
  };

  const soltar = () => {
    if (!arrastre) return;
    const original = componentes.find((c) => c.id === arrastre.id);
    if (original && (original.x !== arrastre.x || original.y !== arrastre.y)) {
      onMover(arrastre.id, arrastre.x, arrastre.y);
    }
    setArrastre(null);
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`${-MARGEN_X} ${-MARGEN_SUPERIOR} ${MARGEN_X * 2} ${alto + MARGEN_SUPERIOR + MARGEN_INFERIOR}`}
      className="h-full w-full touch-none select-none"
      onPointerMove={arrastrar}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      onPointerDown={() => onSeleccionar(null)}
    >
      {pisoY !== null && (
        <>
          <line x1={-MARGEN_X + 6} x2={MARGEN_X - 26} y1={pisoY} y2={pisoY} stroke="#201f1d" strokeOpacity={0.35} />
          <path
            d={`M${-MARGEN_X + 6} ${pisoY + 6}H${MARGEN_X - 26}`}
            stroke="#201f1d"
            strokeOpacity={0.18}
            strokeWidth={6}
            strokeDasharray="2 5"
          />
          <text x={-MARGEN_X + 8} y={pisoY - 5} fontSize={9} fill="#605d5d">
            nivel de piso
          </text>
        </>
      )}

      <rect
        x={-ancho / 2}
        y={0}
        width={ancho}
        height={alto}
        rx={2}
        fill="url(#metalPole)"
        stroke="#33302c"
        strokeWidth={1}
      />

      {/* Cota de altura total */}
      <g stroke="#201f1d" strokeOpacity={0.4} strokeWidth={0.8}>
        <line x1={MARGEN_X - 18} x2={MARGEN_X - 18} y1={0} y2={alto} />
        <line x1={MARGEN_X - 23} x2={MARGEN_X - 13} y1={0} y2={0} />
        <line x1={MARGEN_X - 23} x2={MARGEN_X - 13} y1={alto} y2={alto} />
      </g>
      <text
        x={MARGEN_X - 6}
        y={alto / 2}
        textAnchor="middle"
        fontSize={11}
        fill="#605d5d"
        transform={`rotate(90 ${MARGEN_X - 6} ${alto / 2})`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {alturaM.toFixed(1)} m
      </text>

      {icono.elementos.map((el) => {
        const seleccionado = el.key === String(seleccionadoId);
        const id = Number(el.key);
        return (
          <g
            key={el.key}
            transform={el.transform}
            className={arrastre ? "cursor-grabbing" : "cursor-grab"}
            onPointerDown={(e) => iniciarArrastre(e, id)}
          >
            {/* Área de agarre ligeramente mayor que el símbolo, para poder tomar piezas pequeñas. */}
            <rect x={el.x - 4} y={el.y - 4} width={el.ancho + 8} height={el.alto + 8} fill="transparent" />
            {(seleccionado || el.modo === "manual") && (
              <rect
                x={el.x - 3}
                y={el.y - 3}
                width={el.ancho + 6}
                height={el.alto + 6}
                rx={2}
                fill={el.modo === "manual" ? "#b68235" : "none"}
                fillOpacity={0.1}
                stroke="#b68235"
                strokeDasharray={el.modo === "manual" && !seleccionado ? "3 2" : undefined}
                strokeWidth={seleccionado ? 1.5 : 1}
              />
            )}
            <use href={`#${el.codigo}`} x={el.x} y={el.y} width={el.ancho} height={el.alto} pointerEvents="none" />
          </g>
        );
      })}
    </svg>
  );
}
