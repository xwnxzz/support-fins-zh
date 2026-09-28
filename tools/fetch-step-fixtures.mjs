#!/usr/bin/env node
/**
 * Download the third-party STEP test set that tools/verify-step-import.mjs runs against.
 *
 * Why not commit these files: they are somebody else's conformance models (the CAx-IF
 * suite and files from Kovács Viktor's occt-import-js repo), so they stay out of the
 * repository the same way prototype/stress/models/*.stl do -- generated/fetched on
 * demand, never vendored. This script pins the exact npm tarball by SHA-256 before it
 * extracts anything, so "the file we tested" is reproducible and auditable.
 *
 *   node tools/fetch-step-fixtures.mjs            # download + extract into
 *                                                 # prototype/stress/step/vendor/
 *   node tools/fetch-step-fixtures.mjs --verify   # re-check the pins, no download
 *
 * No dependencies: tar is a simple format and node can gunzip it, which keeps the whole
 * toolchain to deno/node/python (see README).
 */
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const PIN_FILE = join(ROOT, 'prototype', 'step-fixtures.json');
const OUT_DIR = join(ROOT, 'prototype', 'stress', 'step', 'vendor');

/** The pin. Bump all three together when the engine is upgraded. */
export const PIN = {
  package: 'occt-import-js',
  version: '0.0.23',
  tarball: 'https://registry.npmjs.org/occt-import-js/-/occt-import-js-0.0.23.tgz',
  sha256: 'eaab9ca7bf02799360d8fc70468dc8bf78eb2073c3fafb1ff982006e558fc1f3',
  license: 'LGPL-2.1',
  note: 'Third-party test models. Not part of this project; fetched for verification only.',
  members: {
    'package/test/testfiles/cube-10x10mm/Cube 10x10.stp': 'cube-10x10.stp',
    'package/test/testfiles/cube-10x10mm/Cube 10x10.igs': 'cube-10x10.igs',
    'package/test/testfiles/cube-units/cube-mm.step': 'cube-mm.step',
    'package/test/testfiles/cube-units/cube-m.step': 'cube-m.step',
    'package/test/testfiles/cube-units/cube-in.step': 'cube-in.step',
    'package/test/testfiles/rounded-cube/rounded-cube.step': 'rounded-cube.step',
    'package/test/testfiles/conical-surface/conical-surface.step': 'conical-surface.step',
    'package/test/testfiles/cube-fcstd/cube.step': 'cube-fcstd.step',
    'package/test/testfiles/cax-if/as1_pe_203.stp': 'assembly-18.stp',
    'package/test/testfiles/cax-if-brep/as1_pe_203.brep': 'assembly-18.brep',
  },
};

/** Minimal tar reader: 512-byte headers, name at 0..100, size at 124..136 (octal). */
function readTar(buffer) {
  const files = new Map();
  let off = 0;
  while (off + 512 <= buffer.length) {
    const name = buffer.toString('latin1', off, off + 100).replace(/\0.*$/, '');
    if (!name) { off += 512; continue; }
    const size = parseInt(buffer.toString('latin1', off + 124, off + 136).replace(/\0.*$/, '').trim(), 8) || 0;
    const type = buffer.toString('latin1', off + 156, off + 157);
    const start = off + 512;
    if (type === '0' || type === '\0' || type === '') {
      files.set(name, buffer.subarray(start, start + size));
    }
    off = start + Math.ceil(size / 512) * 512;
  }
  return files;
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function main() {
  const verifyOnly = process.argv.includes('--verify');
  writeFileSync(PIN_FILE, JSON.stringify(PIN, null, 2) + '\n');

  if (verifyOnly) {
    let missing = 0;
    for (const [, out] of Object.entries(PIN.members)) {
      if (!existsSync(join(OUT_DIR, out))) { console.log(`missing ${out}`); missing++; }
    }
    console.log(missing
      ? `pins written to ${PIN_FILE}; ${missing} fixture(s) not fetched yet`
      : `pins OK and all ${Object.keys(PIN.members).length} fixtures present`);
    return missing ? 1 : 0;
  }

  console.log(`downloading ${PIN.tarball}`);
  const res = await fetch(PIN.tarball);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const gz = Buffer.from(await res.arrayBuffer());
  const got = sha256(gz);
  if (got !== PIN.sha256) {
    throw new Error(`tarball hash mismatch\n  want ${PIN.sha256}\n  got  ${got}`);
  }
  console.log(`sha256 OK (${PIN.sha256.slice(0, 16)}…), ${gz.length} bytes`);

  const files = readTar(gunzipSync(gz));
  mkdirSync(OUT_DIR, { recursive: true });
  let n = 0;
  for (const [member, out] of Object.entries(PIN.members)) {
    const data = files.get(member);
    if (!data) throw new Error(`member not found in tarball: ${member}`);
    writeFileSync(join(OUT_DIR, out), data);
    console.log(`  ${out.padEnd(24)} ${String(data.length).padStart(8)} B   ${sha256(data).slice(0, 12)}…`);
    n++;
  }
  writeFileSync(join(OUT_DIR, 'NOTICE.txt'),
    `These files are third-party STEP/IGES/BREP test models from ${PIN.package}@${PIN.version}\n`
    + `(${PIN.license}), fetched by tools/fetch-step-fixtures.mjs from\n${PIN.tarball}\n`
    + `sha256 ${PIN.sha256}\n\nThey are used only by tools/verify-step-import.mjs and are not\n`
    + 'part of this project or its releases.\n');
  console.log(`\n${n} fixtures in ${OUT_DIR}`);
  return 0;
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
