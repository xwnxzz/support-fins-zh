// STEP / IGES / BREP import.
//
// STL and 3MF are MESH formats: the triangles are already in the file. STEP is not --
// it describes B-rep surfaces (planes, cylinders, NURBS, trimmed loops), so something
// has to tessellate it, and in a browser that something is OpenCascade compiled to
// WebAssembly. That engine is vendored in ./vendor/occt (LGPL-2.1, third party -- see
// vendor/occt/NOTICE.md for the license, the exact version and how to replace it).
//
// Two deliberate properties:
//
//   * LAZY. Nothing here runs until a STEP-family file is actually opened. Importing an
//     STL or 3MF never fetches the 7.6MB wasm.
//   * OFF THE MAIN THREAD. Tessellating a real part takes seconds; the same reason
//     buildFins lives in finworker.js applies here. stepworker.js is a CLASSIC worker
//     because the engine is a classic UMD script that has to be pulled in with
//     importScripts (a module worker cannot). If a worker cannot be started at all, we
//     fall back to injecting the script into the page, which is exactly how the engine's
//     own README says to use it.
//
// Everything engine-specific is fenced into this file: the rest of the app only ever
// sees a flat triangle soup in millimetres, the same shape STLLoader and threemf.js
// produce.

/**
 * Tessellation request sent to the engine.
 *
 * `linearUnit: 'millimeter'` makes OpenCascade convert the FILE's own unit to mm, so a
 * part drawn in inches or metres lands at the right size -- that is the same promise
 * threemf.js makes when it converts a 3MF's declared unit, and it is pinned by
 * tools/verify-step-import.mjs against a metre file, a millimetre file and an inch file
 * that must all come out 1000mm wide.
 *
 * The deflection numbers are ours, not the engine's defaults. OCCT defaults to a
 * bounding-box ratio of 0.001 and an angular deflection of 0.5 rad; 0.5 rad means a
 * full circle becomes a 13-gon, and a mesh that coarse measurably loses round-rim
 * support (see tests/round_validation.test.js). 0.12 rad is ~52 segments per circle,
 * i.e. comfortably inside the range where the round path works, and the ratio scales
 * with the part so a 10mm part and a 500mm part cost about the same triangle count.
 */
export const STEP_PARAMS = {
  linearUnit: 'millimeter',
  linearDeflectionType: 'bounding_box_ratio',
  linearDeflection: 0.0006,
  angularDeflection: 0.12,
};

/** Engine entry point names, one per supported family. */
const READERS = { step: 'ReadStepFile', iges: 'ReadIgesFile', brep: 'ReadBrepFile' };

export const FORMAT_LABEL = { step: 'STEP', iges: 'IGES', brep: 'BREP' };

// ------------------------------------------------------------------ sniffing

const dec = new TextDecoder('latin1', { fatal: false });

/**
 * Which parser should handle this file? Decided by CONTENT first (the same policy
 * threemf.js uses for the ZIP magic: a file renamed by a slicer still lands in the
 * right parser), with the extension as a last resort so an unusual-but-valid STEP
 * still gets to the engine instead of being mangled by the STL reader.
 *
 * Signatures: ZIP `PK\x03\x04`; STEP starts `ISO-10303-21`; IGES is 80-column records
 * whose first one ends `S      1`; BREP starts `DBRep_DrawableShape`.
 */
