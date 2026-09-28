// STEP / IGES / BREP import: the browser-side logic, without the 7.6MB engine.
//
// Importing a CAD format here means one thing: OpenCascade (vendored as wasm, LGPL-2.1
// -- see web/vendor/occt/NOTICE.md) turns B-rep surfaces into triangles. This file tests
// everything around that call, which is where the bugs that reach a user actually live:
//
//   * which parser a file is routed to (content first, extension only as a fallback);
//   * the indexed -> non-indexed conversion, because the support engine reads
//     position.array as a triangle soup and would silently mis-read an indexed buffer;
//   * an assembly's node tree becoming selectable bodies (the object picker);
//   * the Chinese notes and the "this file is not STEP" error path;
//   * the engine's own tessellation request, and its vendored files being the ones we
//     pinned (a corrupted or swapped wasm is otherwise invisible until a user opens a
//     STEP in a browser).
//
// The real engine end-to-end (including the app's whole fins pipeline on a converted
// STEP part) is covered by tools/verify-step-import.mjs, which needs node and the wasm.
import { assert, WEB } from './_util.js';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const step = await import(`${WEB}step.js`);
const { sniffModel, soupFromMesh, mergeSoups, bodiesFromResult, readResult, bboxOf,
        isStepFamily, STEP_PARAMS, ENGINE_URLS, FORMAT_LABEL } = step;

const enc = (s) => new TextEncoder().encode(s);
const VENDOR = fileURLToPath(new URL('../web/vendor/occt/', import.meta.url));

// ---------------------------------------------------------------- routing by content

Deno.test('step: sniffModel routes by CONTENT, extension only as a fallback', () => {
  assert(sniffModel(enc('ISO-10303-21;\nHEADER;\n')) === 'step', 'STEP header');
  assert(sniffModel(enc('\uFEFF\n  ISO-10303-21;\nHEADER;')) === 'step', 'BOM + leading space');
  assert(sniffModel(enc('DBRep_DrawableShape\n\nCASCADE Topology V1')) === 'brep', 'BREP header');
  assert(sniffModel(enc(`${' '.repeat(72)}S      1\n${' '.repeat(72)}S      2\n`)) === 'iges',
    'IGES 80-column record');
  assert(sniffModel(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2])) === 'zip', 'ZIP (3MF) magic');
  assert(sniffModel(new Uint8Array([0x73, 0x6f, 0x6c, 0x69, 0x64])) === 'stl', 'binary STL');
  assert(sniffModel(new Uint8Array(0)) === 'empty', 'empty file');

  // Content wins over a wrong extension, both ways round.
  assert(sniffModel(enc('ISO-10303-21;'), 'part.3mf') === 'step', 'STEP named .3mf');
  // An unrecognised body still reaches the right parser when the name says so -- that
  // way a STEP file with an odd prologue gets the engine's error, not the STL reader's.
  assert(sniffModel(enc('something else entirely'), 'part.stp') === 'step', '.stp fallback');
  assert(sniffModel(enc('something else entirely'), 'part.IGS') === 'iges', '.igs fallback');
  assert(sniffModel(enc('something else entirely'), 'part.brep') === 'brep', '.brep fallback');
  assert(sniffModel(enc('something else entirely'), 'part.stl') === 'stl', 'unknown -> STL');

  for (const k of ['step', 'iges', 'brep']) assert(isStepFamily(k), `${k} is a CAD family`);
  assert(!isStepFamily('stl') && !isStepFamily('zip'), 'STL and 3MF are not the CAD path');
});

// --------------------------------------------------- engine result -> triangle soup

