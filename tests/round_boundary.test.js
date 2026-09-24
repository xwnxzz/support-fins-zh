// ROUND-BOUNDARY support: a round overhang's supportable strip is only a few mm
// deep where it meets the part's boundary (the rim), and it used to get NOTHING.
//
// The bug (reported against a circular model): auto placement put no fins on a ball
// bottom -- the readout said "无法放置 / no usable face" and only the central bed pad
// was built. Two gates caused it:
//   1. buildProps kept only the LONGEST usable run per track, so on a chord across a
//      radially symmetric cap one of the two rim runs was thrown away; and
//   2. `minSpan` (7mm) refused the remaining rim run outright: on a small ball the
//      supportable strip is ~5mm, so every track was counted `stub`.
//
// This file pins the fix, its SCOPE, and the cases it deliberately does NOT serve.
// Every expectation below is a MEASURED number, not a hope -- if a future change moves
// one, read the test it broke before "fixing" the test.
import { buildTopology, analyze, fins, prop, assert } from './_util.js';

const { PROP } = prop;
const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const AUTO = { mode: 'auto', bedPad: true, tines: true, coverage: 0.5, layerHeight: 0.2 };

const topoOf = (L) => {
  const array = Float64Array.from(L);
  return buildTopology({ getAttribute: () => ({ array, count: array.length / 3 }) });
};
const build = (L) => {
  const topo = topoOf(L);
  const res = analyze(topo, 45, IDENTITY);
  return { topo, res, built: fins.buildFins(topo, res, IDENTITY, AUTO) };
};

// --- shape builders (outward winding; verified by the signed volume in each test) ---
const P = (r, t, z) => [r * Math.cos(t), r * Math.sin(t), z];

function sphere(R, seg = 48, rings = 24) {
  const L = [];
  const tri = (a, b, c) => L.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  const at = (i, j) => {
    const phi = (i / rings) * Math.PI, th = (j / seg) * 2 * Math.PI;
    return [R * Math.sin(phi) * Math.cos(th), R * Math.sin(phi) * Math.sin(th),
            R + R * Math.cos(phi)];
  };
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < seg; j++) {
      const a = at(i, j), b = at(i, j + 1), c = at(i + 1, j + 1), d = at(i + 1, j);
      if (i === 0) tri(a, d, c);
      else if (i === rings - 1) tri(a, c, b);
      else { tri(a, d, c); tri(a, c, b); }
    }
  }
  return L;
}

function sphereTopo(R, seg, rings) { return topoOf(sphere(R, seg, rings)); }

function disc(L, z, r, seg, up) {
  const tri = (a, b, c) => L.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  for (let i = 0; i < seg; i++) {
    const t0 = (i / seg) * 2 * Math.PI, t1 = ((i + 1) / seg) * 2 * Math.PI;
    const a = P(r, t0, z), b = P(r, t1, z);
    up ? tri([0, 0, z], a, b) : tri([0, 0, z], b, a);
  }
}

function annulus(L, z, ri, ro, seg, up) {
  const tri = (a, b, c) => L.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  for (let i = 0; i < seg; i++) {
    const t0 = (i / seg) * 2 * Math.PI, t1 = ((i + 1) / seg) * 2 * Math.PI;
    const i0 = P(ri, t0, z), i1 = P(ri, t1, z), o0 = P(ro, t0, z), o1 = P(ro, t1, z);
    if (up) { tri(i0, o0, o1); tri(i0, o1, i1); } else { tri(i0, i1, o1); tri(i0, o1, o0); }
  }
}

function tube(L, z0, z1, r, seg) {
  const tri = (a, b, c) => L.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  for (let i = 0; i < seg; i++) {
    const t0 = (i / seg) * 2 * Math.PI, t1 = ((i + 1) / seg) * 2 * Math.PI;
    const a0 = P(r, t0, z0), a1 = P(r, t1, z0), b0 = P(r, t0, z1), b1 = P(r, t1, z1);
    tri(a0, a1, b1); tri(a0, b1, b0);
  }
}

function frustum(L, z0, r0, z1, r1, seg) {
  const tri = (a, b, c) => L.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  for (let i = 0; i < seg; i++) {
    const t0 = (i / seg) * 2 * Math.PI, t1 = ((i + 1) / seg) * 2 * Math.PI;
    const a0 = P(r0, t0, z0), a1 = P(r0, t1, z0), b0 = P(r1, t0, z1), b1 = P(r1, t1, z1);
    tri(a0, a1, b1); tri(a0, b1, b0);
  }
}

