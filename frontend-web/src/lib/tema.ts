// frontend-web/src/lib/tema.ts
import { useSyncExternalStore } from "react";

export type Tema = "claro" | "oscuro";

const CLAVE = "tema";

function temaInicial(): Tema {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado === "claro" || guardado === "oscuro") return guardado;
  } catch {
    // Sin acceso a localStorage (modo privado, etc.): se usa la preferencia del sistema.
  }
  return matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro";
}

let actual: Tema = temaInicial();
const oyentes = new Set<() => void>();

const aplicar = (tema: Tema) => {
  document.documentElement.dataset.tema = tema;
};
aplicar(actual);

function suscribirse(oyente: () => void) {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

export function fijarTema(tema: Tema) {
  actual = tema;
  aplicar(tema);
  try {
    localStorage.setItem(CLAVE, tema);
  } catch {
    // El cambio sigue valiendo para esta sesión aunque no se pueda recordar.
  }
  oyentes.forEach((o) => o());
}

/** Tema activo y una función para alternarlo; el estado es compartido por todos los componentes. */
export function useTema() {
  const tema = useSyncExternalStore(suscribirse, () => actual);
  return { tema, alternar: () => fijarTema(tema === "oscuro" ? "claro" : "oscuro") };
}