Deno.test('step: an indexed engine mesh becomes a NON-indexed triangle soup', () => {
  // The engine hands back three.js-style indexed attributes. buildTopology reads
  // position.array as three vertices per triangle, so leaving it indexed would treat
  // vertex 0,1,2 as a triangle instead of the triangles the index actually names.
  const mesh = {
    attributes: { position: { array: [0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0] } },
    index: { array: [0, 1, 2, 0, 2, 3] },
  };
  const soup = soupFromMesh(mesh);
  assert(soup instanceof Float32Array, 'soup is a Float32Array');
  assert(soup.length === 18, `expected 6 vertices, got ${soup.length / 3}`);
  assert([...soup.slice(0, 9)].join(',') === '0,0,0,10,0,0,10,10,0', 'first triangle copied');
  assert([...soup.slice(9, 18)].join(',') === '0,0,0,10,10,0,0,10,0', 'second triangle expanded');

  // An already-flat mesh passes through (defensive: some builds emit no index).
  const flat = { attributes: { position: { array: [0, 0, 0, 1, 0, 0, 0, 1, 0] } } };
  assert([...soupFromMesh(flat)].length === 9, 'flat soup passes through');

  // Nothing usable must be null, never a zero-length array that later divides into NaN.
  assert(soupFromMesh({ attributes: { position: { array: [] } } }) === null, 'empty positions');
  assert(soupFromMesh({ index: { array: [0, 1, 2] } }) === null, 'no position attribute');
  assert(soupFromMesh(null) === null, 'no mesh');
  assert(soupFromMesh({ attributes: { position: { array: [0, 0, 0, 1, 1, 1] } } }) === null,
    'two vertices is not a triangle');
});

Deno.test('step: merging soups concatenates in order, and one soup is not copied', () => {
  const a = Float32Array.from([1, 2, 3]);
  const b = Float32Array.from([4, 5, 6]);
  assert(mergeSoups([a]) === a, 'a single soup is handed through');
  const both = mergeSoups([a, b]);
  assert([...both].join(',') === '1,2,3,4,5,6', 'order preserved');
  assert(mergeSoups([]) === null, 'nothing merges to null');
});

Deno.test('step: bboxOf reports lo/hi/size like the 3MF reader does', () => {
  const b = bboxOf(Float32Array.from([-1, -2, -3, 5, 6, 7]));
  assert([...b.size].join(',') === '6,8,10', `size ${b.size}`);
  assert([...b.lo].join(',') === '-1,-2,-3' && [...b.hi].join(',') === '5,6,7', 'lo/hi');
});

// --------------------------------------------------------------------- node -> bodies

Deno.test('step: an assembly tree becomes selectable bodies (what the picker shows)', () => {
  const mk = (n) => ({ attributes: { position: { array: [n, 0, 0, n + 1, 0, 0, n, 1, 0, n, 0, 1] } },
                       index: { array: [0, 1, 2, 0, 2, 3] } });
  const result = {
    success: true,
    root: {
      name: '', meshes: [], children: [
        { name: 'frame', meshes: [], children: [
          { name: 'left', meshes: [0], children: [] },
          { name: 'right', meshes: [1], children: [] },
        ] },
        { name: 'boss', meshes: [2], children: [] },
      ],
    },
    // mesh 3 is claimed by nobody: it must still become a body rather than vanish.
    meshes: [mk(0), mk(10), mk(20), mk(30)],
  };
  const bodies = bodiesFromResult(result);
  assert(bodies.length === 4, `expected 4 bodies, got ${bodies.length}`);
  assert(bodies[0].name === 'left' && bodies[1].name === 'right', 'leaf names, in tree order');
  assert(bodies[2].name === 'boss', 'second child visited');
  assert(bodies[3].name === '实体 4', `unclaimed mesh gets a readable name, got ${bodies[3].name}`);
  for (const b of bodies) {
    assert(b.tris === 2 && b.positions.length === 18, `${b.name}: 2 triangles`);
    assert(b.bbox && b.bbox.size.length === 3, `${b.name}: bbox for the picker`);
  }

  // One mesh per node but several shells in one node: they merge into a single body.
  const merged = bodiesFromResult({
    success: true,
    root: { name: 'part', meshes: [], children: [{ name: 'body', meshes: [0, 1], children: [] }] },
    meshes: [mk(0), mk(10)],
  });
  assert(merged.length === 1 && merged[0].meshes === 2 && merged[0].tris === 4,
    'a multi-shell node is one body of 4 triangles');
  assert(merged[0].name === 'body', 'node name kept');
});

