"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Values the page animates; the scene reads them every frame.
export type SceneState = {
  lit: number; // seconds since the first lamp was touched, -1 before
  intro: number; // 0 → 1 camera settle while the lamps catch
  progress: number; // 0 → 1 walk down the hall, driven by scroll
  petals: number; // 0 → 1 marigold shower
};

const TEMPLE_Z = -20; // how far out on the water the temple stands
const TEMPLE_TURN = 1.13; // seen at an angle: the spire to the left, the halls stepping down to the right
const PLINTH = 1.05;
const tierDelay = (y: number) => 3.0 + y * 0.2; // the temple lights from its plinth to its crown
const COS = Math.cos(TEMPLE_TURN);
const SIN = Math.sin(TEMPLE_TURN);
const toWorld = (x: number, z: number): [number, number] => [x * COS + z * SIN, -x * SIN + z * COS + TEMPLE_Z];

// How far back the camera must stand for the whole temple to fit the screen.
const fitDistance = (aspect: number, tan: number) => Math.max(20.5 / (0.96 * tan * aspect), 15.5 / (0.43 * tan));

// kind: 0 plinth and steps, 1 carved wall, 2 moulding or cornice, 3 pillar
type Box = { cx: number; cz: number; w: number; d: number; y0: number; h: number; kind: number; ledge: boolean };
type Finial = { x: number; y: number; z: number; r: number };

// A sandstone temple in the northern style: a long plinth, a tall curved spire over the
// sanctum at the back, and pillared halls with stepped pyramid roofs descending to the
// front. Every storey is an open colonnade. Built from small blocks so the outline and
// the shadows come from real geometry.
function designTemple(small: boolean) {
  const boxes: Box[] = [];
  const finials: Finial[] = [];
  const push = (cx: number, cz: number, w: number, d: number, y0: number, h: number, kind: number, ledge = false) =>
    boxes.push({ cx, cz, w, d, y0, h, kind, ledge });

  // Plinth mouldings.
  let y = 0;
  for (const [w, d, h, kind] of [
    [11.8, 18.6, 0.26, 0],
    [11.4, 18.2, 0.1, 2],
    [11.0, 17.8, 0.3, 0],
    [11.3, 18.1, 0.09, 2],
    [10.6, 17.4, 0.3, 0],
  ] as const) {
    push(0, 1, w, d, y, h, kind, kind === 0 && h === 0.3);
    y += h;
  }
  // Steps at the front and on the side that faces us.
  for (let i = 0; i < 5; i++) {
    const run = (5 - i) * 0.34;
    push(0, 9.7 + run / 2, 2.8, run, i * 0.21, 0.21, 0);
    push(-5.3 - run / 2, 2.7, run, 2.8, i * 0.21, 0.21, 0);
  }

  // One storey of open colonnade around a dark inner wall, with a balcony slab above.
  const pitch = small ? 1.0 : 0.78;
  const storey = (cx: number, cz: number, w: number, y0: number, sh: number) => {
    push(cx, cz, w - 0.95, w - 0.95, y0, sh, 1);
    const m = Math.max(2, Math.round(w / pitch));
    for (let i = 0; i <= m; i++) {
      const t = -w / 2 + 0.12 + (i * (w - 0.24)) / m;
      const spots: [number, number][] = [
        [cx + t, cz + w / 2 - 0.12],
        [cx + t, cz - w / 2 + 0.12],
        [cx - w / 2 + 0.12, cz + t],
        [cx + w / 2 - 0.12, cz + t],
      ];
      for (const [px, pz] of spots) {
        push(px, pz, 0.17, 0.17, y0, sh - 0.3, 3);
        push(px, pz, 0.29, 0.29, y0 + sh - 0.3, 0.1, 2);
      }
    }
    push(cx, cz, w + 0.02, w + 0.02, y0 + sh - 0.2, 0.2, 1);
    push(cx, cz, w + 0.36, w + 0.36, y0 + sh, 0.09, 2, true);
    return y0 + sh + 0.09;
  };
  const body = (cx: number, cz: number, w: number, storeys: number, sh: number) => {
    let yy = PLINTH;
    for (let i = 0; i < storeys; i++) yy = storey(cx, cz, w, yy, sh);
    return yy;
  };
  // A stepped pyramid roof of many thin courses.
  const roof = (cx: number, cz: number, w: number, y0: number, H: number, n: number) => {
    let yy = y0;
    const h = H / n;
    for (let i = 0; i < n; i++) {
      const ww = (w + 0.1) * (1 - 0.86 * (i / (n - 1)));
      push(cx, cz, ww, ww, yy, h * 0.68, 1);
      push(cx, cz, ww + 0.1, ww + 0.1, yy + h * 0.68, h * 0.32, 2, i % 3 === 1);
      yy += h;
    }
    finials.push({ x: cx, y: yy, z: cz, r: w * 0.07 + 0.14 });
  };
  // A curved spire of thin banded tiers, with a projecting bay on each face.
  const spire = (cx: number, cz: number, baseW: number, y0: number, H: number, n: number) => {
    let yy = y0;
    const th = H / n;
    let w = baseW;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      w = baseW * (1 - Math.pow(t, 1.7) * 0.76);
      const e = w * 0.07;
      for (const [k, hh, grow, ledge] of [
        [1, th * 0.72, 0, false],
        [2, th * 0.28, 0.07 * (w / baseW + 0.4), i % 3 === 1],
      ] as const) {
        const yb = k === 1 ? yy : yy + th * 0.72;
        push(cx, cz, w + grow, w + grow, yb, hh, k, ledge);
        push(cx, cz, (w + grow) * 0.5, w + grow + e * 2, yb, hh, k);
        push(cx, cz, w + grow + e * 2, (w + grow) * 0.5, yb, hh, k);
      }
      yy += th;
    }
    push(cx, cz, w * 0.6, w * 0.6, yy, w * 0.16, 2);
    finials.push({ x: cx, y: yy + w * 0.16, z: cz, r: w * 0.62 });
    return yy + w * 0.16;
  };

  // The sanctum and its spire, with four smaller spires leaning on it.
  const sanctumTop = body(0, -5, 3.8, 3, 1.4);
  const crown = spire(0, -5, 3.7, sanctumTop, 7.8, 26);
  for (const [dx, dz] of [
    [-1.6, 0],
    [1.6, 0],
    [0, 1.6],
    [0, -1.6],
  ]) {
    spire(dx, -5 + dz, 1.25, sanctumTop, 3.1, 12);
  }
  // The halls, each a little lower than the last.
  roof(0, -1.2, 4.6, body(0, -1.2, 4.6, 3, 1.4), 2.7, 15);
  for (const x of [-3.4, 3.4]) roof(x, -1.2, 2.6, body(x, -1.2, 2.6, 2, 1.4), 1.8, 10);
  roof(0, 2.7, 4.2, body(0, 2.7, 4.2, 2, 1.4), 2.3, 13);
  roof(0, 6.1, 3.0, body(0, 6.1, 3.0, 1, 1.6), 1.6, 9);
  for (const x of [-3.9, 3.9]) roof(x, 8.3, 1.5, body(x, 8.3, 1.5, 1, 1.2), 1.0, 6);

  return { boxes, finials, crown: { x: 0, y: crown, z: -5 } };
}

