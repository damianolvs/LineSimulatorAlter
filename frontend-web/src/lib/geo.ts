// frontend-web/src/lib/geo.ts
const RADIO_TIERRA_M = 6_371_008.8;
const aRadianes = (grados: number) => (grados * Math.PI) / 180;

/** Distancia en metros entre dos puntos [lng, lat] (haversine). Basta para rotular vanos en el mapa. */
export function distanciaM([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]): number {
  const dLat = aRadianes(lat2 - lat1);
  const dLng = aRadianes(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(aRadianes(lat1)) * Math.cos(aRadianes(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.sqrt(a));
}
