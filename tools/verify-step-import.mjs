#!/usr/bin/env node
/**
 * Verify STEP / IGES / BREP import against the REAL engine, end to end.
 *
 * tests/step.test.js covers the pure logic (sniffing, index expansion, notes) without
 * the 7.6MB wasm, which keeps the test suite fast but would let a broken engine binding
 * pass unnoticed. This script is the other half: it loads the vendored OpenCascade
 * exactly as the app does, converts real files, and then runs the imported triangle
 * soup through the actual support pipeline, so "STEP import works" means "a STEP part
 * comes out with fins", not "a function returned an object".
 *
 * Fixtures:
 *   prototype/stress/step/*.step          ours, from prototype/stress/gen_step.py
 *   prototype/stress/step/vendor/*        third-party set, from tools/fetch-step-fixtures.mjs
 *                                         (missing ones are reported as SKIPPED, not failed)
 *
 *   node tools/verify-step-import.mjs [--keep-going]
 */
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  STEP_PARAMS, sniffModel, soupFromMesh, bodiesFromResult, readResult, FORMAT_LABEL,
} from '../web/step.js';
import { buildTopology, analyze } from '../web/overhangs.js';
import { buildFins } from '../web/fins.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const STEP_DIR = join(ROOT, 'prototype', 'stress', 'step');
const VENDOR = join(STEP_DIR, 'vendor');
const require = createRequire(import.meta.url);