type Lamp = { x: number; y: number; z: number; s: number; delay: number; center: number };

function layOutLamps(small: boolean, boxes: Box[], rz: number): Lamp[] {
  const lamps: Lamp[] = [{ x: 0, y: 0, z: rz, s: 1.7, delay: 0, center: 1 }];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const reach = rz - TEMPLE_Z; // the flame has to cross this much water
  const put = (x: number, z: number, s: number, delay: number) => lamps.push({ x, y: 0, z, s, delay, center: 0 });

  // 1. A lotus of lamps around the first one: a ring, eight petals, and an outer ring.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    put(Math.sin(a) * 0.9, rz + Math.cos(a) * 0.9, 0.8, 0.35 + i * 0.03);
  }
  for (let k = 0; k < 8; k++) {
    const mid = ((k + 0.5) / 8) * Math.PI * 2;
    for (const u of [0.1, 0.3, 0.5, 0.7, 0.88, 1]) {
      const rho = 1.35 + 1.95 * u;
      const half = 0.36 * Math.pow(Math.sin(Math.PI * Math.min(u, 0.999)), 0.8);
      for (const sgn of u === 1 ? [0] : [-1, 1]) {
        const a = mid + sgn * half;
        put(Math.sin(a) * rho, rz + Math.cos(a) * rho * 0.94, 0.72, 0.4 + rho * 0.3 + k * 0.02);
      }
    }
  }
  const outer = small ? 28 : 40;
  for (let i = 0; i < outer; i++) {
    const a = (i / outer) * Math.PI * 2;
    put(Math.sin(a) * 3.85, rz + Math.cos(a) * 3.85 * 0.94, 0.55, 1.5 + (i / outer) * 0.25);
  }

  // 2. A river of lamps, two abreast, winding from the lotus to the temple steps.
  const [bx, bz] = toWorld(0, 12.6);
  const a0: [number, number] = [0, rz - 4.6];
  const c1: [number, number] = [-5.5 - reach * 0.08, rz - 4.6 - reach * 0.32];
  const c2: [number, number] = [bx + 6 + reach * 0.06, bz + reach * 0.3];
  const river: [number, number][] = [];
  for (let i = 0; i <= 240; i++) {
    const t = i / 240;
    const m = 1 - t;
    river.push([
      m * m * m * a0[0] + 3 * m * m * t * c1[0] + 3 * m * t * t * c2[0] + t * t * t * bx,
      m * m * m * a0[1] + 3 * m * m * t * c1[1] + 3 * m * t * t * c2[1] + t * t * t * bz,
    ]);
  }
  let riverLen = 0;
  for (let i = 1; i < river.length; i++) riverLen += Math.hypot(river[i][0] - river[i - 1][0], river[i][1] - river[i - 1][1]);
  const stride = small ? 1.05 : 0.78;
  let walked = 0;
  let next = 0;
  for (let i = 1; i < river.length; i++) {
    const dx = river[i][0] - river[i - 1][0];
    const dz = river[i][1] - river[i - 1][1];
    const seg = Math.hypot(dx, dz);
    walked += seg;
    if (walked < next) continue;
    next += stride;
    const half = 0.8 + 0.25 * Math.sin((walked / riverLen) * Math.PI);
    for (const side of [-1, 1]) {
      put(river[i][0] + (-dz / seg) * half * side, river[i][1] + (dx / seg) * half * side, 0.8, 1.4 + (walked / riverLen) * 1.7);
    }
  }
  const nearRiver = (x: number, z: number, d: number) => {
    for (let i = 0; i < river.length; i += 6) if (Math.hypot(river[i][0] - x, river[i][1] - z) < d) return true;
    return false;
  };

  // 3. Three rings of lamps on the water around the temple's island, like ripples.
  [2.4, 4.9, 7.8].forEach((off, k) => {
    const ax = 5.9 + off;
    const az = 9.3 + off;
    const count = Math.round((Math.PI * 2 * Math.sqrt((ax * ax + az * az) / 2)) / ((small ? 1.45 : 1.0) + k * 0.28));
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const cs = Math.cos(a);
      const sn = Math.sin(a);
      // a rounded rectangle, so the rings follow the shape of the plinth
      const lx = ax * Math.sign(cs) * Math.pow(Math.abs(cs), 0.62);
      const lz = 1 + az * Math.sign(sn) * Math.pow(Math.abs(sn), 0.62);
      const [wx, wz] = toWorld(lx, lz);
      if (nearRiver(wx, wz, 1.5)) continue;
      const sweep = Math.abs(((a / (Math.PI * 2) + 0.75) % 1) - 0.5) * 2; // lights from the steps round to the back
      put(wx, wz, 0.78 - k * 0.04, 3.0 + k * 0.28 + sweep * 0.7);
    }
  });
  const onIsland = (x: number, z: number, pad: number) => {
    const dx = x;
    const dz = z - TEMPLE_Z;
    const lx = dx * COS - dz * SIN;
    const lz = dx * SIN + dz * COS - 1;
    return Math.pow(lx / (13.7 + pad), 2) + Math.pow(lz / (17.1 + pad), 2) < 1;
  };

  // 4. Lotus-shaped clusters drifting on the open water.
  const clusters: [number, number][] = [];
  const wanted = small ? 9 : 17;
  const spreadX = 9 + reach * 0.72;
  for (let tries = 0; tries < 900 && clusters.length < wanted; tries++) {
    const x = (rnd() - 0.5) * 2 * spreadX;
    const z = rz + 1 - rnd() * (reach + 13);
    if (onIsland(x, z, 2.2) || Math.hypot(x, z - rz) < 6.6 || nearRiver(x, z, 3.4)) continue;
    if (clusters.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 6.2)) continue;
    clusters.push([x, z]);
    const base = 1.5 + (Math.hypot(x, z - rz) / reach) * 1.9;
    const turn = rnd() * Math.PI;
    put(x, z, 1.05, base);
    for (let i = 0; i < 6; i++) {
      const a = turn + (i / 6) * Math.PI * 2;
      put(x + Math.sin(a) * 0.72, z + Math.cos(a) * 0.72, 0.72, base + 0.16);
    }
    const rim = small ? 8 : 12;
    for (let i = 0; i < rim; i++) {
      const a = turn + ((i + 0.5) / rim) * Math.PI * 2;
      put(x + Math.sin(a) * 1.4, z + Math.cos(a) * 1.4, 0.62, base + 0.34);
    }
  }
  // 5. A few single lamps far out, for depth.
  const singles = small ? 34 : 80;
  for (let i = 0; i < singles; i++) {
    const x = (rnd() - 0.5) * 2 * (spreadX + 10);
    const z = rz + 2 - rnd() * (reach + 26);
    if (onIsland(x, z, 1) || Math.hypot(x, z - rz) < 6 || nearRiver(x, z, 2.4)) continue;
    if (clusters.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 2.6)) continue;
    put(x, z, 0.8 + rnd() * 0.3, 1.6 + (Math.hypot(x, z - rz) / reach) * 1.9 + rnd() * 0.3);
  }

  // Lamps along the ledges of the temple, on the two sides that face us.
  const gap = small ? 0.8 : 0.5;
  for (const b of boxes) {
    if (!b.ledge) continue;
    const y = b.y0 + b.h;
    const s = b.w > 8 ? 0.6 : 0.44;
    const delay = () => tierDelay(y) + rnd() * 0.3;
    const front = b.cz + b.d / 2 - 0.09;
    const near = b.cx - b.w / 2 + 0.09;
    for (let x = near; x <= b.cx + b.w / 2 - 0.08; x += gap) {
      const [wx, wz] = toWorld(x, front);
      lamps.push({ x: wx, y, z: wz, s, delay: delay(), center: 0 });
    }
    for (let z = front - gap; z >= b.cz - b.d / 2 + 0.08; z -= gap) {
      const [wx, wz] = toWorld(near, z);
      lamps.push({ x: wx, y, z: wz, s, delay: delay(), center: 0 });
    }
  }
  return lamps;
}