// ------------------------------------------------------------------- notes and errors

Deno.test('step: notes say what happened, and failures say so in Chinese', () => {
  const mesh = { attributes: { position: { array: [0, 0, 0, 1, 0, 0, 0, 1, 0] } },
                 index: { array: [0, 1, 2] } };

  const one = readResult({ success: true, root: { name: 'cube', meshes: [0], children: [] },
                           meshes: [mesh] }, 'step');
  assert(one.ok === true, 'single body succeeds');
  assert(one.bodies.length === 1 && one.bodies[0].tris === 1, 'one body, one triangle');
  assert(one.notes[0].includes('OpenCascade'),
    `note names the engine: ${one.notes[0]}`);
  // The label is NOT repeated in the note: app.js prefixes it ("STEP：…"), and doing it
  // twice produced "STEP：STEP 已转换为网格".
  assert(!one.notes[0].includes('STEP'), `the note must not repeat the label: ${one.notes[0]}`);

  const many = readResult({
    success: true, root: { name: '', meshes: [], children: [
      { name: 'a', meshes: [0], children: [] }, { name: 'b', meshes: [1], children: [] }] },
    meshes: [mesh, mesh],
  }, 'step');
  assert(many.bodies.length === 2, 'two bodies');
  assert(many.notes.some((n) => n.includes('2 个实体')), `assembly note: ${many.notes}`);

  const bad = readResult({ success: false }, 'step');
  assert(bad.ok === false && bad.error.includes('无法解析'), `parse failure: ${bad.error}`);
  const empty = readResult({ success: true, root: { name: '', meshes: [], children: [] }, meshes: [] },
    'bresp'.replace('r', 'r'));
  assert(empty.ok === false, 'an empty result is a failure, not a silent success');
  assert(readResult(null, 'iges').ok === false, 'no result at all is a failure');
  assert(FORMAT_LABEL.iges === 'IGES' && FORMAT_LABEL.brep === 'BREP', 'format labels');
});

// ------------------------------------------------------------ the engine we ship

Deno.test('step: the vendored engine is the pinned one, licenses included', () => {
  // A swapped or truncated wasm would otherwise only show up when a user opens a STEP
  // file, and the failure would look like "this file is broken" rather than "the
  // vendored engine is wrong". These hashes are the whole point of this test.
  const want = {
    'occt-import-js.js': { size: 96871, sha: '3fb44ce11d00611f9b3f3c5775d520ebab48930c1f08279b7b1316f05f0d3379' },
    'occt-import-js.wasm': { size: 7604031, sha: '33391fc9d94ea5c869a6718488bf0a9a464222bac9bdc764dfe1690cef281952' },
  };
  for (const [name, exp] of Object.entries(want)) {
    const path = `${VENDOR}${name}`;
    assert(existsSync(path), `vendored ${name} is missing (STEP import cannot work)`);
    const bytes = readFileSync(path);
    assert(bytes.length === exp.size, `${name}: expected ${exp.size} bytes, got ${bytes.length}`);
    const sha = createHash('sha256').update(bytes).digest('hex');
    assert(sha === exp.sha, `${name}: sha256 drifted (${sha.slice(0, 16)}…) -- if the engine was `
      + 'upgraded on purpose, update the pin in this test and web/vendor/occt/NOTICE.md');
  }
  // LGPL-2.1 obliges us to ship the licence texts and say where the component came from.
  for (const f of ['license.occt-import-js.txt', 'license.occt.txt', 'NOTICE.md']) {
    assert(existsSync(`${VENDOR}${f}`), `${f} must travel with the engine`);
  }
  const notice = readFileSync(`${VENDOR}NOTICE.md`, 'utf8');
  assert(notice.includes('LGPL-2.1'), 'NOTICE states the licence');
  assert(notice.includes('0.0.23'), 'NOTICE states the version');
  assert(notice.includes('occt-import-js'), 'NOTICE states the component');
  const lgpl = readFileSync(`${VENDOR}license.occt-import-js.txt`, 'utf8');
  assert(/GNU LESSER GENERAL PUBLIC LICENSE/i.test(lgpl), 'the LGPL text is the LGPL text');
  assert(/Version 2\.1/.test(lgpl), 'and it is version 2.1');
  assert(notice.includes('LGPL') && notice.includes('MIT'),
    'NOTICE explains the relationship to the project licence');
});