function box(L, x0, y0, z0, x1, y1, z1) {
  const tri = (a, b, c) => L.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  const quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
  const A = [x0, y0, z0], B = [x1, y0, z0], C = [x1, y1, z0], D = [x0, y1, z0];
  const E = [x0, y0, z1], F = [x1, y0, z1], G = [x1, y1, z1], H = [x0, y1, z1];
  quad(A, D, C, B); quad(E, F, G, H);
  quad(A, B, F, E); quad(B, C, G, F); quad(C, D, H, G); quad(D, A, E, H);
}

/** stem + wide cap: the cap's underside is a FLAT annulus (the level control case) */
function mushroom(seg = 64) {
  const L = [];
  disc(L, 0, 6, seg, false); tube(L, 0, 20, 6, seg);
  annulus(L, 20, 6, 20, seg, false); tube(L, 20, 24, 20, seg); disc(L, 24, 20, seg, true);
  return L;
}

/** apex-down shallow cone: a CONVEX round underside whose rim tapers off */
function cone(seg = 64) {
  const L = [];
  disc(L, 0, 4, seg, false); frustum(L, 0, 4, 8, 30, seg);
  tube(L, 8, 12, 30, seg); disc(L, 12, 30, seg, true);
  return L;
}

/** CONCAVE underside dipping to its lowest at rMid -> lowest points form a RING */
function bowl(seg = 64) {
  const L = [];
  const ri = 10, ro = 34, rMid = 22, zRim = 8, zLow = 3, top = 14, nR = 12;
  const zAt = (r) => zRim - (zRim - zLow) * (1 - ((r - rMid) / (ro - ri) * 2) ** 2);
  const tri = (a, b, c) => L.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  for (let j = 0; j < nR; j++) {
    const r0 = ri + ((ro - ri) * j) / nR, r1 = ri + ((ro - ri) * (j + 1)) / nR;
    for (let i = 0; i < seg; i++) {
      const t0 = (i / seg) * 2 * Math.PI, t1 = ((i + 1) / seg) * 2 * Math.PI;
      const a = P(r0, t0, zAt(r0)), b = P(r0, t1, zAt(r0));
      const c = P(r1, t1, zAt(r1)), d = P(r1, t0, zAt(r1));
      tri(a, b, c); tri(a, c, d);
    }
  }
  tube(L, zAt(ri), top, ri, seg); tube(L, zAt(ro), top, ro, seg);
  annulus(L, top, ri, ro, seg, true);
  return L;
}

/** cylinder lying on its side: the overhang is a shallow 21mm-wide band */
function lyingCylinder(r = 15, half = 30, seg = 48) {
  const L = [];
  const tri = (a, b, c) => L.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  const at = (i, j) => {
    const th = (j / seg) * 2 * Math.PI;
    return [i === 0 ? -half : half, r * Math.sin(th), r - r * Math.cos(th)];
  };
  for (let j = 0; j < seg; j++) {
    const a = at(0, j), b = at(0, j + 1), c = at(1, j + 1), d = at(1, j);
    tri(a, b, c); tri(a, c, d);
  }
  for (const [s, rev] of [[-half, true], [half, false]]) {
    const c = [s, 0, r];
    for (let j = 0; j < seg; j++) {
      const t0 = (j / seg) * 2 * Math.PI, t1 = ((j + 1) / seg) * 2 * Math.PI;
      const a = [s, r * Math.sin(t0), r - r * Math.cos(t0)];
      const b = [s, r * Math.sin(t1), r - r * Math.cos(t1)];
      rev ? tri(c, a, b) : tri(c, b, a);
    }
  }
  return L;
}

/** LEVEL picture-frame overhang (5mm bars) on a column: level surface cut by VOIDS */
function frame(bar = 5, outer = 20, height = 15) {
  const L = [];
  const inner = outer - bar;
  box(L, -3, -3, 0, 3, 3, height);
  box(L, -outer, -outer, height, -inner, outer, height + 3);
  box(L, inner, -outer, height, outer, outer, height + 3);
  box(L, -inner, -outer, height, inner, -inner, height + 3);
  box(L, -inner, inner, height, inner, outer, height + 3);
  return L;
}

