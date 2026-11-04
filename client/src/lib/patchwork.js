/**
 * Draws the village as seen from above: patchwork field plots separated by thin bunds.
 * Deterministic (same seed -> same picture), so it needs no image files and stays sharp at any size.
 * It is the site's fallback "photo" until real photos are uploaded.
 */

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// greens (crops), yellows (mustard), browns (ploughed), pale (fallow)
const FILLS = [
  '#4f8a3a', '#5f9a3f', '#6fa33a', '#2f6e44', '#3b7d4a', '#86b04a',
  '#e3a512', '#d9a21b', '#c98a1c',
  '#8b5e3c', '#7a4a2b', '#a47649',
  '#d8d0a8', '#c9c58f',
];

export function makePlots(seed, w = 120, h = 70, count = 16) {
  const rnd = mulberry32(hash(String(seed)));
  let rects = [{ x: 0, y: 0, w, h }];
  while (rects.length < count) {
    rects.sort((a, b) => b.w * b.h - a.w * a.h);
    const r = rects.shift();
    const vertical = r.w * 0.8 > r.h ? true : r.h * 0.8 > r.w ? false : rnd() > 0.5;
    const t = 0.34 + rnd() * 0.32;
    if (vertical) {
      const w1 = r.w * t;
      rects.push({ x: r.x, y: r.y, w: w1, h: r.h }, { x: r.x + w1, y: r.y, w: r.w - w1, h: r.h });
    } else {
      const h1 = r.h * t;
      rects.push({ x: r.x, y: r.y, w: r.w, h: h1 }, { x: r.x, y: r.y + h1, w: r.w, h: r.h - h1 });
    }
  }

  // Nudge shared corners so plots look hand-marked rather than ruled; keep the outer edge straight.
  const nudges = new Map();
  const nudge = (x, y) => {
    const key = `${x.toFixed(2)},${y.toFixed(2)}`;
    if (!nudges.has(key)) {
      const dx = x <= 0.01 || x >= w - 0.01 ? 0 : (rnd() - 0.5) * 0.18 * Math.min(w, h);
      const dy = y <= 0.01 || y >= h - 0.01 ? 0 : (rnd() - 0.5) * 0.18 * Math.min(w, h);
      nudges.set(key, [dx, dy]);
    }
    const [dx, dy] = nudges.get(key);
    return [x + dx, y + dy];
  };

  return rects.map((r, i) => {
    const pts = [nudge(r.x, r.y), nudge(r.x + r.w, r.y), nudge(r.x + r.w, r.y + r.h), nudge(r.x, r.y + r.h)];
    return {
      points: pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
      fill: FILLS[Math.floor(rnd() * FILLS.length)],
      i,
    };
  });
}