Deno.test('step: the engine is loaded LAZILY and off the main thread', () => {
  // Two properties that are easy to lose in a refactor and expensive when lost: the page
  // must not pull 7.6MB for an STL, and tessellation must not run on the main thread.
  const html = readFileSync(fileURLToPath(new URL('../web/index.html', import.meta.url)), 'utf8');
  assert(!/<script[^>]+vendor\/occt/i.test(html),
    'index.html must not load the engine eagerly -- step.js injects it on first STEP');
  assert(html.includes('.step') && html.includes('.stp'), 'the file input accepts STEP');
  assert(/打开[^<]*STEP/.test(html), 'the button says it opens STEP');

  const worker = readFileSync(fileURLToPath(new URL('../web/stepworker.js', import.meta.url)), 'utf8');
  // The engine files are resolved from the WORKER's own URL. That is not style: a worker
  // has no document.currentScript, so the engine's default wasm path resolves against the
  // SITE ROOT and 404s -- and a 404 is HTML, which then fails with "expected magic word
  // 00 61 73 6d, found 3c 21 44 4f" (a real bug this test now pins). Verified in a
  // browser; node cannot see it because node loads the wasm itself.
  assert(worker.includes('new URL(\'vendor/occt/\', self.location.href)'),
    'the worker must resolve the engine directory from its own URL');
  assert(/importScripts\(new URL\('occt-import-js\.js', ENGINE_DIR\)\.href\)/.test(worker),
    'and pull the glue in from there');
  assert(/locateFile:\s*\(path\)\s*=>\s*new URL\(path, ENGINE_DIR\)/.test(worker),
    'and point wasm loading at the same directory');
  assert(worker.includes('ReadStepFile') && worker.includes('ReadIgesFile'),
    'and exposes the readers');
  assert(/READERS\.has\(method\)/.test(worker),
    'the reader name is whitelisted, not passed through to the engine');

  // The URLs the app will actually fetch must point at the vendored copies.
  assert(ENGINE_URLS.glue.endsWith('/vendor/occt/occt-import-js.js'), 'glue URL');
  assert(ENGINE_URLS.wasm.endsWith('/vendor/occt/occt-import-js.wasm'), 'wasm URL');
  assert(ENGINE_URLS.worker.endsWith('/stepworker.js'), 'worker URL');

  // Tessellation request: millimetres out, and finer than OCCT's own default (0.5 rad,
  // which is a 13-gon per circle and measurably too coarse for round-rim support).
  assert(STEP_PARAMS.linearUnit === 'millimeter', 'output is millimetres');
  assert(STEP_PARAMS.linearDeflectionType === 'bounding_box_ratio',
    'deflection scales with the part');
  assert(STEP_PARAMS.linearDeflection < 0.001,
    `finer than the engine default 0.001, got ${STEP_PARAMS.linearDeflection}`);
  assert(STEP_PARAMS.angularDeflection < 0.5,
    `finer than the engine default 0.5 rad, got ${STEP_PARAMS.angularDeflection}`);
  assert(STEP_PARAMS.angularDeflection > 0.02, 'but not absurdly fine (file size, time)');
});
