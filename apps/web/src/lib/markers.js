/**
 * Marker artwork, generated rather than shipped as binaries.
 *
 * The same module feeds the printable sheet (/markers), the compiler
 * (/studio) and the synthetic-camera test (/dev/tracking-test), so a printed
 * marker and the compiled `.mind` can never drift apart.
 *
 * Two rules drive the art, and both come from how the tracker actually works:
 *
 * 1. Detail, contrast and asymmetry. Feature detection wants corners and
 *    edges — flat fields, gradients and thin repeating patterns give it
 *    nothing to hold on to.
 * 2. Every marker needs a different *structure*, not a different palette.
 *    Matching happens on greyscale, so three cards with the same layout in
 *    three colours are three near-identical targets, and the matcher will
 *    happily report the wrong one. Each marker below therefore gets its own
 *    macro-composition: plate in a different corner, a different dominant
 *    motif, and a different overall ink coverage.
 */

export const MARKER_W = 1200;
export const MARKER_H = 900;

export const MARKERS = [
  {
    id: 'chest',
    code: 'TR-01',
    kicker: 'Station one',
    title: 'The Sunken Chest',
    line: 'Below the tide line · 1931',
    ink: '#14110d',
    paper: '#f4efe4',
    accent: '#b3421c',
    seed: 20260821,
    layout: 'soundings',
  },
  {
    id: 'compass',
    code: 'TR-02',
    kicker: 'Station two',
    title: 'Brass Compass',
    line: 'Bearing unknown · magnetic north refused',
    ink: '#101a16',
    paper: '#eef1e6',
    accent: '#1f6f5c',
    seed: 77123,
    layout: 'rose',
  },
  {
    id: 'lantern',
    code: 'TR-03',
    kicker: 'Station three',
    title: 'Keeper’s Lantern',
    line: 'Still warm · wick trimmed',
    ink: '#151016',
    paper: '#f2ecef',
    accent: '#7a3ea8',
    seed: 4242,
    layout: 'beam',
  },
];

/** Deterministic PRNG: re-rendering must reproduce the art byte for byte. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Scattered dots inside a box — cheap, dense, non-repeating keypoints. */
function stipple(rand, { x, y, w, h, count, rMin = 1.5, rMax = 6 }, ink, accent) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const cx = x + rand() * w;
    const cy = y + rand() * h;
    const r = rMin + rand() * (rMax - rMin);
    parts.push(
      `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${rand() > 0.8 ? accent : ink}" opacity="${(0.3 + rand() * 0.6).toFixed(2)}"/>`,
    );
  }
  return parts.join('');
}

/** Rotated hard-edged blocks. Corners are the highest-value features. */
function blocks(rand, { x, y, w, h, count, size = 90 }, ink, accent) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const bw = 22 + rand() * size;
    const bh = 22 + rand() * size;
    const bx = x + rand() * w;
    const by = y + rand() * h;
    const rot = (rand() * 90 - 45).toFixed(1);
    parts.push(
      `<rect x="${bx.toFixed(0)}" y="${by.toFixed(0)}" width="${bw.toFixed(0)}" height="${bh.toFixed(0)}" fill="${rand() > 0.5 ? accent : ink}" opacity="${(0.5 + rand() * 0.45).toFixed(2)}" transform="rotate(${rot} ${(bx + bw / 2).toFixed(0)} ${(by + bh / 2).toFixed(0)})"/>`,
    );
  }
  return parts.join('');
}