export function sniffModel(buffer, filename = '') {
  if (!buffer || buffer.byteLength === 0) return 'empty';
  const b = new Uint8Array(buffer);
  if (b.byteLength >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) {
    return 'zip';
  }
  // Decoded as latin1 on purpose: it maps bytes 1:1, so the ASCII signatures below
  // cannot be mangled by a byte sequence that is not valid UTF-8. A UTF-8 BOM therefore
  // arrives as the three latin1 characters "ï»¿", which is what the first alternative
  // strips -- Windows CAD exporters do write one, and STEP's first line must still be
  // found behind it.
  const head = dec.decode(b.subarray(0, 4096))
    .replace(/^(\uFEFF|\u00EF\u00BB\u00BF)/, '')
    .trimStart();
  if (/^ISO-10303-21/.test(head)) return 'step';
  if (/^DBRep_DrawableShape|^CASCADE Topology V1/.test(head)) return 'brep';
  if (/^\s*S\s+1\s*$/.test(dec.decode(b.subarray(0, 80)))) return 'iges';

  const ext = (filename.match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase();
  if (ext === 'step' || ext === 'stp') return 'step';
  if (ext === 'iges' || ext === 'igs') return 'iges';
  if (ext === 'brep') return 'brep';
  return 'stl';
}

export const isStepFamily = (kind) => kind === 'step' || kind === 'iges' || kind === 'brep';

// ------------------------------------------------------- engine result -> soup

/**
 * One engine mesh as a flat NON-INDEXED triangle soup (the layout STLLoader produces
 * and buildTopology expects: three vertices per triangle, three mm floats each). The
 * engine hands back indexed three.js-style attributes, so an index array has to be
 * expanded -- the support engine reads `position.array` as triangles and would silently
 * treat an indexed buffer's vertices as unrelated triangles.
 */
export function soupFromMesh(mesh) {
  const pos = mesh && mesh.attributes && mesh.attributes.position
    && mesh.attributes.position.array;
  if (!pos || pos.length < 9) return null;
  const idx = mesh.index && mesh.index.array;
  if (!idx) return Float32Array.from(pos);
  const out = new Float32Array(idx.length * 3);
  for (let i = 0; i < idx.length; i++) {
    const j = idx[i] * 3;
    out[i * 3] = pos[j];
    out[i * 3 + 1] = pos[j + 1];
    out[i * 3 + 2] = pos[j + 2];
  }
  return out;
}

/** Join soups into one part (the picker's "merge" answer, or a single-object file). */
export function mergeSoups(soups) {
  if (!soups.length) return null;
  if (soups.length === 1) return soups[0];
  let total = 0;
  for (const s of soups) total += s.length;
  const all = new Float32Array(total);
  let off = 0;
  for (const s of soups) { all.set(s, off); off += s.length; }
  return all;
}

/** Same shape threemf.js hands the object picker, so it can describe a body's size. */
export function bboxOf(positions) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      if (positions[i + k] < lo[k]) lo[k] = positions[i + k];
      if (positions[i + k] > hi[k]) hi[k] = positions[i + k];
    }
  }
  return { lo, hi, size: hi.map((h, k) => h - lo[k]) };
}

/**
 * Walk the engine's node tree and return one entry per selectable BODY, so a STEP
 * assembly behaves like a multi-object 3MF: the app shows its existing object picker
 * instead of silently gluing an assembly into one lump.
 *
 * A node counts as a body when it holds mesh indices; a node that only groups children
 * is skipped and its children are visited. Meshes that no node claims (possible on
 * odd files) are kept as bodies of their own so geometry is never dropped silently.
 */
export function bodiesFromResult(result) {
  const meshes = (result && result.meshes) || [];
  const bodies = [];
  const claimed = new Set();

  const walk = (node) => {
    if (!node) return;
    const ids = (node.meshes || []).filter((i) => i >= 0 && i < meshes.length);
    if (ids.length) {
      const soups = [];
      for (const i of ids) {
        claimed.add(i);
        const soup = soupFromMesh(meshes[i]);
        if (soup) soups.push(soup);
      }
      const positions = mergeSoups(soups);
      if (positions) {
        bodies.push({
          name: node.name || (meshes[ids[0]] && meshes[ids[0]].name) || `实体 ${bodies.length + 1}`,
          positions,
          tris: positions.length / 9,
          meshes: ids.length,
          bbox: bboxOf(positions),
        });
      }
    }
    for (const child of node.children || []) walk(child);
  };
  walk(result && result.root);

  for (let i = 0; i < meshes.length; i++) {
    if (claimed.has(i)) continue;
    const positions = soupFromMesh(meshes[i]);
    if (positions) {
      bodies.push({
        name: meshes[i].name || `实体 ${bodies.length + 1}`,
        positions, tris: positions.length / 9, meshes: 1, bbox: bboxOf(positions),
      });
    }
  }
  return bodies;
}

/**
 * Engine result -> what the app needs: bodies (possibly for the picker) plus the Chinese
 * notes the status panel shows. `notes` never claims more than we know: an empty result
 * is reported as empty, not as success.
 */
