// frontend-web/src/components/MetalDefs.tsx

/**
 * Gradientes compartidos (metal, vidrio) del mockup. Se montan una sola vez en
 * el layout: los dibujos de poste los referencian con `fill="url(#metalV)"`,
 * incluidos los marcadores HTML que Leaflet crea fuera de React.
 */
export default function MetalDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <linearGradient id="metalV" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5c6064" />
          <stop offset="0.22" stopColor="#b9bdc1" />
          <stop offset="0.45" stopColor="#e6e8ea" />
          <stop offset="0.72" stopColor="#8f9398" />
          <stop offset="1" stopColor="#4e5256" />
        </linearGradient>
        <linearGradient id="metalH" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9dcde" />
          <stop offset="0.4" stopColor="#9ea2a6" />
          <stop offset="1" stopColor="#55585c" />
        </linearGradient>
        <linearGradient id="metalPole" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4a4d51" />
          <stop offset="0.18" stopColor="#a8acb0" />
          <stop offset="0.38" stopColor="#e9ebec" />
          <stop offset="0.62" stopColor="#a2a6aa" />
          <stop offset="0.85" stopColor="#63666a" />
          <stop offset="1" stopColor="#43464a" />
        </linearGradient>
        <radialGradient id="glass" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#f2efe8" />
          <stop offset="0.5" stopColor="#cfc8b6" />
          <stop offset="1" stopColor="#8e8878" />
        </radialGradient>
      </defs>
    </svg>
  );
}
