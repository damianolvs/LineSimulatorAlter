// frontend-web/src/api/cliente.ts
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/** Convierte el cuerpo de error de DRF ({detail} o {campo: [msgs]}) en un texto legible. */
function mensajeDeError(cuerpo: unknown, status: number): string {
  if (cuerpo && typeof cuerpo === "object") {
    const obj = cuerpo as Record<string, unknown>;
    if (typeof obj.detail === "string") return obj.detail;
    const campos = Object.entries(obj)
      .map(([campo, msgs]) => `${campo}: ${Array.isArray(msgs) ? msgs.join(" ") : String(msgs)}`)
      .join(" · ");
    if (campos) return campos;
  }
  return `Error ${status}`;
}

export async function api<T>(ruta: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...resto } = init;
  const res = await fetch(`${API_URL}${ruta}`, {
    ...resto,
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : resto.body,
  });
  if (res.status === 204) return undefined as T;
  const cuerpo = await res.json().catch(() => null);
  if (!res.ok) throw new Error(mensajeDeError(cuerpo, res.status));
  return cuerpo as T;
}
