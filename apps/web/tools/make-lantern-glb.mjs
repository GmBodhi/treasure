#!/usr/bin/env node
/**
 * Generate public/models/lantern.glb — the 3D model shown on marker TR-03.
 *
 * The asset is generated rather than vendored so the repository stays small and
 * has no third-party model licence to track. Pure Node, no dependencies: a GLB
 * is a 12-byte header, a JSON chunk, and a binary chunk.
 *
 *   node tools/make-lantern-glb.mjs [outPath]
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const TAU = Math.PI * 2;

/** A mesh under construction: positions/normals as flat arrays, plus indices. */
function mesh(material) {
  return { positions: [], normals: [], indices: [], material };
}

function addTriangle(m, a, b, c, na, nb, nc) {
  const base = m.positions.length / 3;
  for (const [p, n] of [[a, na], [b, nb], [c, nc]]) {
    m.positions.push(p[0], p[1], p[2]);
    m.normals.push(n[0], n[1], n[2]);
  }
  m.indices.push(base, base + 1, base + 2);
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}
const faceNormal = (a, b, c) => normalize(cross(sub(b, a), sub(c, a)));

/** Flat-shaded quad, wound counter-clockwise when viewed from the front. */
function addQuad(m, a, b, c, d) {
  const n = faceNormal(a, b, c);
  addTriangle(m, a, b, c, n, n, n);
  addTriangle(m, a, c, d, n, n, n);
}

/** Truncated cone / cylinder along +Y, centred on the origin of `yBottom`. */
function tube(m, { rBottom, rTop, yBottom, yTop, segments = 16, cap = true }) {
  for (let i = 0; i < segments; i++) {
    const t0 = (i / segments) * TAU;
    const t1 = ((i + 1) / segments) * TAU;
    const b0 = [Math.cos(t0) * rBottom, yBottom, Math.sin(t0) * rBottom];
    const b1 = [Math.cos(t1) * rBottom, yBottom, Math.sin(t1) * rBottom];
    const t0p = [Math.cos(t0) * rTop, yTop, Math.sin(t0) * rTop];
    const t1p = [Math.cos(t1) * rTop, yTop, Math.sin(t1) * rTop];
    addQuad(m, b0, b1, t1p, t0p);

    if (!cap) continue;
    if (rBottom > 0) addTriangle(m, [0, yBottom, 0], b1, b0, [0, -1, 0], [0, -1, 0], [0, -1, 0]);
    if (rTop > 0) addTriangle(m, [0, yTop, 0], t0p, t1p, [0, 1, 0], [0, 1, 0], [0, 1, 0]);
  }
}

/** Axis-aligned box between two corners. */
function box(m, [x0, y0, z0], [x1, y1, z1]) {
  const p = [
    [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
    [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1],
  ];
  addQuad(m, p[3], p[2], p[6], p[7]); // front (+z)
  addQuad(m, p[1], p[0], p[4], p[5]); // back  (-z)
  addQuad(m, p[0], p[3], p[7], p[4]); // left
  addQuad(m, p[2], p[1], p[5], p[6]); // right
  addQuad(m, p[4], p[7], p[6], p[5]); // top
  addQuad(m, p[0], p[1], p[2], p[3]); // bottom
}

/** UV sphere; enough for a flame blob. */
function sphere(m, { radius, cy, rings = 10, segments = 14 }) {
  for (let r = 0; r < rings; r++) {
    const p0 = (r / rings) * Math.PI;
    const p1 = ((r + 1) / rings) * Math.PI;
    for (let s = 0; s < segments; s++) {
      const t0 = (s / segments) * TAU;
      const t1 = ((s + 1) / segments) * TAU;
      const at = (phi, theta) => [
        Math.sin(phi) * Math.cos(theta) * radius,
        Math.cos(phi) * radius + cy,
        Math.sin(phi) * Math.sin(theta) * radius,
      ];
      addQuad(m, at(p0, t0), at(p0, t1), at(p1, t1), at(p1, t0));
    }
  }
}

// --- the lantern ------------------------------------------------------------
// Modelled around the origin, roughly 1 unit tall, so a 0.3 scale in the scene
// reads as a palm-sized object sitting on the marker.

const brass = mesh(0);
const iron = mesh(1);
const glass = mesh(2);
const flame = mesh(3);

tube(brass, { rBottom: 0.30, rTop: 0.26, yBottom: 0.00, yTop: 0.08 });   // foot
tube(brass, { rBottom: 0.26, rTop: 0.22, yBottom: 0.08, yTop: 0.12 });   // collar
tube(glass, { rBottom: 0.22, rTop: 0.22, yBottom: 0.12, yTop: 0.56, cap: false, segments: 20 });
tube(brass, { rBottom: 0.24, rTop: 0.20, yBottom: 0.56, yTop: 0.62 });   // shoulder
tube(brass, { rBottom: 0.20, rTop: 0.04, yBottom: 0.62, yTop: 0.80 });   // cone roof
tube(brass, { rBottom: 0.05, rTop: 0.05, yBottom: 0.80, yTop: 0.86 });   // finial

// Four corner posts, so the silhouette is not a featureless cylinder.
for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
  const x = 0.155 * dx;
  const z = 0.155 * dz;
  box(iron, [x - 0.018, 0.10, z - 0.018], [x + 0.018, 0.58, z + 0.018]);
}

