// frontend-web/src/components/CampoCoordenadas.tsx
import { separarPar } from "../lib/coordenadas";

interface Props {
  lat: string;
  lng: string;
  onChange: (lat: string, lng: string) => void;
  /** Prefijo para las etiquetas accesibles, p. ej. "Inicio". */
  etiqueta: string;
  disabled?: boolean;
  onEnter?: () => void;
}

/**
 * Par de campos latitud / longitud en grados decimales. Pegar «28.63934, -106.0996»
 * en cualquiera de los dos reparte los valores en ambos.
 */
export default function CampoCoordenadas({ lat, lng, onChange, etiqueta, disabled, onEnter }: Props) {
  const alTeclear = (e: React.KeyboardEvent) => e.key === "Enter" && onEnter?.();
  return (
    <>
      <input
        className="input num"
        inputMode="decimal"
        autoComplete="off"
        placeholder="Latitud, ej. 28.63934"
        aria-label={`${etiqueta}: latitud`}
        disabled={disabled}
        value={lat}
        onKeyDown={alTeclear}
        onChange={(e) => {
          const par = separarPar(e.target.value);
          if (par) onChange(par.lat, par.lng);
          else onChange(e.target.value, lng);
        }}
      />
      <input
        className="input num"
        inputMode="decimal"
        autoComplete="off"
        placeholder="Longitud, ej. -106.09960"
        aria-label={`${etiqueta}: longitud`}
        disabled={disabled}
        value={lng}
        onKeyDown={alTeclear}
        onChange={(e) => {
          const par = separarPar(e.target.value);
          if (par) onChange(par.lat, par.lng);
          else onChange(lat, e.target.value);
        }}
      />
    </>
  );
}