const results = [];
let failures = 0;

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `   ${detail}` : ''}`);
  return ok;
}

function skip(name, why) {
  results.push({ name, ok: true, skipped: true, detail: why });
  console.log(`  skip ${name}   ${why}`);
}

const bboxOf = (positions) => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      if (positions[i + k] < lo[k]) lo[k] = positions[i + k];
      if (positions[i + k] > hi[k]) hi[k] = positions[i + k];
    }
  }
  return { lo, hi, size: hi.map((h, k) => h - lo[k]) };
};

const near = (a, b, tol) => Math.abs(a - b) <= tol;
const read = (file) => new Uint8Array(readFileSync(file));

async function main() {
  console.log('loading the vendored engine (web/vendor/occt)…');
  const wasmBinary = readFileSync(join(ROOT, 'web', 'vendor', 'occt', 'occt-import-js.wasm'));
  const glue = require(join(ROOT, 'web', 'vendor', 'occt', 'occt-import-js.js'));
  const t0 = Date.now();
  const occt = await glue({ wasmBinary });
  const bootMs = Date.now() - t0;
  console.log(`engine ready in ${bootMs}ms (wasm ${wasmBinary.length} bytes)`);
  check('engine exposes the three readers',
    typeof occt.ReadStepFile === 'function' && typeof occt.ReadIgesFile === 'function'
      && typeof occt.ReadBrepFile === 'function');

  // ---------------------------------------------------------------- our own fixtures
  console.log('\n[our fixtures: prototype/stress/step]');
  if (!existsSync(join(STEP_DIR, 'plate.step'))) {
    console.log('  (run `python prototype/stress/gen_step.py` first)');
  }

  const conv = (file, kind, params = STEP_PARAMS) => {
    const bytes = read(file);
    const method = { step: 'ReadStepFile', iges: 'ReadIgesFile', brep: 'ReadBrepFile' }[kind];
    const raw = occt[method](bytes, params);
    return { bytes, raw, app: readResult(raw, kind), bodies: bodiesFromResult(raw) };
  };

  // A box with a known size: proves the file, the units and the soup conversion.
  if (existsSync(join(STEP_DIR, 'box.step'))) {
    const { raw, bodies } = conv(join(STEP_DIR, 'box.step'), 'step');
    check('box.step parses', raw.success === true);
    const b = bboxOf(bodies[0].positions);
    check('box.step is 20x20x10 mm as written',
      near(b.size[0], 20, 1e-6) && near(b.size[1], 20, 1e-6) && near(b.size[2], 10, 1e-6),
      `got ${b.size.map((v) => v.toFixed(4)).join('x')}`);
    const soup = soupFromMesh(raw.meshes[0]);
    check('soup is non-indexed (3 verts per triangle)',
      soup.length % 9 === 0 && soup.length / 9 === raw.meshes[0].index.array.length / 3,
      `${soup.length / 9} triangles`);
    check('sniffModel recognises the STEP header', sniffModel(read(join(STEP_DIR, 'box.step')), 'x') === 'step');
  } else skip('box.step', 'run gen_step.py');

  // The same part in mm and in INCHES must import at the same millimetre size.
  if (existsSync(join(STEP_DIR, 'plate.step')) && existsSync(join(STEP_DIR, 'plate-inch.step'))) {
    const mm = conv(join(STEP_DIR, 'plate.step'), 'step');
    const inch = conv(join(STEP_DIR, 'plate-inch.step'), 'step');
    const bmm = bboxOf(mm.bodies[0].positions);
    const bin = bboxOf(inch.bodies[0].positions);
    check('tilted plate parses in mm', mm.raw.success === true);
    check('tilted plate parses in inches', inch.raw.success === true);
    check('an inch file lands at the same millimetre size',
      bmm.size.every((v, k) => near(v, bin.size[k], 1e-3)),
      `mm ${bmm.size.map((v) => v.toFixed(2)).join('x')} vs in ${bin.size.map((v) => v.toFixed(2)).join('x')}`);
    check('plate is the size gen_step.py wrote (60x40x6 tilted)',
      near(bmm.size[0], 60, 1e-3) && bmm.size[2] > 6, `60x${bmm.size[1].toFixed(1)}x${bmm.size[2].toFixed(1)}`);
  } else skip('plate.step / plate-inch.step', 'run gen_step.py');

  // The round case, arriving through STEP this time.
  if (existsSync(join(STEP_DIR, 'ball.step'))) {
    const { raw, bodies } = conv(join(STEP_DIR, 'ball.step'), 'step');
    check('ball.step parses', raw.success === true);
    const b = bboxOf(bodies[0].positions);
    check('ball is a 40mm sphere on the bed',
      near(b.size[0], 40, 0.02) && near(b.size[1], 40, 0.02) && near(b.lo[2], 0, 0.02),
      `size ${b.size.map((v) => v.toFixed(2)).join('x')}, z0 ${b.lo[2].toFixed(3)}`);
  } else skip('ball.step', 'run gen_step.py');

  // ------------------------------------------------------- third-party conformance set
  console.log('\n[third-party set: prototype/stress/step/vendor]');
  if (!existsSync(VENDOR)) {
    skip('third-party fixtures', 'run node tools/fetch-step-fixtures.mjs');
  } else {
    const f = (n) => join(VENDOR, n);
    const have = (n) => existsSync(f(n));

    if (have('cube-10x10.stp')) {
      const { raw, bodies } = conv(f('cube-10x10.stp'), 'step');
      const b = bboxOf(bodies[0].positions);
      check('cube-10x10.stp parses', raw.success === true);
      check('cube-10x10.stp measures 10mm (their conformance file)',
        near(b.size[0], 10, 1e-4) && near(b.size[1], 10, 1e-4) && near(b.size[2], 10, 1e-4),
        b.size.map((v) => v.toFixed(4)).join('x'));
    } else skip('cube-10x10.stp', 'not fetched');

    // The unit triplet: three files that DECLARE metre / millimetre / inch and must all
    // come out 1000mm wide in the app's millimetre output.
    for (const name of ['cube-m.step', 'cube-mm.step', 'cube-in.step']) {
      if (!have(name)) { skip(name, 'not fetched'); continue; }
      const { raw, bodies } = conv(f(name), 'step');
      const b = bboxOf(bodies[0].positions);
      check(`${name} declares its own unit and imports 1000mm wide`,
        raw.success === true && near(b.size[0], 1000, 1e-4),
        `x size ${b.size[0].toFixed(4)}mm`);
    }

    // Tessellation: our params must be finer than the engine's defaults, and the
    // default must still work (we only ever pass STEP_PARAMS, but the comparison is
    // what justifies the numbers).
    if (have('rounded-cube.step')) {
      const auto = conv(f('rounded-cube.step'), 'step', null);
      const ours = conv(f('rounded-cube.step'), 'step');
      const autoVerts = auto.raw.meshes[0].attributes.position.array.length;
      const ourVerts = ours.raw.meshes[0].attributes.position.array.length;
      check('rounded-cube.step parses both ways',
        auto.raw.success === true && ours.raw.success === true);
      check('STEP_PARAMS tessellates finer than the OCCT default',
        ourVerts > autoVerts, `default ${autoVerts} verts, ours ${ourVerts} verts`);
      const again = conv(f('rounded-cube.step'), 'step');
      check('tessellation is deterministic',
        again.raw.meshes[0].attributes.position.array.length === ourVerts);
    } else skip('rounded-cube.step', 'not fetched');

    if (have('conical-surface.step')) {
      const { raw, bodies } = conv(f('conical-surface.step'), 'step');
      check('conical-surface.step parses (a real analytic surface, not a faceted one)',
        raw.success === true && bodies[0].tris > 50, `${bodies[0].tris} triangles`);
    } else skip('conical-surface.step', 'not fetched');

    // An assembly: many bodies, which is what sends the app to the object picker.
    if (have('assembly-18.stp')) {
      const { raw, bodies } = conv(f('assembly-18.stp'), 'step');
      check('assembly-18.stp parses', raw.success === true);
      check('assembly comes back as several selectable bodies',
        bodies.length > 1, `${bodies.length} bodies for ${raw.meshes.length} meshes`);
      check('every body carries a name, a bbox and triangles',
        bodies.every((b) => b.name && b.bbox && b.tris > 0 && b.positions.length % 9 === 0));
    } else skip('assembly-18.stp', 'not fetched');

    if (have('cube-10x10.igs')) {
      const { raw } = conv(f('cube-10x10.igs'), 'iges');
      check('IGES file parses through the same engine', raw.success === true);
      check('sniffModel recognises IGES 80-column records',
        sniffModel(read(f('cube-10x10.igs')), 'x') === 'iges');
    } else skip('cube-10x10.igs', 'not fetched');

    if (have('assembly-18.brep')) {
      const { raw } = conv(f('assembly-18.brep'), 'brep');
      check('BREP file parses through the same engine', raw.success === true);
      check('sniffModel recognises a BREP header',
        sniffModel(read(f('assembly-18.brep')), 'x') === 'brep');
    } else skip('assembly-18.brep', 'not fetched');

    if (have('cube-fcstd.step')) {
      const { raw } = conv(f('cube-fcstd.step'), 'step');
      check('a FreeCAD-exported STEP parses', raw.success === true);
    } else skip('cube-fcstd.step', 'not fetched');
  }

  // ----------------------------------------------- the whole pipeline, from a STEP file
  console.log('\n[the app\'s pipeline on a STEP-imported part]');
  const pipeline = (file, label) => {
    if (!existsSync(file)) { skip(`${label} -> fins`, 'fixture missing'); return; }
    const { raw } = conv(file, 'step', null);          // engine defaults, as a user's file would be
    const bodies = bodiesFromResult(raw);
    const positions = bodies[0].positions;
    const topo = buildTopology({ getAttribute: () => ({ array: positions, count: positions.length / 3 }) });
    const res = analyze(topo, 45, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const built = buildFins(topo, res, [1, 0, 0, 0, 1, 0, 0, 0, 1],
      { mode: 'auto', bedPad: true, tines: true, coverage: 0.5, layerHeight: 0.2 });
    check(`${label}: the STEP soup builds topology and finds overhang`,
      topo.nFaces > 0 && res.regions.length > 0,
      `${topo.nFaces} faces, ${res.regions.length} region(s), ${res.overArea.toFixed(0)}mm²`);
    check(`${label}: fins actually get generated`, (built.fins || []).length >= 1,
      `${(built.fins || []).length} fin(s), ${built.tines || 0} tines, skipped `
      + JSON.stringify(built.skipped));
    return built;
  };
  pipeline(join(STEP_DIR, 'plate.step'), 'tilted plate (STEP)');
  pipeline(join(STEP_DIR, 'ball.step'), 'facetted ball (STEP)');

  // ------------------------------------------------------------------- error handling
  console.log('\n[error handling]');
  const junk = new TextEncoder().encode('ISO-10303-21;\nHEADER;\nthis is not STEP at all\n');
  const junkRes = readResult(occt.ReadStepFile(junk, STEP_PARAMS), 'step');
  check('garbage that claims to be STEP is reported, not crashed on',
    junkRes.ok === false && /无法解析|没有可用/.test(junkRes.error), junkRes.error);
  check('sniffModel still routes it to the STEP reader (so the error is about STEP)',
    sniffModel(junk, 'x.step') === 'step');

  // ------------------------------------------------------------------------ summary
  const ok = results.filter((r) => r.ok && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  console.log(`\n${ok} checks passed, ${failures} failed, ${skipped} skipped`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
