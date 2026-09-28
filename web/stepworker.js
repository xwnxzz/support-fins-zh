// OpenCascade STEP/IGES/BREP tessellation, off the main thread.
//
// CLASSIC worker on purpose (no `type: 'module'`): the engine is a classic UMD script
// that has to arrive via importScripts -- a module worker cannot do that -- and that is
// also exactly how the engine's own occt-import-js-worker.js does it. step.js starts
// this worker lazily and falls back to loading the engine in the page if it cannot.
//
// The 7.6MB wasm is fetched by the glue from this worker's own directory
// (vendor/occt/), so nothing here needs to know where the app is mounted.
// The engine lives next to this worker (web/vendor/occt/). Resolve BOTH files against
// the worker's own URL rather than leaning on the glue's defaults: importScripts does
// not set document.currentScript, so the glue's scriptDirectory stays empty inside a
// worker, and its default wasm path then resolves against the SITE ROOT -- a 404 whose
// HTML body fails the WebAssembly magic-word check with a famously unhelpful message.
const ENGINE_DIR = new URL('vendor/occt/', self.location.href);
importScripts(new URL('occt-import-js.js', ENGINE_DIR).href);

// Whitelist, not a pass-through: the main thread names the call, but a worker that will
// invoke any property of the engine is a needless hole.
const READERS = new Set(['ReadStepFile', 'ReadIgesFile', 'ReadBrepFile']);

let engine = null;
function getEngine() {
  if (!engine) {
    engine = occtimportjs({ locateFile: (path) => new URL(path, ENGINE_DIR).href });
  }
  return engine;
}

self.onmessage = async (e) => {
  const { id, method, buffer, params } = e.data;
  try {
    if (!READERS.has(method)) throw new Error(`unsupported engine call: ${method}`);
    const occt = await getEngine();
    const result = occt[method](new Uint8Array(buffer), params);
    self.postMessage({ id, result });
  } catch (err) {
    // Report rather than die silently: step.js turns this into a Chinese error and
    // retries on the main thread.
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
