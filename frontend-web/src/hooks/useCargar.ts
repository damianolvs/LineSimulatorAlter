// frontend-web/src/hooks/useCargar.ts
import { useCallback, useEffect, useState } from "react";

/**
 * Ejecuta `cargar` al montar y cada vez que cambia `dependencias`, y expone
 * `recargar` para refrescar después de una mutación. Ignora las respuestas de
 * llamadas anteriores si ya se lanzó otra.
 */
export function useCargar<T>(cargar: () => Promise<T>, dependencias: unknown[] = []) {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    cargar()
      .then((resultado) => vigente && setDatos(resultado))
      .catch((err: Error) => vigente && setError(err.message))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [...dependencias, version]);

  return { datos, cargando, error, recargar };
}
