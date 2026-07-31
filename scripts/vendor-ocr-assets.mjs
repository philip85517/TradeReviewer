import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename } from "node:path";

const publicRoot = new URL("../public/ocr/", import.meta.url);
const modelsDirectory = new URL("models/", publicRoot);
const ortDirectory = new URL("ort/", publicRoot);
const ortSourceDirectory = new URL("../node_modules/onnxruntime-web/dist/", import.meta.url);

const models = [
  {
    file: "PP-OCRv5_mobile_det_onnx_infer.tar",
    url: "https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv5_mobile_det_onnx_infer.tar",
    bytes: 4_843_520,
    sha256: "781056046c9ed77a15c94681605db6a0f62317c2e9cce6931c71da2478d4bc30",
  },
  {
    file: "PP-OCRv5_mobile_rec_onnx_infer.tar",
    url: "https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv5_mobile_rec_onnx_infer.tar",
    bytes: 16_701_440,
    sha256: "f7e792bc836f36e7ef895ad47c426d75b0b75b1650caa6d63fe9418441ffba8c",
  },
];

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function verifyFile(fileUrl, expected) {
  const bytes = await readFile(fileUrl);
  const actual = {
    bytes: bytes.byteLength,
    sha256: digest(bytes),
  };
  if (
    actual.bytes !== expected.bytes ||
    actual.sha256 !== expected.sha256
  ) {
    throw new Error(
      `${basename(fileUrl.pathname)} failed verification: expected ${expected.bytes} bytes/${expected.sha256}, received ${actual.bytes} bytes/${actual.sha256}`,
    );
  }
  return actual;
}

function temporaryUrl(destination) {
  return new URL(
    `${basename(destination.pathname)}.tmp-${process.pid}-${Date.now()}`,
    new URL("./", destination),
  );
}

async function downloadVerifiedModel(model) {
  const destination = new URL(model.file, modelsDirectory);
  try {
    await verifyFile(destination, model);
    return {
      path: `models/${model.file}`,
      bytes: model.bytes,
      sha256: model.sha256,
      source: model.url,
    };
  } catch {
    // An absent or invalid destination is replaced only after a fresh
    // download passes both prescribed verification checks.
  }

  const temporary = temporaryUrl(destination);
  try {
    const response = await fetch(model.url);
    if (!response.ok) {
      throw new Error(
        `Could not download ${model.url}: ${response.status} ${response.statusText}`,
      );
    }
    await writeFile(temporary, new Uint8Array(await response.arrayBuffer()), {
      flag: "wx",
    });
    await verifyFile(temporary, model);
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
  return {
    path: `models/${model.file}`,
    bytes: model.bytes,
    sha256: model.sha256,
    source: model.url,
  };
}

async function copyVerifiedWasm(file) {
  const source = new URL(file, ortSourceDirectory);
  const destination = new URL(file, ortDirectory);
  const temporary = temporaryUrl(destination);
  try {
    await copyFile(source, temporary);
    const bytes = await readFile(temporary);
    const verified = {
      path: `ort/${file}`,
      bytes: bytes.byteLength,
      sha256: digest(bytes),
      source: `node_modules/onnxruntime-web/dist/${file}`,
    };
    await rename(temporary, destination);
    return verified;
  } finally {
    await rm(temporary, { force: true });
  }
}

await mkdir(modelsDirectory, { recursive: true });
await mkdir(ortDirectory, { recursive: true });

const modelAssets = [];
for (const model of models) {
  modelAssets.push(await downloadVerifiedModel(model));
}

const wasmFiles = (await readdir(ortSourceDirectory))
  .filter((file) => /^ort-wasm.*\.wasm$/.test(file))
  .sort();
if (wasmFiles.length === 0) {
  throw new Error(
    "No node_modules/onnxruntime-web/dist/ort-wasm*.wasm files found",
  );
}
const wasmAssets = [];
for (const file of wasmFiles) {
  wasmAssets.push(await copyVerifiedWasm(file));
}

const manifest = {
  models: modelAssets,
  wasm: wasmAssets,
};
const manifestDestination = new URL("asset-manifest.json", publicRoot);
const manifestTemporary = temporaryUrl(manifestDestination);
try {
  await writeFile(
    manifestTemporary,
    `${JSON.stringify(manifest, null, 2)}\n`,
    { flag: "wx" },
  );
  await rename(manifestTemporary, manifestDestination);
} finally {
  await rm(manifestTemporary, { force: true });
}

console.log(
  `Verified ${modelAssets.length} OCR models and ${wasmAssets.length} ONNX Runtime WASM assets.`,
);
