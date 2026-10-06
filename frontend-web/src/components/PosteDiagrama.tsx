// frontend-web/src/components/PosteDiagrama.tsx
import { useRef, useState } from "react";
import type { PosteComponente } from "../api/tipos";
import { construirIconoPoste } from "../pages/construirIconoPoste";
import { marcasRegla, ordenarComponentes, UNIDADES_POR_M, vistaDiagrama, type ModoVista } from "../lib/vistaPoste";

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
  /** "herraje" se acerca a la zona de las piezas; "completo" muestra el poste entero. */
  modo: ModoVista;
  /** Pieza resaltada desde fuera (p. ej. al pasar el cursor por su fila de la tabla). */
  resaltadoId?: number | null;
  onResaltar?: (id: number | null) => void;
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
  modo,
  resaltadoId = null,
  onResaltar,
  onSeleccionar,
  onMover,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);

  const efectivos = componentes.map((c) => (arrastre?.id === c.id ? { ...c, x: arrastre.x, y: arrastre.y } : c));
  const icono = construirIconoPoste(efectivos);
  const { ancho, alto } = icono.poste;
  const pisoY = empotramientoCm === null ? null : alto - (empotramientoCm / 100) * UNIDADES_POR_M;
  // La vista sale de las posiciones guardadas, no de las del arrastre: así no "salta" mientras se mueve una pieza.
  const vista = vistaDiagrama(componentes, modo, alto);
  const completo = modo === "completo";
  const numeros = new Map(ordenarComponentes(componentes).map((c, i) => [c.id, i + 1]));

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

  /** Flechas: mueven la pieza seleccionada 1 unidad (5 con Mayús). */
  const teclear = (e: React.KeyboardEvent) => {
    const componente = componentes.find((c) => c.id === seleccionadoId);
    const delta = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[e.key];
    if (!componente || !delta) return;
    e.preventDefault();
    const paso = e.shiftKey ? 5 : 1;
    onMover(componente.id, redondear(componente.x + delta[0] * paso), redondear(componente.y + delta[1] * paso));
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
      viewBox={`${vista.x} ${vista.y} ${vista.ancho} ${vista.alto}`}
      className="h-full w-full touch-none select-none outline-none"
      tabIndex={0}
      aria-label="Diagrama del poste: las flechas del teclado mueven la pieza seleccionada"
      onKeyDown={teclear}
      style={{ color: "var(--color-text)" }}
      onPointerMove={arrastrar}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      onPointerDown={() => onSeleccionar(null)}
    >
      <defs>
        <linearGradient id="desvanecerPoste" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-surface)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--color-surface)" stopOpacity="1" />
        </linearGradient>
      </defs>

      {completo && pisoY !== null && (
        <>
          <line x1={vista.x + 6} x2={vista.x + vista.ancho - 26} y1={pisoY} y2={pisoY} stroke="currentColor" strokeOpacity={0.35} />
          <path
            d={`M${vista.x + 6} ${pisoY + 6}H${vista.x + vista.ancho - 26}`}
            stroke="currentColor"
            strokeOpacity={0.18}
            strokeWidth={6}
            strokeDasharray="2 5"
          />
          <text x={vista.x + 8} y={pisoY - 5} fontSize={9} fill="currentColor" fillOpacity={0.7}>
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

      {completo ? (
        <>
          {/* Cota de altura total */}
          <g stroke="currentColor" strokeOpacity={0.4} strokeWidth={0.8}>
            <line x1={vista.x + vista.ancho - 18} x2={vista.x + vista.ancho - 18} y1={0} y2={alto} />
            <line x1={vista.x + vista.ancho - 23} x2={vista.x + vista.ancho - 13} y1={0} y2={0} />
            <line x1={vista.x + vista.ancho - 23} x2={vista.x + vista.ancho - 13} y1={alto} y2={alto} />
          </g>
          <text
            x={vista.x + vista.ancho - 6}
            y={alto / 2}
            textAnchor="middle"
            fontSize={11}
            fill="currentColor"
            fillOpacity={0.7}
            transform={`rotate(90 ${vista.x + vista.ancho - 6} ${alto / 2})`}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {alturaM.toFixed(1)} m
          </text>
        </>
      ) : (
        <>
          {/* Regla desde la punta: las reglas normativas miden así la posición de cada pieza. */}
          <g stroke="currentColor" strokeOpacity={0.4} strokeWidth={0.8}>
            {marcasRegla(vista, alto).map((m) => (
              <line key={m.metros} x1={vista.x + 4} x2={vista.x + (m.mayor ? 14 : 9)} y1={m.y} y2={m.y} />
            ))}
          </g>
          {marcasRegla(vista, alto)
            .filter((m) => m.mayor)
            .map((m) => (
              <text key={m.metros} x={vista.x + 17} y={m.y + 3.5} fontSize={9} fill="currentColor" fillOpacity={0.6} style={{ fontVariantNumeric: "tabular-nums" }}>
                {m.metros === 0 ? "punta" : `${m.metros} m`}
              </text>
            ))}
          {vista.y + vista.alto < alto && (
            <>
              <rect
                x={-ancho / 2 - 1}
                y={vista.y + vista.alto - 40}
                width={ancho + 2}
                height={40}
                fill="url(#desvanecerPoste)"
                pointerEvents="none"
              />
              <text x={0} y={vista.y + vista.alto - 4} textAnchor="middle" fontSize={8.5} fill="currentColor" fillOpacity={0.55}>
                ⋮ el poste continúa
              </text>
            </>
          )}
        </>
      )}

      {icono.elementos.map((el) => {
        const seleccionado = el.key === String(seleccionadoId);
        const id = Number(el.key);
        const resaltado = id === resaltadoId && !seleccionado;
        const numero = numeros.get(id);
        return (
          <g
            key={el.key}
            transform={el.transform}
            className={arrastre ? "cursor-grabbing" : "cursor-grab"}
            onPointerDown={(e) => iniciarArrastre(e, id)}
            onPointerEnter={() => onResaltar?.(id)}
            onPointerLeave={() => onResaltar?.(null)}
          >
            {/* Área de agarre ligeramente mayor que el símbolo, para poder tomar piezas pequeñas. */}
            <rect x={el.x - 4} y={el.y - 4} width={el.ancho + 8} height={el.alto + 8} fill="transparent" />
            {resaltado && (
              <rect x={el.x - 3} y={el.y - 3} width={el.ancho + 6} height={el.alto + 6} rx={2} fill="none" stroke="currentColor" strokeOpacity={0.5} strokeWidth={1} />
            )}
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
            {numero !== undefined && (
              // Insignia con el mismo número que la fila de la tabla, a la derecha de la pieza para no taparla.
              <g transform={`translate(${el.x + el.ancho + 8} ${el.y + el.alto / 2})`} pointerEvents="none">
                <circle r={6.5} fill={seleccionado ? "#b68235" : "var(--color-bg)"} stroke="#b68235" strokeWidth={0.9} />
                <text textAnchor="middle" y={3} fontSize={8.5} fontWeight={600} fill={seleccionado ? "#1d1b18" : "currentColor"} style={{ fontVariantNumeric: "tabular-nums" }}>
                  {numero}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
