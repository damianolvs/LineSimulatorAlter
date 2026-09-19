// frontend-web/src/components/BarraProyecto.tsx
import { ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  volverA: string;
  etiquetaVolver: string;
  titulo: string;
  /** Contenido entre el título y las acciones (estado, resumen...). */
  children?: React.ReactNode;
  acciones?: React.ReactNode;
}

/** Barra superior de las pantallas de trabajo (editor de mapa, lista de materiales). */
export default function BarraProyecto({ volverA, etiquetaVolver, titulo, children, acciones }: Props) {
  return (
    <div
      className="no-imprimir flex items-center gap-3.5 px-4.5 py-2"
      style={{ borderBottom: "1px solid var(--color-divider)", background: "var(--color-neutral-100)" }}
    >
      <Link to={volverA} className="flex items-center gap-1.5 text-[13px] no-underline">
        <ChevronLeft size={14} strokeWidth={2} />
        {etiquetaVolver}
      </Link>
      <span className="h-[18px] w-px" style={{ background: "var(--color-divider)" }} />
      <span className="truncate" style={{ fontFamily: "var(--font-heading)", fontSize: 17 }}>
        {titulo}
      </span>
      {children}
      {acciones && <div className="ml-auto flex items-center gap-2">{acciones}</div>}
    </div>
  );
}