/** The title plate. Its position is a big part of what makes markers distinct. */
function plate(marker, { x, y, w, h }) {
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${marker.ink}"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${marker.accent}" stroke-width="6"/>
  <text x="${x + 36}" y="${y + 72}" fill="${marker.accent}" font-size="30" letter-spacing="10" font-family="monospace">${marker.kicker.toUpperCase()}</text>
  <text x="${x + 36}" y="${y + 152}" fill="${marker.paper}" font-size="66" font-family="Georgia, serif">${marker.title}</text>
  <text x="${x + 36}" y="${y + 210}" fill="${marker.paper}" font-size="26" opacity="0.75" font-family="Georgia, serif">${marker.line}</text>`;
}

/* --- one composition per marker -------------------------------------------
 * Each layout owns a different half of the canvas, a different dominant shape
 * and a different ink weight, so the three targets stay far apart in greyscale.
 */
const LAYOUTS = {
  /** Chart soundings: horizontal contour lines, plate bottom-left, dial top-right. */
  soundings(m, rand) {
    const lines = [];
    for (let i = 0; i < 8; i++) {
      const pts = [];
      let x = -20;
      let y = 90 + i * 100 + rand() * 40;
      while (x < 1220) {
        pts.push(`${x.toFixed(0)},${y.toFixed(0)}`);
        x += 30 + rand() * 70;
        y += (rand() - 0.5) * 95;
      }
      lines.push(
        `<polyline points="${pts.join(' ')}" fill="none" stroke="${m.ink}" stroke-width="${(1.4 + rand() * 2.4).toFixed(1)}" opacity="0.42"/>`,
      );
    }
    return `
    ${lines.join('')}
    ${stipple(rand, { x: 600, y: 60, w: 560, h: 460, count: 200 }, m.ink, m.accent)}
    ${blocks(rand, { x: 60, y: 60, w: 500, h: 420, count: 11 }, m.ink, m.accent)}
    <circle cx="1010" cy="250" r="120" fill="none" stroke="${m.accent}" stroke-width="16"/>
    <circle cx="1010" cy="250" r="46" fill="${m.ink}"/>
    <path d="M1010 130 v240 M890 250 h240" stroke="${m.ink}" stroke-width="7" opacity="0.6"/>
    ${plate(m, { x: 60, y: 560, w: 760, h: 280 })}
    <g stroke="${m.ink}" stroke-width="10" fill="none">
      <path d="M40 40 h130 M40 40 v130"/>
      <path d="M1160 860 h-80 M1160 860 v-80"/>
    </g>
    <text x="1080" y="560" fill="${m.ink}" font-size="46" text-anchor="middle" font-family="monospace" letter-spacing="4">${m.code}</text>`;
  },

  /** Compass rose: heavy concentric rings bottom-left, plate top-right, sparse field. */
  rose(m, rand) {
    const rays = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const inner = i % 4 === 0 ? 60 : 130;
      const outer = i % 2 === 0 ? 250 : 195;
      rays.push(
        `<line x1="${(330 + Math.cos(a) * inner).toFixed(0)}" y1="${(560 + Math.sin(a) * inner).toFixed(0)}" x2="${(330 + Math.cos(a) * outer).toFixed(0)}" y2="${(560 + Math.sin(a) * outer).toFixed(0)}" stroke="${i % 4 === 0 ? m.accent : m.ink}" stroke-width="${i % 2 === 0 ? 16 : 7}"/>`,
      );
    }
    const grid = [];
    for (let i = 0; i < 9; i++) {
      const x = 700 + i * 54;
      grid.push(`<rect x="${x}" y="${760 + (i % 3) * 26}" width="40" height="${44 + (i % 4) * 20}" fill="${i % 3 === 0 ? m.accent : m.ink}" opacity="0.85"/>`);
    }
    return `
    ${stipple(rand, { x: 40, y: 40, w: 1120, h: 300, count: 130, rMax: 4 }, m.ink, m.accent)}
    <circle cx="330" cy="560" r="255" fill="none" stroke="${m.ink}" stroke-width="12"/>
    <circle cx="330" cy="560" r="190" fill="none" stroke="${m.ink}" stroke-width="5" opacity="0.7"/>
    <circle cx="330" cy="560" r="120" fill="none" stroke="${m.accent}" stroke-width="22"/>
    ${rays.join('')}
    <circle cx="330" cy="560" r="42" fill="${m.ink}"/>
    ${grid.join('')}
    ${blocks(rand, { x: 640, y: 380, w: 480, h: 300, count: 9, size: 70 }, m.ink, m.accent)}
    ${plate(m, { x: 440, y: 60, w: 700, h: 260 })}
    <g stroke="${m.ink}" stroke-width="12" fill="none">
      <path d="M44 44 h150"/>
      <path d="M44 856 v-110"/>
    </g>
    <text x="64" y="190" fill="${m.ink}" font-size="72" font-family="monospace" letter-spacing="8">${m.code}</text>`;
  },

  /** Lantern beam: hard diagonal wedges from the top-right, plate on the left, dense stipple. */
  beam(m, rand) {
    const wedges = [];
    for (let i = 0; i < 7; i++) {
      const spread = 60 + i * 96;
      wedges.push(
        `<path d="M1160 40 L${(1160 - spread).toFixed(0)} 900 L${(1160 - spread - 58).toFixed(0)} 900 Z" fill="${i % 2 ? m.accent : m.ink}" opacity="${(0.16 + (i % 3) * 0.14).toFixed(2)}"/>`,
      );
    }
    const bars = [];
    for (let i = 0; i < 14; i++) {
      bars.push(`<rect x="${60 + i * 40}" y="${820 - (i % 5) * 30}" width="24" height="${40 + (i % 5) * 30}" fill="${i % 4 === 0 ? m.accent : m.ink}"/>`);
    }
    return `
    ${wedges.join('')}
    ${stipple(rand, { x: 40, y: 40, w: 700, h: 480, count: 300, rMax: 7 }, m.ink, m.accent)}
    <rect x="820" y="470" width="300" height="300" fill="none" stroke="${m.ink}" stroke-width="14"/>
    <rect x="880" y="530" width="180" height="180" fill="${m.accent}"/>
    <rect x="930" y="580" width="80" height="80" fill="${m.paper}"/>
    ${bars.join('')}
    ${blocks(rand, { x: 80, y: 120, w: 560, h: 320, count: 8, size: 110 }, m.ink, m.accent)}
    ${plate(m, { x: 60, y: 540, w: 700, h: 250 })}
    <g stroke="${m.ink}" stroke-width="10" fill="none">
      <path d="M40 40 v160 M40 40 h70"/>
    </g>
    <text x="470" y="120" fill="${m.ink}" font-size="52" text-anchor="middle" font-family="monospace" letter-spacing="6">${m.code}</text>`;
  },
};

export function markerSvg(marker) {
  const rand = rng(marker.seed);
  const body = LAYOUTS[marker.layout](marker, rand);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARKER_W} ${MARKER_H}" width="${MARKER_W}" height="${MARKER_H}">
  <rect width="${MARKER_W}" height="${MARKER_H}" fill="${marker.paper}"/>
  ${body}
</svg>`;
}

export const markerDataUri = (marker) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markerSvg(marker))}`;

/** Rasterise one marker to a fully decoded HTMLImageElement. */
export function markerImage(marker, scale = 1) {
  return new Promise((resolve, reject) => {
    const svg = new Image();
    svg.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = MARKER_W * scale;
      canvas.height = MARKER_H * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(svg, 0, 0, canvas.width, canvas.height);

      // The compiler and the tracker both want a decoded raster, not the SVG.
      const png = new Image();
      png.onload = () => resolve(png);
      png.onerror = reject;
      png.src = canvas.toDataURL('image/png');
    };
    svg.onerror = () => reject(new Error(`Could not rasterise marker "${marker.id}"`));
    svg.src = markerDataUri(marker);
  });
}

export const markerBlob = (marker, scale = 1) =>
  markerImage(marker, scale).then(
    (img) =>
      new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        canvas.toBlob(resolve, 'image/png');
      }),
  );
