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
// Both are fixed for patches with no down-slope (a rim stub), while a patch that DOES
// have a slope keeps the old behaviour -- its short tail is a slope meeting the bed,
// which the wedge row serves (see tests/tine_density.test.js, which pins that).
import { buildTopology, analyze, fins, assert } from './_util.js';

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** Sphere of radius r resting on the plate (centre at z = r), outward winding. */
function ballTopo(r = 20, seg = 48, rings = 24) {
  const L = [];
  const at = (i, j) => {
    const phi = (i / rings) * Math.PI;
    const th = (j / seg) * 2 * Math.PI;
    return [r * Math.sin(phi) * Math.cos(th), r * Math.sin(phi) * Math.sin(th),
            r + r * Math.cos(phi)];
  };
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < seg; j++) {
      const a = at(i, j), b = at(i, j + 1), c = at(i + 1, j + 1), d = at(i + 1, j);
      const tri = (p, q, s) => L.push(p[0], p[1], p[2], q[0], q[1], q[2], s[0], s[1], s[2]);
      if (i === 0) tri(a, d, c);
      else if (i === rings - 1) tri(a, c, b);
      else { tri(a, d, c); tri(a, c, b); }
    }
  }
  const array = Float64Array.from(L);
  return buildTopology({ getAttribute: () => ({ array, count: array.length / 3 }) });
}

Deno.test('a ball bottom is a RING of overhang, and it gets fins on its boundary', () => {
  const topo = ballTopo(20);
  const res = analyze(topo, 45, IDENTITY);
  assert(res.regions.length === 1, `expected one overhang region, got ${res.regions.length}`);

  const built = fins.buildFins(topo, res, IDENTITY,
    { mode: 'auto', bedPad: true, tines: true, coverage: 0.5, layerHeight: 0.2 });

  // The regression this test exists for: exactly zero walls, silence, and a readout
  // that points the user at "rotate" for a part whose round bottom needs support.
  assert(built.fins.length >= 1,
    `round bottom got no support at all (fins=${built.fins.length}, `
    + `skipped=${JSON.stringify(built.skipped)})`);

  // ...and they must stand where the headroom is: near the rim of the overhang band,
  // not clustered under the pole (the pole is the bed contact -- 12mm^2 there).
  const bandOuter = 20 * Math.sin(Math.PI / 4);          // 45deg from the bottom pole
  const radii = built.props.map((q) => {
    const a = q.line[0], b = q.line[q.line.length - 1];
    return Math.hypot((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  });
  assert(radii.length >= 1, 'expected prop lines to report a radius');
  for (const rr of radii) {
    assert(rr > 4,
      `a wall stands under the pole (radius ${rr.toFixed(1)}mm), not on the boundary`);
    assert(rr <= bandOuter + 1,
      `a wall stands outside the overhang band (radius ${rr.toFixed(1)} > ${bandOuter.toFixed(1)})`);
  }
  // and each wall's top must actually reach the overhang above it
  for (const q of built.props) {
    assert(q.height > 1.5, `wall too short to support anything: ${q.height.toFixed(1)}mm`);
  }
});

Deno.test('a round FLAT overhang (annulus) is unaffected: still one row per track', () => {
  // stem + wide cap whose underside is a flat annulus: the classic mushroom. These
  // tracks are long enough for the full minSpan, so the rim floor must not change
  // them -- this is the guard that the fix stays scoped to short rim stubs.
  const L = [];
  const tri = (a, b, c) => L.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  const P = (rad, t, z) => [rad * Math.cos(t), rad * Math.sin(t), z];
  const seg = 64;
  const disc = (z, rad, up) => {
    for (let i = 0; i < seg; i++) {
      const t0 = (i / seg) * 2 * Math.PI, t1 = ((i + 1) / seg) * 2 * Math.PI;
      const a = P(rad, t0, z), b = P(rad, t1, z);
      up ? tri([0, 0, z], a, b) : tri([0, 0, z], b, a);
    }
  };
  const annulus = (z, ri, ro, up) => {
    for (let i = 0; i < seg; i++) {
      const t0 = (i / seg) * 2 * Math.PI, t1 = ((i + 1) / seg) * 2 * Math.PI;
      const i0 = P(ri, t0, z), i1 = P(ri, t1, z), o0 = P(ro, t0, z), o1 = P(ro, t1, z);
      if (up) { tri(i0, o0, o1); tri(i0, o1, i1); } else { tri(i0, i1, o1); tri(i0, o1, o0); }
    }
  };
  const tube = (z0, z1, rad) => {
    for (let i = 0; i < seg; i++) {
      const t0 = (i / seg) * 2 * Math.PI, t1 = ((i + 1) / seg) * 2 * Math.PI;
      const a0 = P(rad, t0, z0), a1 = P(rad, t1, z0), b0 = P(rad, t0, z1), b1 = P(rad, t1, z1);
      tri(a0, a1, b1); tri(a0, b1, b0);
    }
  };
  disc(0, 6, false); tube(0, 20, 6); annulus(20, 6, 20, false); tube(20, 24, 20); disc(24, 20, true);

  const array = Float64Array.from(L);
  const topo = buildTopology({ getAttribute: () => ({ array, count: array.length / 3 }) });
  const res = analyze(topo, 45, IDENTITY);
  const built = fins.buildFins(topo, res, IDENTITY, { mode: 'auto', bedPad: true, tines: true });

  assert(built.fins.length >= 3, `a wide flat annulus should get rows of walls, got ${built.fins.length}`);
  assert(built.skipped.stub === 0, `no track should be a stub on a flat annulus: ${JSON.stringify(built.skipped)}`);
  for (const q of built.props) {
    assert(q.span >= 7, `a flat-annulus wall fell under minSpan (${q.span.toFixed(1)}mm)`);
  }
});