// --- helpers ------------------------------------------------------------------
function wallsOf(built) { return built.props ?? []; }
function radiiOf(built) {
  return wallsOf(built).map((q) => {
    const a = q.line[0], b = q.line[q.line.length - 1];
    return Math.hypot((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  });
}

// --- 1. the reported bug ------------------------------------------------------

Deno.test('round: a ball bottom gets fins on its BOUNDARY (the reported bug)', () => {
  const { res, built } = build(sphere(20));
  assert(res.regions.length === 1, `expected one overhang region, got ${res.regions.length}`);
  assert(wallsOf(built).length >= 1,
    `round bottom got no support (fins=${built.fins.length}, skipped=${JSON.stringify(built.skipped)})`);

  const bandOuter = 20 * Math.sin(Math.PI / 4);            // 45deg from the bottom pole
  for (const rr of radiiOf(built)) {
    assert(rr > 4, `a wall stands under the pole (radius ${rr.toFixed(1)}mm), not on the rim`);
    assert(rr <= bandOuter + 1, `a wall stands outside the overhang band (${rr.toFixed(1)}mm)`);
  }
  for (const q of wallsOf(built)) {
    assert(q.height > PROP.minHeight, `wall shorter than the floor: ${q.height.toFixed(1)}mm`);
  }
});

// --- 2. SIZE matrix: the rim floor is a fixed mm bar, so what happens as R moves? --

Deno.test('round: sphere size matrix (R = 2..100) -- served where it can be, silent where it cannot', () => {
  // Measured: the rim strip depth is R(1-cos45) = 0.29R, so R >= 20 (strip >= 5.9mm)
  // has room for a real wall, and R <= 10 (strip <= 2.9mm, i.e. under two layers at
  // 0.2mm) has nothing a slicer could print. Nothing here may throw, and nothing may
  // silently claim success: a 0-wall result must be explained by the skip counters.
  const measured = {
    2: { regions: 0, walls: 0 },      // strip 0.6mm: not even a region (under MIN_REGION_AREA)
    5: { regions: 1, walls: 0 },      // strip 1.5mm: regions exist, every patch is a sliver
    10: { regions: 1, walls: 0 },     // strip 2.9mm: too shallow for a wall
    20: { regions: 1, walls: 2 },     // strip 5.9mm: the rim walls the fix restores
    40: { regions: 1, walls: 2 },
    100: { regions: 1, walls: 2 },
  };
  for (const [R, want] of Object.entries(measured)) {
    const { res, built } = build(sphere(Number(R)));
    const walls = wallsOf(built).length;
    assert(res.regions.length === want.regions,
      `R=${R}: expected ${want.regions} overhang region(s), got ${res.regions.length}`);
    assert(walls === want.walls,
      `R=${R}: expected ${want.walls} wall(s), got ${walls} (skipped=${JSON.stringify(built.skipped)})`);
    if (walls > 0) {
      // The floor that applies depends on the strip: R=20 is served BY the rim floor
      // (5.0mm walls), while R>=40's strip is deep enough that the ordinary minSpan
      // path serves it (measured 15.8mm / 51.7mm).
      const spans = wallsOf(built).map((q) => q.span);
      assert(Math.min(...spans) >= PROP.minSpanShort,
        `R=${R}: a ${Math.min(...spans).toFixed(1)}mm wall is under even the rim floor`);
      if (Number(R) >= 40) {
        assert(Math.min(...spans) >= PROP.minSpan,
          `R=${R}: a strip this deep should be served by the ordinary minSpan path, `
          + `got ${Math.min(...spans).toFixed(1)}mm`);
      }
    } else if (res.regions.length > 0) {
      const sk = built.skipped ?? {};
      const explained = (sk.sliver ?? 0) + (sk.noLine ?? 0) + (sk.stub ?? 0) + (sk.blocked ?? 0);
      assert(explained > 0, `R=${R}: regions exist but no walls AND no recorded reason -- silence`);
    }
  }
});

// --- 3. MESH DENSITY: the fix must not depend on how finely the round is tessellated --

Deno.test('round: sphere mesh-density matrix (R=20) -- works from 32 segments up', () => {
  // Measured: 32/16, 48/24 and 96/48 place the two rim walls; a very coarse 16/8 mesh
  // does not (its tracks are cut short enough to fall under the rim floor: stub:6,
  // blocked:3). That is a REAL limitation of the current gate, pinned here so it
  // cannot change unnoticed -- a round part exported at 16 segments will get no
  // support, and the fix for that is a separate change (density-aware sampling),
  // not a quiet relaxation of this test.
  for (const [seg, rings] of [[32, 16], [48, 24], [96, 48]]) {
    const topo = sphereTopo(20, seg, rings);
    const res = analyze(topo, 45, IDENTITY);
    const built = fins.buildFins(topo, res, IDENTITY, AUTO);
    assert(wallsOf(built).length >= 1,
      `${seg}/${rings} mesh: expected a rim wall, got ${wallsOf(built).length} `
      + `(skipped=${JSON.stringify(built.skipped)})`);
  }
  const coarse = sphereTopo(20, 16, 8);
  const coarseBuilt = fins.buildFins(coarse, analyze(coarse, 45, IDENTITY), IDENTITY, AUTO);
  assert(wallsOf(coarseBuilt).length === 0,
    `16/8 mesh unexpectedly got ${wallsOf(coarseBuilt).length} wall(s) -- re-measure and, if the `
    + 'coarse case is now served, update this note instead of leaving a stale expectation');
});

// --- 4. other round shapes: convex cone served, concave bowl NOT (documented gap) --

Deno.test('round: a shallow CONE underside is served (convex rim)', () => {
  const { res, built } = build(cone());
  assert(res.regions.length === 1, `expected one region, got ${res.regions.length}`);
  assert(wallsOf(built).length >= 3,
    `a shallow cone underside should get rows of walls, got ${wallsOf(built).length}`);
  for (const q of wallsOf(built)) {
    assert(q.span >= PROP.minSpan, `cone wall under minSpan: ${q.span.toFixed(1)}mm`);
  }
});

Deno.test('round: a CONCAVE bowl (ring-lowest) is still refused -- known gap, not a crash', () => {
  // Its lowest points form a ring, so there is no straight contact line to sweep: the
  // engine counts noLine/stub/blocked and builds nothing. Pinned so the gap is visible
  // and so a future bowl implementation has to come here and change this expectation.
  const { res, built } = build(bowl());
  assert(res.regions.length >= 1, 'the bowl does have overhang regions');
  assert(wallsOf(built).length === 0,
    `bowl suddenly produced ${wallsOf(built).length} wall(s) -- if that is the new intended `
    + 'behaviour, replace this gap test with the real requirement');
  const sk = built.skipped ?? {};
  assert((sk.stub ?? 0) + (sk.blocked ?? 0) + (sk.noLine ?? 0) > 0,
    'the refusal must be recorded in the skip counters, never silent');
});

Deno.test('round: a lying cylinder still gets only the central wedge -- known gap', () => {
  const { res, built } = build(lyingCylinder());
  assert(res.regions.length >= 1, 'the lying cylinder does have overhang regions');
  assert(wallsOf(built).length === 0,
    `expected no prop walls along the band yet, got ${wallsOf(built).length}`);
  assert((built.fins ?? []).length >= 1,
    'the wedge row should still stand something under the band');
});

// --- 5. the level control case: a flat annulus must be untouched ------------------

Deno.test('round: a round FLAT overhang (annulus) is unaffected', () => {
  const { built } = build(mushroom());
  assert(wallsOf(built).length >= 3,
    `a wide flat annulus should get rows of walls, got ${wallsOf(built).length}`);
  assert((built.skipped?.stub ?? 0) === 0,
    `no track should be a stub on a flat annulus: ${JSON.stringify(built.skipped)}`);
  for (const q of wallsOf(built)) {
    assert(q.span >= PROP.minSpan,
      `a flat-annulus wall fell under minSpan (${q.span.toFixed(1)}mm) -- the rim floor leaked `
      + 'onto a level face');
  }
});

Deno.test('round: a LEVEL face cut by voids keeps the 7mm floor (rim licence must not leak)', () => {
  // The rim licence exists for a strip that TAPERS into shallowness. A level face whose
  // runs merely stop at a void (a frame/slot/bore) must keep the ordinary minSpan, or a
  // flat part with holes sprouts stub walls. Measured on the frame: every wall is >=
  // minSpan, and nothing shorter is ever emitted.
  for (const bar of [5, 9]) {
    const { built } = build(frame(bar));
    for (const q of wallsOf(built)) {
      assert(q.span >= PROP.minSpan,
        `frame bar=${bar}: a ${q.span.toFixed(1)}mm wall was placed on a LEVEL face -- the rim `
        + 'floor fired where the run ends at a void, not at a taper');
    }
    assert(wallsOf(built).length >= 1, `frame bar=${bar}: expected the long bars to be served`);
  }
});

// --- 6. the floor itself is derived, not picked -----------------------------------

Deno.test('round: minSpanShort is DERIVED from the wall it has to stand on', () => {
  const want = Math.max(PROP.minSpanSquat, 2 * PROP.footMin);
  assert(PROP.minSpanShort === want,
    `minSpanShort should be max(minSpanSquat, 2*footMin) = ${want}, got ${PROP.minSpanShort}`);
  assert(PROP.minSpanShort < PROP.minSpan,
    'the rim floor must be a RELAXATION of minSpan, never above it');
});