// Handle: a squared-off bail rather than a torus, which keeps the poly count low.
box(iron, [-0.19, 0.86, -0.02], [-0.15, 1.02, 0.02]);
box(iron, [0.15, 0.86, -0.02], [0.19, 1.02, 0.02]);
box(iron, [-0.19, 1.02, -0.02], [0.19, 1.06, 0.02]);

sphere(flame, { radius: 0.085, cy: 0.30 });
tube(flame, { rBottom: 0.05, rTop: 0.0, yBottom: 0.36, yTop: 0.50, segments: 10 });
tube(iron, { rBottom: 0.012, rTop: 0.012, yBottom: 0.13, yTop: 0.26, segments: 6 }); // wick post

const meshes = [brass, iron, glass, flame];

const MATERIALS = [
  { name: 'brass', pbrMetallicRoughness: { baseColorFactor: [0.83, 0.63, 0.24, 1], metallicFactor: 0.9, roughnessFactor: 0.35 } },
  { name: 'iron', pbrMetallicRoughness: { baseColorFactor: [0.16, 0.16, 0.18, 1], metallicFactor: 0.7, roughnessFactor: 0.55 } },
  {
    name: 'glass',
    doubleSided: true,
    alphaMode: 'BLEND',
    pbrMetallicRoughness: { baseColorFactor: [0.85, 0.92, 0.9, 0.28], metallicFactor: 0.0, roughnessFactor: 0.12 },
  },
  {
    name: 'flame',
    emissiveFactor: [1, 0.62, 0.16],
    pbrMetallicRoughness: { baseColorFactor: [1, 0.78, 0.35, 1], metallicFactor: 0, roughnessFactor: 0.9 },
  },
];

// --- glTF assembly ----------------------------------------------------------

const bufferViews = [];
const accessors = [];
const chunks = [];
let offset = 0;

/** Append raw bytes, keeping every bufferView 4-byte aligned as glTF requires. */
function pushView(buf, target) {
  const padding = (4 - (offset % 4)) % 4;
  if (padding) {
    chunks.push(Buffer.alloc(padding));
    offset += padding;
  }
  bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, target });
  chunks.push(buf);
  offset += buf.length;
  return bufferViews.length - 1;
}

const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;

function floatAccessor(values, componentCount) {
  const buf = Buffer.alloc(values.length * 4);
  values.forEach((v, i) => buf.writeFloatLE(v, i * 4));
  const min = new Array(componentCount).fill(Infinity);
  const max = new Array(componentCount).fill(-Infinity);
  for (let i = 0; i < values.length; i++) {
    const c = i % componentCount;
    min[c] = Math.min(min[c], values[i]);
    max[c] = Math.max(max[c], values[i]);
  }
  accessors.push({
    bufferView: pushView(buf, ARRAY_BUFFER),
    componentType: 5126, // FLOAT
    count: values.length / componentCount,
    type: componentCount === 3 ? 'VEC3' : 'VEC2',
    min,
    max,
  });
  return accessors.length - 1;
}

function indexAccessor(indices) {
  const buf = Buffer.alloc(indices.length * 4);
  indices.forEach((v, i) => buf.writeUInt32LE(v, i * 4));
  accessors.push({
    bufferView: pushView(buf, ELEMENT_ARRAY_BUFFER),
    componentType: 5125, // UNSIGNED_INT
    count: indices.length,
    type: 'SCALAR',
  });
  return accessors.length - 1;
}

const primitives = meshes.map((m) => ({
  attributes: { POSITION: floatAccessor(m.positions, 3), NORMAL: floatAccessor(m.normals, 3) },
  indices: indexAccessor(m.indices),
  material: m.material,
}));

const binary = Buffer.concat(chunks);

const gltf = {
  asset: { version: '2.0', generator: 'treasure-ar/tools/make-lantern-glb.mjs' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ name: 'Lantern', mesh: 0 }],
  meshes: [{ name: 'Lantern', primitives }],
  materials: MATERIALS,
  accessors,
  bufferViews,
  buffers: [{ byteLength: binary.length }],
};

/** Wrap JSON + BIN into the GLB container. Both chunks are 4-byte padded. */
function glb(json, bin) {
  const pad = (buf, filler) => {
    const extra = (4 - (buf.length % 4)) % 4;
    return extra ? Buffer.concat([buf, Buffer.alloc(extra, filler)]) : buf;
  };
  const jsonChunk = pad(Buffer.from(JSON.stringify(json), 'utf8'), 0x20);
  const binChunk = pad(bin, 0);

  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);

  const chunkHeader = (length, type) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(length, 0);
    h.writeUInt32LE(type, 4);
    return h;
  };

  return Buffer.concat([
    header,
    chunkHeader(jsonChunk.length, 0x4e4f534a), // 'JSON'
    jsonChunk,
    chunkHeader(binChunk.length, 0x004e4942), // 'BIN'
    binChunk,
  ]);
}

const outPath = process.argv[2] ?? 'public/models/lantern.glb';
await fs.mkdir(path.dirname(path.resolve(outPath)), { recursive: true });
await fs.writeFile(outPath, glb(gltf, binary));

const triangles = meshes.reduce((n, m) => n + m.indices.length / 3, 0);
const { size } = await fs.stat(outPath);
console.log(`wrote ${outPath} — ${triangles} triangles, ${meshes.length} materials, ${(size / 1024).toFixed(1)} KB`);
