import { Fragment } from "react";

// Hand-drawn SVG artwork: the lamp, the gateway arch, the mandala and the kolam.

export function GoldDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute" }}>
      <defs>
        <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F3DFA2" />
          <stop offset="0.45" stopColor="#D6A943" />
          <stop offset="1" stopColor="#A57E28" />
        </linearGradient>
        <linearGradient id="brass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F0CF7A" />
          <stop offset="0.5" stopColor="#B98A2C" />
          <stop offset="1" stopColor="#6E4A12" />
        </linearGradient>
        <radialGradient id="flame" cx="0.5" cy="0.8" r="0.8">
          <stop offset="0" stopColor="#FFF4C9" />
          <stop offset="0.35" stopColor="#FFC94A" />
          <stop offset="0.8" stopColor="#F0791E" />
          <stop offset="1" stopColor="#C2410C" />
        </radialGradient>
      </defs>
    </svg>
  );
}

export function Diya({ className = "" }: { className?: string }) {
  return (
    <svg className={`diya ${className}`} viewBox="0 0 160 150" aria-hidden="true" focusable="false">
      <g className="flame">
        <g className="flame-flicker">
          <path d="M80 70 C62 52 70 28 80 8 C90 28 98 52 80 70Z" fill="url(#flame)" />
          <path d="M80 68 C72 58 76 44 80 34 C84 44 88 58 80 68Z" fill="#FFF8E1" />
        </g>
      </g>
      <g className="brass">
        <path d="M80 78 L80 68" stroke="#3A2412" strokeWidth="3" strokeLinecap="round" />
        <path
          d="M16 74 C36 82 124 82 144 74 C140 106 114 126 80 126 C46 126 20 106 16 74Z"
          fill="url(#brass)"
        />
        <path d="M22 76 C46 84 114 84 138 76 C114 70 46 70 22 76Z" fill="#2A1508" />
        <path d="M30 77 C52 82 108 82 130 77" fill="none" stroke="#F3DFA2" strokeWidth="1" opacity="0.7" />
        <path d="M30 96 C50 110 110 110 130 96" fill="none" stroke="#F3DFA2" strokeWidth="1.2" opacity="0.6" />
        {[44, 56, 68, 80, 92, 104, 116].map((x, i) => (
          <circle key={x} cx={x} cy={96 + 9 * Math.sin(((i + 0.5) / 7) * Math.PI) - 1} r="1.6" fill="#FBEBB8" opacity="0.8" />
        ))}
        <path d="M64 125 L96 125 L108 140 L52 140Z" fill="url(#brass)" />
        <path d="M48 140 L112 140 L116 146 L44 146Z" fill="#8A6118" />
      </g>
    </svg>
  );
}

// A cusped palace gateway. Every path is a single stroke so it can be drawn on.
export function Arch() {
  const cusp =
    "M40 600 L40 232 Q40 192 70 180 Q52 152 84 134 Q78 102 116 98 Q124 68 160 76 Q176 46 200 22 Q224 46 240 76 Q276 68 284 98 Q322 102 316 134 Q348 152 330 180 Q360 192 360 232 L360 600";
  return (
    <svg className="arch" viewBox="0 0 400 600" fill="none" aria-hidden="true" focusable="false">
      <g stroke="url(#gold)" strokeLinecap="round" strokeLinejoin="round">
        <path d={cusp} strokeWidth="2.4" />
        <path d={cusp} strokeWidth="1" transform="translate(200 610) scale(0.9 0.93) translate(-200 -610)" opacity="0.75" />
        <path d="M14 600 L14 210 Q14 120 200 4 Q386 120 386 210 L386 600" strokeWidth="1" opacity="0.5" />
        <path d="M200 22 L200 6" strokeWidth="2" />
        <path d="M193 2 Q200 -8 207 2 Q200 8 193 2Z" strokeWidth="1.4" />
        <path d="M40 560 L14 560 M360 560 L386 560 M40 232 L14 232 M360 232 L386 232" strokeWidth="1" opacity="0.6" />
        <path d="M27 250 L27 540" strokeWidth="1" strokeDasharray="1 9" opacity="0.8" />
        <path d="M373 250 L373 540" strokeWidth="1" strokeDasharray="1 9" opacity="0.8" />
      </g>
    </svg>
  );
}