export function readResult(result, kind) {
  const label = FORMAT_LABEL[kind] || 'CAD';
  if (!result) return { ok: false, error: `${label} 引擎没有返回结果` };
  if (!result.success) {
    return {
      ok: false,
      error: `${label} 引擎无法解析这个文件。可能不是有效的 ${label}，`
        + '或者它用了引擎不支持的实体（极少见）。',
    };
  }
  const bodies = bodiesFromResult(result);
  const tris = bodies.reduce((n, b) => n + b.tris, 0);
  if (!bodies.length || tris === 0) {
    return {
      ok: false,
      error: `${label} 里没有可用的三角面（文件可能只含点/线/曲面参考，或全部实体为空）。`,
    };
  }
  const notes = [`已转换为网格（OpenCascade）`];
  if (result.root && result.root.name) notes.push(`名称“${result.root.name}”`);
  if (bodies.length > 1) notes.push(`含 ${bodies.length} 个实体`);
  return { ok: true, bodies, notes, label };
}

// ------------------------------------------------------------------ the engine

let statusSink = null;
/** app.js registers a callback to show "loading engine / converting" in the UI. */
export function onStepStatus(fn) { statusSink = fn; }
const say = (msg) => { if (statusSink) statusSink(msg); };

export const ENGINE_URLS = {
  glue: new URL('./vendor/occt/occt-import-js.js', import.meta.url).href,
  wasm: new URL('./vendor/occt/occt-import-js.wasm', import.meta.url).href,
  worker: new URL('./stepworker.js', import.meta.url).href,
};

const ENGINE_MISSING = 'STEP 引擎没能加载（vendor/occt/occt-import-js.wasm 可能缺失或没有部署）。'
  + 'STL 和 3MF 不受影响。';

let worker = null;
let workerBroken = false;
let engineWarm = false;      // a conversion already succeeded: the engine is in memory
let nextId = 1;
const pending = new Map();

function makeWorker() {
  const w = new Worker(ENGINE_URLS.worker);
  w.onmessage = (e) => {
    const job = pending.get(e.data.id);
    if (!job) return;
    pending.delete(e.data.id);
    if (e.data.error) job.reject(new Error(e.data.error));
    else job.resolve(e.data.result);
  };
  w.onerror = () => {
    // A classic worker that cannot even importScripts the engine (CSP, missing file,
    // file:// origin) is useless to us: fail every outstanding job and fall back.
    workerBroken = true;
    for (const job of pending.values()) job.reject(new Error(ENGINE_MISSING));
    pending.clear();
    worker = null;
  };
  return w;
}

/** Read a STEP-family file through the worker (off the main thread). */
function readInWorker(kind, bytes) {
  if (workerBroken) return null;
  if (!worker) {
    try { worker = makeWorker(); } catch { workerBroken = true; return null; }
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    // The engine call name travels with the job so the worker does not have to keep a
    // second copy of the format table in step.js.
    worker.postMessage({
      id,
      method: READERS[kind],
      buffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      params: STEP_PARAMS,
    });
  });
}

// --- main-thread fallback: the engine's own documented <script> usage -------------

let gluePromise = null;
function loadGlueInPage() {
  if (gluePromise) return gluePromise;
  gluePromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = ENGINE_URLS.glue;
    s.onload = () => {
      if (typeof occtimportjs !== 'function') {
        reject(new Error(ENGINE_MISSING));
        return;
      }
      occtimportjs({ locateFile: () => ENGINE_URLS.wasm }).then(resolve, () => {
        reject(new Error(ENGINE_MISSING));
      });
    };
    s.onerror = () => reject(new Error(ENGINE_MISSING));
    document.head.appendChild(s);
  });
  return gluePromise;
}

/**
 * Convert one STEP-family file to bodies. Worker first; if no worker can be started
 * (or it dies on the engine), do it inline so the feature still works.
 */
export async function convertStepFile(buffer, kind, filename = '') {
  const label = FORMAT_LABEL[kind] || 'CAD';
  const bytes = new Uint8Array(buffer);
  // Say which of the two waits this is: the first STEP of a session pays for the 7.6MB
  // engine, later ones are just tessellation.
  say(engineWarm
    ? `正在转换 ${filename || label}…`
    : `正在加载 ${label} 引擎并转换（首次约 7.6 MB，之后由浏览器缓存）…`);
  let result = null;
  try {
    result = await readInWorker(kind, bytes);
  } catch (err) {
    console.warn('STEP worker unavailable, falling back to the main thread:', err);
    result = null;
  }
  if (result === null) {
    const occt = await loadGlueInPage();
    result = occt[READERS[kind]](bytes, STEP_PARAMS);
  }
  engineWarm = true;
  return readResult(result, kind);
}