const lampAttrs = /* glsl */ `
  attribute vec3 aPos;
  attribute float aScale;
  attribute float aDelay;
  attribute float aSeed;
  attribute float aCenter;
  uniform float uLit;
  uniform float uTime;
  // lamps on the water drift a little; lamps on the temple stay put
  vec3 lampPos() {
    float afloat = step(aPos.y, 0.001);
    return aPos + vec3(sin(uTime * 0.23 + aSeed * 50.0), 0.0, cos(uTime * 0.19 + aSeed * 33.0)) * 0.07 * afloat;
  }
  // which way the lamp's spout points, and where its wick sits (in lamp units)
  vec2 spoutDir() {
    float yaw = (aSeed - 0.5) * 2.3;
    return vec2(sin(yaw), cos(yaw));
  }
  const float WICK_R = 0.255;
  const float WICK_Y = 0.165;
`;

export default function Scene({ state }: { state: React.RefObject<SceneState> }) {
  const mount = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    const small = window.innerWidth < 760;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: "high-performance" });
    } catch {
      host.dataset.fallback = "true";
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75));
    renderer.setClearColor(0x0a0412, 1);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 220);
    const uTime = { value: 0 };
    const uLit = { value: -1 };
    const disposables: { dispose: () => void }[] = [];
    const keep = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);

    // ── Lamps ──────────────────────────────────────────────
    const tanFov = Math.tan((50 * Math.PI) / 360) * 2;
    const aspect0 = (host.clientWidth || window.innerWidth) / (host.clientHeight || window.innerHeight);
    const rangoliZ = fitDistance(aspect0, tanFov) + TEMPLE_Z - 10; // the first lamps sit just ahead of the camera
    const temple = designTemple(small);
    const lamps = layOutLamps(small, temple.boxes, rangoliZ);
    const n = lamps.length;
    const aPos = new Float32Array(n * 3);
    const aScale = new Float32Array(n);
    const aDelay = new Float32Array(n);
    const aSeed = new Float32Array(n);
    const aCenter = new Float32Array(n);
    lamps.forEach((l, i) => {
      aPos.set([l.x, l.y, l.z], i * 3);
      aScale[i] = l.s;
      aDelay[i] = l.delay;
      aSeed[i] = (i * 0.61803) % 1;
      aCenter[i] = l.center;
    });
    const instanced = (base: THREE.BufferGeometry) => {
      const g = keep(new THREE.InstancedBufferGeometry());
      g.index = base.index;
      for (const name of ["position", "normal", "uv"]) g.setAttribute(name, base.getAttribute(name));
      g.setAttribute("aPos", new THREE.InstancedBufferAttribute(aPos, 3));
      g.setAttribute("aScale", new THREE.InstancedBufferAttribute(aScale, 1));
      g.setAttribute("aDelay", new THREE.InstancedBufferAttribute(aDelay, 1));
      g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(aSeed, 1));
      g.setAttribute("aCenter", new THREE.InstancedBufferAttribute(aCenter, 1));
      g.instanceCount = n;
      base.dispose();
      return g;
    };
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, order: number) => {
      const m = new THREE.Mesh(geo, mat);
      m.frustumCulled = false;
      m.renderOrder = order;
      scene.add(m);
      return m;
    };

    // The night sky, painted behind everything; it warms as the lamps catch.
    const sky = keep(
      new THREE.ShaderMaterial({
        depthTest: false,
        depthWrite: false,
        uniforms: { uWarm: { value: 0 }, uAspect: { value: 1 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 1.0, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uWarm;
          uniform float uAspect;
          varying vec2 vUv;
          void main() {
            vec3 top = mix(vec3(0.02, 0.025, 0.11), vec3(0.039, 0.016, 0.071), uWarm);
            vec3 mid = mix(vec3(0.06, 0.065, 0.27), vec3(0.086, 0.03, 0.13), uWarm);
            vec3 low = mix(vec3(0.2, 0.15, 0.4), vec3(0.24, 0.04, 0.085), uWarm);
            float y = vUv.y;
            vec3 col = mix(low, mid, smoothstep(0.3, 0.62, y));
            col = mix(col, top, smoothstep(0.6, 1.0, y));
            vec2 d = (vUv - vec2(0.5, 0.36)) * vec2(1.0, 1.9);
            col += vec3(0.62, 0.2, 0.07) * exp(-dot(d, d) * 5.0) * uWarm;
            // The moon, high on the right, with a soft halo.
            vec2 m = (vUv - vec2(0.84, 0.69)) * vec2(uAspect, 1.0);
            float md = length(m);
            col += vec3(0.5, 0.52, 0.72) * (exp(-md * md * 60.0) * 0.16 + exp(-md * md * 9.0) * 0.07) * (1.0 - uWarm * 0.5);
            col = mix(col, vec3(0.95, 0.92, 0.84) * (0.86 + 0.14 * smoothstep(0.03, 0.0, length(m - vec2(0.006, 0.005)))), smoothstep(0.0235, 0.021, md) * 0.92);
            // Mist along the horizon.
            col += vec3(0.1, 0.09, 0.2) * exp(-pow((vUv.y - 0.34) * 9.0, 2.0)) * (1.0 - uWarm * 0.6);
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    );
    add(keep(new THREE.PlaneGeometry(1, 1)), sky, -1);

    // Still water: it lets the temple's reflection through, broken by slow ripples.
    const water = keep(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime, uWarm: { value: 0 } },
        vertexShader: /* glsl */ `
          varying float vD;
          varying vec3 vW;
          void main() {
            vW = (modelMatrix * vec4(position, 1.0)).xyz;
            vec4 mv = viewMatrix * vec4(vW, 1.0);
            vD = -mv.z;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform float uWarm;
          varying float vD;
          varying vec3 vW;
          void main() {
            float ripple = sin(vW.z * 2.6 + sin(vW.x * 0.45 + uTime * 0.3) * 2.2 + uTime * 0.5) * 0.5 + 0.5;
            ripple *= 0.5 + 0.5 * sin(vW.x * 1.3 + vW.z * 0.7 - uTime * 0.25);
            vec3 col = mix(vec3(0.03, 0.035, 0.13), vec3(0.05, 0.016, 0.045), uWarm);
            float a = exp(-vD * 0.022) * (0.4 + 0.2 * ripple);
            gl_FragColor = vec4(col, a);
          }`,
      }),
    );
    add(keep(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2)), water, 0);

    const quad = () => new THREE.PlaneGeometry(1, 1);
    const flameMat = (flip: number, gain: number) =>
      keep(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: { uTime, uLit, uFlip: { value: flip }, uGain: { value: gain }, uHint: { value: 0 } },
          vertexShader: /* glsl */ `
            ${lampAttrs}
            uniform float uFlip;
            varying vec2 vC;
            varying float vLit;
            varying float vSeed;
            varying float vFade;
            varying float vCenter;
            void main() {
              vLit = smoothstep(aDelay, aDelay + 0.45, uLit);
              float pop = smoothstep(aDelay, aDelay + 0.12, uLit) * (1.0 - smoothstep(aDelay + 0.12, aDelay + 0.8, uLit));
              vec3 lp = lampPos();
              vec2 sd = spoutDir() * WICK_R * aScale;
              vec4 mv = viewMatrix * vec4(lp.x + sd.x, (lp.y + WICK_Y * aScale) * uFlip, lp.z + sd.y, 1.0);
              vec2 c = vec2(position.x, position.y + 0.3);
              vC = c;
              vec2 off = c * aScale * 1.15 * (1.0 + pop * 0.8);
              off.y *= uFlip < 0.0 ? -3.4 : 1.0;
              mv.xy += off;
              vFade = exp(-max(-mv.z - 14.0, 0.0) * 0.012);
              vSeed = aSeed;
              vCenter = aCenter;
              gl_Position = projectionMatrix * mv;
            }`,
          fragmentShader: /* glsl */ `
            uniform float uTime;
            uniform float uFlip;
            uniform float uGain;
            uniform float uHint;
            varying vec2 vC;
            varying float vLit;
            varying float vSeed;
            varying float vFade;
            varying float vCenter;
            void main() {
              vec2 c = vC;
              float fl = 0.88 + 0.12 * sin(uTime * 11.0 + vSeed * 40.0) * sin(uTime * 6.3 + vSeed * 17.0);
              vec3 col;
              if (uFlip < 0.0) {
                // The lamp's light on the water: a long streak, broken up by the ripples.
                float yy = max(c.y, 0.0);
                float x = c.x + sin(yy * 42.0 + uTime * 2.4 + vSeed * 9.0) * 0.016 * (0.3 + yy * 2.5);
                float streak = exp(-x * x * 150.0 / (1.0 + yy * 5.0)) * exp(-yy * 3.6) * step(0.0, c.y);
                float broken = 0.5 + 0.5 * sin(yy * 58.0 - uTime * 3.2 + vSeed * 20.0);
                broken *= 0.65 + 0.35 * sin(yy * 19.0 + uTime * 1.4 + vSeed * 5.0);
                vec2 d = c - vec2(0.0, 0.02);
                float pool = exp(-dot(d, d) * 46.0) * 0.5;
                col = vec3(1.0, 0.56, 0.2) * (streak * (0.35 + 0.65 * broken) * 0.95 + pool) * fl;
              } else {
                // An oil-lamp flame. Brightness is a smooth field, hottest low in the body and
                // cooling to the tip, then mapped through the colours real fire passes through.
                float h = 0.19 * fl;
                float t = c.y / h;
                float tt = clamp(t, 0.0, 1.0);
                float lean = sin(uTime * 2.1 + vSeed * 30.0) * 0.02 + sin(uTime * 6.7 + vSeed * 11.0) * 0.007;
                float cx = c.x - lean * tt * tt - sin(tt * 9.0 - uTime * 13.0 + vSeed * 20.0) * 0.004 * tt;
                float w = 0.085 * pow(tt, 0.45) * pow(1.0 - tt, 0.75);
                float dd = abs(cx) / max(w, 0.0001);
                float I = pow(clamp(1.0 - dd * dd, 0.0, 1.0), 0.7) * step(0.0, t) * step(t, 1.0);
                float heat = I * (0.55 + 0.45 * smoothstep(1.0, 0.15, tt));
                // the dark, unburnt zone hugging the wick
                heat *= 1.0 - 0.8 * exp(-cx * cx / 0.00035 - pow((c.y - 0.014) / 0.03, 2.0));
                vec3 fire = mix(vec3(1.0, 0.26, 0.03), vec3(1.0, 0.6, 0.13), smoothstep(0.1, 0.55, heat));
                fire = mix(fire, vec3(1.0, 0.92, 0.66), smoothstep(0.62, 1.0, heat));
                col = fire * smoothstep(0.0, 0.18, heat) * 1.4;
                // a thin blue mantle low on the flame's edge
                col += vec3(0.1, 0.24, 1.0) * I * smoothstep(0.24, 0.0, tt) * (1.0 - smoothstep(0.2, 0.8, I)) * 0.9;
                // the glowing tip of the cotton wick
                col += vec3(1.0, 0.34, 0.07) * exp(-(c.x * c.x + pow(c.y - 0.004, 2.0)) * 9000.0) * 0.9;
                // bloom: tight and bright near the flame, a very faint wide halo
                vec2 d = c - vec2(0.0, h * 0.45);
                float r2 = dot(d, d);
                float edge = clamp(1.0 - r2 * 8.0, 0.0, 1.0);
                col += vec3(1.0, 0.52, 0.18) * (exp(-r2 * 130.0) * 0.5 + exp(-r2 * 24.0) * 0.1 + exp(-r2 * 6.0) * 0.022) * edge * fl;
              }
              col *= vLit * vFade * uGain;
              // an ember on the first wick, inviting the touch
              vec2 e = c - vec2(0.0, 0.06);
              col += vec3(1.0, 0.42, 0.12) * exp(-dot(e, e) * 60.0) * uHint * vCenter * (1.0 - vLit) * step(0.0, uFlip);
              gl_FragColor = vec4(col, 1.0);
            }`,
        }),
      );
    const reflectionMat = flameMat(-1, 0.55);
    const flames = flameMat(1, 1);
    add(instanced(quad()), reflectionMat, 1);

    // Pools of light on the stone under each lamp.
    add(
      instanced(quad()),
      keep(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: { uTime, uLit },
          vertexShader: /* glsl */ `
            ${lampAttrs}
            varying vec2 vC;
            varying float vA;
            void main() {
              vC = position.xy;
              vec2 sd = spoutDir() * WICK_R * aScale;
              vec4 mv = viewMatrix * vec4(lampPos() + vec3(sd.x, 0.0, sd.y) + vec3(position.x, 0.012, position.y) * aScale * 2.6, 1.0);
              vA = smoothstep(aDelay, aDelay + 0.6, uLit) * exp(-max(-mv.z - 12.0, 0.0) * 0.02);
              gl_Position = projectionMatrix * mv;
            }`,
          fragmentShader: /* glsl */ `
            varying vec2 vC;
            varying float vA;
            void main() {
              float r2 = dot(vC, vC);
              float g = exp(-r2 * 16.0) * clamp(1.0 - r2 * 4.0, 0.0, 1.0);
              gl_FragColor = vec4(vec3(1.0, 0.5, 0.17) * g * 0.13 * vA, 1.0);
            }`,
        }),
      ),
      2,
    );

    // Stone lamps, carved from the temple's own sandstone: a hollow bowl with a pinched spout, oil inside, a wick at the lip.
    const profile = [
      [0, 0], [0.09, 0], [0.15, 0.035], [0.2, 0.09], [0.215, 0.135], [0.205, 0.152], [0.188, 0.14], [0.172, 0.112], [0, 0.112],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    add(
      instanced(new THREE.LatheGeometry(profile, small ? 12 : 18)),
      keep(
        new THREE.ShaderMaterial({
          uniforms: { uTime, uLit },
          vertexShader: /* glsl */ `
            ${lampAttrs}
            varying float vLit;
            varying vec3 vN;
            varying vec3 vL;
            varying vec3 vWick;
            varying float vV;
            varying float vFade;
            varying float vSeed;
            void main() {
              vLit = smoothstep(aDelay, aDelay + 0.5, uLit);
              // pinch one side of the rim out into a spout
              vec3 p = position;
              float pinch = pow(max(cos(atan(p.x, p.z)), 0.0), 6.0) * smoothstep(0.03, 0.13, p.y);
              p.xz *= 1.0 + 0.42 * pinch;
              p.y -= 0.014 * pinch;
              vec2 sd = spoutDir();
              vec3 q = vec3(p.x * sd.y + p.z * sd.x, p.y, -p.x * sd.x + p.z * sd.y);
              vN = vec3(normal.x * sd.y + normal.z * sd.x, normal.y, -normal.x * sd.x + normal.z * sd.y);
              vL = q;
              vWick = vec3(sd.x * WICK_R, WICK_Y + 0.05, sd.y * WICK_R);
              vV = uv.y;
              vSeed = aSeed;
              vec4 mv = viewMatrix * vec4(q * aScale + lampPos(), 1.0);
              vFade = exp(-max(-mv.z - 14.0, 0.0) * 0.02);
              gl_Position = projectionMatrix * mv;
            }`,
          fragmentShader: /* glsl */ `
            varying float vLit;
            varying vec3 vN;
            varying vec3 vL;
            varying vec3 vWick;
            varying float vV;
            varying float vFade;
            varying float vSeed;
            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float noise(vec2 p) {
              vec2 i = floor(p);
              vec2 f = fract(p);
              f = f * f * (3.0 - 2.0 * f);
              return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
            }
            void main() {
              vec3 n = normalize(vN);
              float oil = step(0.9, vV);
              float inner = step(0.64, vV) * (1.0 - oil);

              // the same pink sandstone as the temple, with the same uneven grain
              float grain = noise(vec2(atan(vL.x, vL.z) * 3.0 + vSeed * 40.0, vL.y * 60.0)) * 0.6 + noise(vL.xz * 70.0 + vSeed * 9.0) * 0.4;
              vec3 clay = mix(vec3(0.62, 0.47, 0.47), vec3(0.88, 0.71, 0.66), grain);
              clay *= 1.0 - inner * 0.25;
              vec3 oilCol = vec3(0.3, 0.2, 0.14);
              vec3 albedo = mix(clay, oilCol, oil);

              // night light: soft sky from above, the moon from the right
              vec3 moonDir = normalize(vec3(0.62, 0.6, 0.5));
              vec3 skyFill = mix(vec3(0.1, 0.1, 0.24), vec3(0.22, 0.24, 0.47), 0.5 + 0.5 * n.y);
              vec3 night = albedo * (skyFill * 1.12 + vec3(0.66, 0.6, 0.72) * max(dot(n, moonDir), 0.0));
              night *= 1.0 - inner * 0.3;
              night += oil * vec3(0.3, 0.32, 0.42) * pow(max(1.0 - length(vL.xz - vec2(0.05, 0.03)) * 9.0, 0.0), 3.0);

              // its own flame: a small light at the wick, falling off quickly
              vec3 toWick = vWick - vL;
              float d2 = dot(toWick, toWick);
              float reach = 1.0 / (1.0 + d2 * 55.0);
              float facing = max(dot(n, normalize(toWick)), 0.0);
              vec3 lit = albedo * vec3(1.25, 0.6, 0.2) * (facing * reach * 4.6 + reach * 0.4);
              // the flame mirrored in the oil
              lit += oil * vec3(1.0, 0.72, 0.3) * exp(-dot(vL.xz - vWick.xz * 0.72, vL.xz - vWick.xz * 0.72) * 260.0) * 1.3;

              gl_FragColor = vec4((night + lit * vLit) * vFade, 1.0);
            }`,
        }),
      ),
      3,
    );
    add(instanced(quad()), flames, 4);

    // ── The temple ─────────────────────────────────────────
    const parts = temple.boxes.map((b) => {
      const g = new THREE.BoxGeometry(b.w, b.h, b.d).translate(b.cx, b.y0 + b.h / 2, b.cz);
      const count = g.getAttribute("position").count;
      const cellFor = (len: number) => len / Math.max(1, Math.round(len / Math.max(b.h * 0.8, 0.2)));
      const box = new Float32Array(count * 4);
      const cen = new Float32Array(count * 4);
      const kind = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        box.set([b.y0, b.h, cellFor(b.w), cellFor(b.d)], i * 4);
        cen.set([b.cx, b.cz, b.w, b.d], i * 4);
        kind[i] = b.kind;
      }
      g.setAttribute("aBox", new THREE.BufferAttribute(box, 4));
      g.setAttribute("aCen", new THREE.BufferAttribute(cen, 4));
      g.setAttribute("aKind", new THREE.BufferAttribute(kind, 1));
      return g;
    });
    const templeGeo = keep(mergeGeometries(parts));
    parts.forEach((g) => g.dispose());
    const stone = (mirror: number) =>
      keep(
        new THREE.ShaderMaterial({
          uniforms: {
            uLit,
            uMirror: { value: mirror },
            uMoon: { value: new THREE.Vector3(0.62 * COS - 0.5 * SIN, 0.6, 0.62 * SIN + 0.5 * COS).normalize() },
            uView: { value: new THREE.Vector3(-SIN, 0, COS) },
          },
          vertexShader: /* glsl */ `
            attribute vec4 aBox;
            attribute vec4 aCen;
            attribute float aKind;
            varying vec3 vP;
            varying vec3 vN;
            varying vec4 vBox;
            varying vec4 vCen;
            varying float vKind;
            varying float vDepth;
            void main() {
              vP = position;
              vN = normal;
              vBox = aBox;
              vCen = aCen;
              vKind = aKind;
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              vDepth = -mv.z;
              gl_Position = projectionMatrix * mv;
            }`,
          fragmentShader: /* glsl */ `
            uniform float uLit;
            uniform float uMirror;
            uniform vec3 uMoon;
            uniform vec3 uView;
            varying vec3 vP;
            varying vec3 vN;
            varying vec4 vBox;
            varying vec4 vCen;
            varying float vKind;
            varying float vDepth;

            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float noise(vec2 p) {
              vec2 i = floor(p);
              vec2 f = fract(p);
              f = f * f * (3.0 - 2.0 * f);
              return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
            }

            void main() {
              vec3 n = normalize(vN);
              float side = step(0.5, abs(n.x));
              float top = step(0.5, n.y);
              float under = step(0.5, -n.y);
              float v = clamp((vP.y - vBox.x) / vBox.y, 0.0, 1.0);
              float cell = mix(vBox.z, vBox.w, side);
              float u = mix(vP.x - vCen.x + vCen.z * 0.5, vP.z - vCen.y + vCen.w * 0.5, side);

              // Weathered sandstone: blotches, grain, and faint masonry courses.
              vec2 sp = vec2(u + vCen.x * 3.1 + vCen.y * 1.7, vP.y);
              float blotch = noise(sp * 1.6) * 0.6 + noise(sp * 5.5) * 0.3 + noise(sp * 23.0) * 0.1;
              vec3 albedo = mix(vec3(0.62, 0.47, 0.47), vec3(0.88, 0.71, 0.66), blotch);
              float isWall = 1.0 - step(0.5, abs(vKind - 1.0));
              float isMould = 1.0 - step(0.5, abs(vKind - 2.0));
              float isPlinth = 1.0 - step(0.5, vKind);
              float course = smoothstep(0.035, 0.0, abs(fract(vP.y * 4.2) - 0.5) - 0.46) * isPlinth * (1.0 - top);
              albedo *= 1.0 - course * 0.22;

              // Carving on the walls: an arched niche in every bay, between pilasters.
              float niche = 0.0;
              float frame = 0.0;
              float inner = 0.0;
              float pil = 0.0;
              if (isWall > 0.5 && top < 0.5 && under < 0.5) {
                float c = fract(u / cell) - 0.5;
                float asp = cell / vBox.y;
                float hw = 0.2;
                float bodyD = max(abs(c) - hw, max(0.16 - v, v - 0.52));
                vec2 q = vec2(c / hw, (v - 0.52) / (0.34 * asp + 0.0001));
                float archD = (length(q) - 1.0) * hw;
                float dN = v > 0.52 ? archD : bodyD;
                niche = smoothstep(0.012, -0.012, dN);
                frame = smoothstep(0.05, 0.02, abs(dN - 0.035));
                inner = clamp((v - 0.16) / 0.5, 0.0, 1.0);
                pil = smoothstep(0.37, 0.41, abs(c)) * (1.0 - smoothstep(0.46, 0.5, abs(c)) * 0.5);
              }

              // Shadow under each cornice and where a wall meets the ledge below.
              float ao = 1.0 - 0.5 * smoothstep(0.55, 1.0, v) * isWall - 0.22 * smoothstep(0.16, 0.0, v) * (1.0 - isMould);
              ao *= 1.0 - under * 0.6;

              // Moonlight from high on the right; the night sky fills the shadows.
              float diff = max(dot(n, uMoon), 0.0);
              vec3 skyFill = mix(vec3(0.1, 0.1, 0.24), vec3(0.22, 0.24, 0.47), 0.5 + 0.5 * n.y);
              vec3 moon = albedo * (skyFill * 1.12 + vec3(0.66, 0.6, 0.72) * diff) * ao;
              moon *= 1.0 + isMould * 0.45 + frame * 0.3 + pil * 0.16;
              moon *= mix(1.0, 0.22 + 0.22 * inner, niche);

              // Lit by its lamps: warm light climbing each wall from the ledge below.
              float d0 = 2.7 + vP.y * 0.22;
              float L = smoothstep(d0, d0 + 0.9, uLit);
              float up = 0.22 + 0.95 * exp(-v * 2.4);
              float facing = 0.6 + 0.4 * max(dot(n, uView), 0.0) + 0.25 * max(-n.x, 0.0);
              vec3 warm = albedo * vec3(1.25, 0.6, 0.2) * up * facing * mix(ao, 1.0, 0.4);
              warm *= 1.0 + isMould * 0.55 + frame * 0.5 + pil * 0.25;
              warm = mix(warm, vec3(1.0, 0.5, 0.15) * (1.05 - 0.6 * inner) * facing, niche);
              warm *= 1.0 - top * 0.45;

              vec3 col = mix(moon, warm, L);

              // Night haze: distance and the mist that sits on the water.
              vec3 haze = mix(vec3(0.1, 0.1, 0.3), vec3(0.3, 0.09, 0.07), L * 0.7);
              float mist = (1.0 - exp(-vDepth * 0.006)) * 0.3 + exp(-max(vP.y, 0.0) * 0.9) * 0.18;
              col = mix(col, haze, clamp(mist, 0.0, 0.8));

              if (uMirror > 0.5) col *= 0.72 * exp(-vP.y * 0.045);
              gl_FragColor = vec4(col, 1.0);
            }`,
        }),
      );
    const templeGroup = new THREE.Group();
    templeGroup.position.z = TEMPLE_Z;
    templeGroup.rotation.y = TEMPLE_TURN;
    const mirrorGroup = new THREE.Group();
    mirrorGroup.position.z = TEMPLE_Z;
    mirrorGroup.rotation.y = TEMPLE_TURN;
    mirrorGroup.scale.y = -1;
    templeGroup.add(new THREE.Mesh(templeGeo, stone(0)));
    const mirrored = new THREE.Mesh(templeGeo, stone(1));
    mirrored.renderOrder = -0.5;
    mirrorGroup.add(mirrored);
    scene.add(mirrorGroup, templeGroup);

    // Gold finials: a ribbed crown stone and a kalasha on every tower.
    const dimGold = new THREE.Color(0x8c7480);
    const litGold = new THREE.Color(0xffd27a);
    const crown = keep(
      new THREE.LatheGeometry(
        [
          [0, 0], [1, 0.04], [1.08, 0.2], [1, 0.36], [0.4, 0.42], [0.55, 0.62], [0.36, 0.84], [0.14, 0.9], [0.22, 1.08], [0, 1.42],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        14,
      ),
    );
    const finials = temple.finials.map((f) => {
      const mat = keep(new THREE.MeshBasicMaterial({ color: dimGold.clone() }));
      const m = new THREE.Mesh(crown, mat);
      m.position.set(f.x, f.y, f.z);
      m.scale.setScalar(f.r);
      templeGroup.add(m);
      return { mat, delay: tierDelay(f.y) };
    });

    // A saffron flag on the main spire.
    const pole = new THREE.Mesh(keep(new THREE.BoxGeometry(0.06, 2.6, 0.06)), keep(new THREE.MeshBasicMaterial({ color: 0x6f5a66 })));
    pole.position.set(temple.crown.x, temple.crown.y + 1.9, temple.crown.z);
    const flagMat = keep(new THREE.MeshBasicMaterial({ color: 0x8a4a2a, side: THREE.DoubleSide }));
    const flag = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.85, 0.5)), flagMat);
    flag.position.set(temple.crown.x + 0.45, temple.crown.y + 2.9, temple.crown.z);
    templeGroup.add(pole, flag);

    // A glow that rises behind the temple as you draw near.
    const dawn = keep(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uGlow: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec2 vC;
          void main() { vC = position.xy / 9.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uGlow;
          varying vec2 vC;
          void main() {
            float r2 = dot(vC, vC);
            float g = exp(-r2 * 5.0) * clamp(1.0 - r2, 0.0, 1.0);
            gl_FragColor = vec4(vec3(1.0, 0.82, 0.5) * g * uGlow, 1.0);
          }`,
      }),
    );
    const dawnMesh = add(keep(new THREE.PlaneGeometry(18, 18)), dawn, 6);
    dawnMesh.position.set(0, 5, TEMPLE_Z - 12);
    dawnMesh.scale.setScalar(2.2);

    // ── Stars ──────────────────────────────────────────────
    const starCount = small ? 260 : 520;
    const sPos = new Float32Array(starCount * 3);
    const sSeed = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = 0.06 + Math.random() * 1.1;
      sPos.set([Math.cos(a) * Math.cos(e) * 150, Math.sin(e) * 150, Math.sin(a) * Math.cos(e) * 150], i * 3);
      sSeed[i] = Math.random();
    }
    const starGeo = keep(new THREE.BufferGeometry());
    starGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
    starGeo.setAttribute("aSeed", new THREE.BufferAttribute(sSeed, 1));
    const stars = new THREE.Points(
      starGeo,
      keep(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: { uTime, uDpr: { value: renderer.getPixelRatio() } },
          vertexShader: /* glsl */ `
            attribute float aSeed;
            uniform float uTime;
            uniform float uDpr;
            varying float vA;
            void main() {
              vA = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.6 + aSeed * 1.8) + aSeed * 60.0));
              gl_PointSize = (1.0 + aSeed * 1.8) * uDpr;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`,
          fragmentShader: /* glsl */ `
            varying float vA;
            void main() {
              float d = length(gl_PointCoord - 0.5);
              gl_FragColor = vec4(vec3(1.0, 0.9, 0.72) * smoothstep(0.5, 0.1, d) * vA * 0.8, 1.0);
            }`,
        }),
      ),
    );
    stars.frustumCulled = false;
    scene.add(stars);

    // ── Fireworks ──────────────────────────────────────────
    const shells = calm ? 0 : small ? 5 : 9;
    const sparks = small ? 80 : 120; // per shell
    const TRAIL = 4; // each spark drags a short tail of fainter points
    const fwN = shells * sparks * TRAIL;
    const fwDir = new Float32Array(fwN * 3);
    const fwMeta = new Float32Array(fwN * 3);
    for (let i = 0; i < shells * sparks; i++) {
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const rnd = Math.random();
      for (let k = 0; k < TRAIL; k++) {
        fwDir.set([r * Math.cos(a), u, r * Math.sin(a)], (i * TRAIL + k) * 3);
        fwMeta.set([Math.floor(i / sparks), rnd, k], (i * TRAIL + k) * 3);
      }
    }
    const fwGeo = keep(new THREE.BufferGeometry());
    fwGeo.setAttribute("position", new THREE.BufferAttribute(fwDir, 3));
    fwGeo.setAttribute("aMeta", new THREE.BufferAttribute(fwMeta, 3));
    const fireworks = (flip: number, gain: number) =>
      keep(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: {
            uTime,
            uFire: { value: 0 },
            uSpread: { value: 12 },
            uDpr: { value: renderer.getPixelRatio() },
            uFlip: { value: flip },
            uGain: { value: gain },
          },
          vertexShader: /* glsl */ `
            attribute vec3 aMeta;
            uniform float uTime;
            uniform float uSpread;
            uniform float uDpr;
            uniform float uFlip;
            varying vec3 vCol;
            varying float vA;
            float hash(float n) { return fract(sin(n * 91.345) * 47453.5453); }
            void main() {
              float slot = aMeta.x;
              float rnd = aMeta.y;
              float tail = aMeta.z;
              float period = 3.1 + slot * 0.37;
              float tt = uTime + slot * 1.93 - tail * 0.055;
              float cyc = floor(tt / period);
              float t = tt - cyc * period;
              float id = slot * 13.7 + cyc * 3.1;
              vec3 origin = vec3((hash(id) - 0.5) * 2.0 * uSpread, 13.5 + hash(id + 4.0) * 8.5, ${(TEMPLE_Z - 16).toFixed(1)} + (hash(id + 9.0) - 0.5) * 10.0);
              float rise = 1.0;
              vec3 pos;
              float alpha;
              float size;
              if (t < rise) {
                // the rocket climbing, with a short tail
                float k = clamp(t / rise - rnd * 1.2, 0.0, 1.0);
                pos = vec3(origin.x + sin(k * 5.0 + slot) * 0.25, mix(1.0, origin.y, 1.0 - (1.0 - k) * (1.0 - k)), origin.z);
                alpha = step(rnd, 0.09) * (1.0 - rnd * 9.0) * step(0.001, k) * step(tail, 0.5) * 0.9;
                size = 2.6;
              } else {
                // the burst: fast out, slowing, sagging under gravity, twinkling as it dies
                float tb = t - rise;
                float life = 1.8 + hash(id + 2.0) * 0.5;
                float R = 7.0 + hash(id + 7.0) * 5.5;
                float shell = mix(0.72, 1.0, step(0.5, rnd)) * (0.9 + 0.1 * rnd);
                pos = origin + position * R * (1.0 - exp(-tb * 2.7)) * shell - vec3(0.0, 1.5 * tb * tb, 0.0);
                float f = clamp(1.0 - tb / life, 0.0, 1.0);
                float twinkle = mix(1.0, 0.45 + 0.55 * sin(uTime * 34.0 + rnd * 90.0), smoothstep(0.5, 0.2, f));
                alpha = (f * (0.35 + 0.65 * f) * twinkle + smoothstep(0.15, 0.0, tb)) * (1.0 - tail * 0.24);
                size = (3.6 + 3.4 * f) * (1.0 - tail * 0.16);
                // one spark per shell becomes the flash at the heart of the burst
                float heart = step(rnd, 0.012) * step(tail, 0.5);
                pos = mix(pos, origin, heart);
                size = mix(size, 90.0 * smoothstep(0.5, 0.0, tb), heart);
                alpha = mix(alpha, smoothstep(0.5, 0.0, tb) * 0.55, heart);
              }
              float pick = hash(id + 11.0);
              vec3 a = pick < 0.3 ? vec3(1.0, 0.76, 0.32) : pick < 0.55 ? vec3(1.0, 0.46, 0.1) : pick < 0.75 ? vec3(1.0, 0.36, 0.5) : pick < 0.9 ? vec3(1.0, 0.92, 0.74) : vec3(0.35, 0.9, 0.78);
              vCol = mix(a, vec3(1.0, 0.95, 0.85), step(0.5, rnd) * 0.35);
              vA = alpha;
              pos.y *= uFlip;
              vec4 mv = viewMatrix * vec4(pos, 1.0);
              gl_PointSize = size * uDpr * clamp(64.0 / -mv.z, 0.6, 2.0);
              gl_Position = projectionMatrix * mv;
            }`,
          fragmentShader: /* glsl */ `
            uniform float uFire;
            uniform float uGain;
            varying vec3 vCol;
            varying float vA;
            void main() {
              float d = length(gl_PointCoord - 0.5);
              float soft = smoothstep(0.5, 0.0, d);
              gl_FragColor = vec4(vCol * soft * soft * vA * uFire * uGain * 1.5, 1.0);
            }`,
        }),
      );
    const fwSky = fireworks(1, 1);
    const fwWater = fireworks(-1, 0.22);
    for (const m of [fwWater, fwSky]) {
      const pts = new THREE.Points(fwGeo, m);
      pts.frustumCulled = false;
      pts.renderOrder = m === fwWater ? 0.5 : 6;
      pts.visible = fwN > 0;
      scene.add(pts);
    }

    // ── Marigold petals ────────────────────────────────────
    const petalCount = calm ? 0 : small ? 70 : 130;
    const pData = new Float32Array(petalCount * 4);
    for (let i = 0; i < petalCount; i++) {
      pData.set([(Math.random() - 0.5) * 11, 9 - Math.random() * 16, Math.random(), 0.5 + Math.random() * 0.7], i * 4);
    }
    const petalGeo = keep(new THREE.InstancedBufferGeometry());
    const pq = quad();
    petalGeo.index = pq.index;
    petalGeo.setAttribute("position", pq.getAttribute("position"));
    petalGeo.setAttribute("uv", pq.getAttribute("uv"));
    petalGeo.setAttribute("aP", new THREE.InstancedBufferAttribute(pData, 4));
    petalGeo.instanceCount = petalCount;
    const petals = keep(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { uTime, uPetals: { value: 0 }, uCamZ: { value: 0 } },
        vertexShader: /* glsl */ `
          attribute vec4 aP;
          uniform float uTime;
          uniform float uPetals;
          uniform float uCamZ;
          varying vec2 vUv;
          varying float vS;
          varying float vA;
          void main() {
            float s = aP.z;
            float y = 8.5 - mod(uTime * aP.w + s * 8.5, 9.0);
            vec3 c = vec3(aP.x + sin(uTime * 0.7 + s * 20.0) * 0.45, y, aP.y + uCamZ - 13.0);
            float a = uTime * (1.4 + s) + s * 10.0;
            vec3 p = vec3(position.xy * 0.12, 0.0);
            p = vec3(p.x, p.y * cos(a), p.y * sin(a));
            float b = a * 0.7;
            p = vec3(p.x * cos(b) - p.y * sin(b), p.x * sin(b) + p.y * cos(b), p.z);
            vUv = uv;
            vS = s;
            vA = uPetals * smoothstep(0.0, 0.9, y) * smoothstep(8.5, 7.2, y);
            gl_Position = projectionMatrix * viewMatrix * vec4(c + p, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          varying float vS;
          varying float vA;
          void main() {
            vec2 q = (vUv - 0.5) * vec2(1.0, 1.45);
            float m = smoothstep(0.5, 0.4, length(q) * 1.25);
            vec3 col = mix(vec3(0.96, 0.46, 0.06), vec3(1.0, 0.78, 0.2), vS);
            gl_FragColor = vec4(col * (0.75 + 0.25 * vUv.y), m * vA);
          }`,
      }),
    );
    const petalMesh = add(petalGeo, petals, 7);
    petalMesh.visible = petalCount > 0;

    // ── Camera and frame loop ──────────────────────────────
    let rest = 13;
    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      sky.uniforms.uAspect.value = w / h;
      camera.updateProjectionMatrix();
      const tan = Math.tan((camera.fov * Math.PI) / 360) * 2;
      rest = fitDistance(camera.aspect, tan) + TEMPLE_Z;
      const spread = (rest - TEMPLE_Z + 16) * tan * camera.aspect * 0.42;
      fwSky.uniforms.uSpread.value = spread;
      fwWater.uniforms.uSpread.value = spread;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let px = 0;
    let targetPx = 0;
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === "mouse") targetPx = (e.clientX / window.innerWidth - 0.5) * 2;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    const timer = new THREE.Timer();
    timer.connect(document);
    const tmp = new THREE.Color();
    let onScreen = true;
    let raf = 0;
    const frame = () => {
      raf = 0;
      timer.update();
      const t = timer.getElapsed();
      const s = state.current;
      uTime.value = calm ? 0 : t;
      uLit.value = s.lit;
      flames.uniforms.uHint.value = s.lit < 0 ? 0.55 + 0.45 * Math.sin(t * 2.4) : 0;
      petals.uniforms.uPetals.value = s.petals;

      for (const f of finials) {
        f.mat.color.copy(tmp.copy(dimGold).lerp(litGold, THREE.MathUtils.smoothstep(s.lit, f.delay, f.delay + 0.9)));
      }
      const warm = THREE.MathUtils.smoothstep(s.lit, 0.4, 5.5);
      sky.uniforms.uWarm.value = warm * (1 - s.progress * 0.5);
      water.uniforms.uWarm.value = warm;
      const crownLit = THREE.MathUtils.smoothstep(s.lit, tierDelay(13), tierDelay(13) + 1);
      flagMat.color.setHex(0x8a4a2a).lerp(tmp.setHex(0xff8a1e), crownLit);
      dawn.uniforms.uGlow.value = crownLit * (0.16 + s.progress * 1.5);
      dawnMesh.scale.setScalar(2.2 + s.progress * 3);
      const fire = THREE.MathUtils.smoothstep(s.lit, 5.4, 6.4) * (1 - Math.min(1, s.progress * 1.4));
      fwSky.uniforms.uFire.value = fire;
      fwWater.uniforms.uFire.value = fire;

      px += (targetPx - px) * 0.05;
      const p = s.progress;
      const z = rest + (1 - s.intro) * 2.4 - p * (rest - TEMPLE_Z - 17);
      const y = 2.2 + p * 1.6;
      petals.uniforms.uCamZ.value = z;
      const tilt = 0.098 * (rest + 4.0) * (1 - p * 0.45);
      camera.position.set(px * 0.35, y, z);
      camera.lookAt(px * 0.1, y + tilt, z - rest - 4.0);
      stars.position.copy(camera.position);

      renderer.render(scene, camera);
      if (onScreen) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      if (onScreen && !raf) raf = requestAnimationFrame(frame);
    });
    io.observe(host);

    return () => {
      onScreen = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      timer.dispose();
      window.removeEventListener("pointermove", onPointer);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [state]);

  return <div ref={mount} className="scene" aria-hidden="true" />;
}