function petal(r1: number, r2: number, w: number) {
  const a = r1 + (r2 - r1) * 0.35;
  const b = r1 + (r2 - r1) * 0.75;
  return `M0 ${-r1} C${w} ${-a} ${w} ${-b} 0 ${-r2} C${-w} ${-b} ${-w} ${-a} 0 ${-r1}Z`;
}

// Four concentric rings, each its own layer so they can turn against one another.
export function Mandala() {
  const ring = (n: number, r1: number, r2: number, w: number, offset = 0) =>
    Array.from({ length: n }, (_, i) => (
      <path key={`${r1}-${i}`} d={petal(r1, r2, w)} transform={`rotate(${(360 / n) * i + offset})`} />
    ));
  const layers = [
    <Fragment key="heart">
      <circle r="22" />
      {ring(8, 22, 74, 16)}
      <circle r="78" />
    </Fragment>,
    <Fragment key="petals">
      {ring(16, 78, 128, 13, 11.25)}
      <circle r="132" />
    </Fragment>,
    <Fragment key="fringe">
      {ring(32, 132, 160, 7)}
      <circle r="166" />
    </Fragment>,
    <circle key="beads" r="186" strokeDasharray="1 10" strokeWidth="2.4" />,
  ];
  return (
    <div className="mandala" aria-hidden="true">
      {layers.map((layer, i) => (
        <svg key={i} className={`mandala-ring mandala-ring-${i + 1}`} viewBox="-200 -200 400 400" fill="none" focusable="false">
          <g stroke="url(#gold)" strokeWidth="1.2" strokeLinecap="round">
            {layer}
          </g>
        </svg>
      ))}
    </div>
  );
}

// A muggu / kolam border: two threads woven around a row of dots.
export function Kolam() {
  const n = 9;
  const step = 40;
  const weave = (up: boolean) => {
    let d = `M0 20`;
    for (let i = 0; i < n; i++) {
      const y = (i % 2 === 0) === up ? -10 : 50;
      d += ` Q${i * step + step / 2} ${y} ${(i + 1) * step} 20`;
    }
    return d;
  };
  return (
    <svg className="kolam" viewBox={`0 -6 ${n * step} 52`} fill="none" aria-hidden="true" focusable="false">
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d={weave(true)} />
        <path d={weave(false)} />
      </g>
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} cx={i * step + step / 2} cy="20" r="2.2" fill="currentColor" />
      ))}
    </svg>
  );
}

// Krishna's emblems in line: a flute, with a peacock feather laid across it.
export function FeatherFlute() {
  return (
    <svg className="emblem" viewBox="0 0 240 130" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {/* flute, lying at a slant */}
        <path d="M20 98 L212 52"/>
        <path d="M22 105 L214 59"/>
        <path d="M20 98 Q16 102 22 105"/>
        <path d="M212 52 Q218 55 214 59"/>
        <path d="M46 92 L48 99 M196 56 L198 63 M184 59 L186 66"/>
        {/* tassel */}
        <path d="M36 102 Q32 114 38 124 M36 102 Q40 114 35 126"/>
        {/* peacock feather: the vane */}
        <path d="M108 94 C92 66 106 26 148 8 C168 34 158 76 122 94"/>
        {/* quill */}
        <path d="M94 126 C102 104 118 66 142 30"/>
        {/* the eye of the feather */}
        <path d="M142 30 C128 34 121 48 126 60 C139 60 147 46 142 30Z"/>
        <path d="M139 37 C132 40 128 48 131 55 C138 54 142 46 139 37Z"/>
        {/* veins running out from the quill */}
        <path d="M124 64 C114 62 106 54 104 44 M119 72 C109 72 101 66 98 56 M114 81 C106 83 100 79 97 72"/>
        <path d="M128 64 C138 68 148 64 154 54 M123 74 C134 80 146 78 152 68 M117 84 C127 90 138 88 143 82"/>
      </g>
    </svg>
  );
}
