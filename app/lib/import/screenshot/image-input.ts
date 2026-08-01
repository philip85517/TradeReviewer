import { fingerprintBytes } from "../file-fingerprint";
import {
  SCREENSHOT_MAX_FILE_BYTES,
  SCREENSHOT_MAX_FILES,
  SCREENSHOT_MAX_PIXELS,
} from "./contracts";
import type {
  ScreenshotFileValidation,
  ScreenshotInput,
} from "./contracts";

const SUPPORTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const SUPPORTED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

function hasSupportedExtension(fileName: string): boolean {
  const extension = fileName.split(".").at(-1)?.toLowerCase();
  return extension !== undefined && SUPPORTED_EXTENSIONS.has(extension);
}

function hasSupportedImageType(file: File): boolean {
  if (file.type.length > 0) {
    return SUPPORTED_MIME_TYPES.has(file.type.toLowerCase());
  }

  return hasSupportedExtension(file.name);
}

export function validateScreenshotFiles(
  files: readonly File[],
): ScreenshotFileValidation {
  if (files.length === 0) {
    return {
      ok: false,
      code: "empty",
      message: "请选择至少一张截图",
    };
  }
  if (files.length > SCREENSHOT_MAX_FILES) {
    return {
      ok: false,
      code: "too-many",
      message: `一次最多可导入 ${SCREENSHOT_MAX_FILES} 张截图`,
    };
  }

  for (const file of files) {
    if (!hasSupportedImageType(file)) {
      return {
        ok: false,
        code: "unsupported-type",
        message: "仅支持 JPG、PNG 或 WebP 格式的截图",
        fileName: file.name,
      };
    }
    if (file.size > SCREENSHOT_MAX_FILE_BYTES) {
      return {
        ok: false,
        code: "file-too-large",
        message: "截图文件超过 25 MiB",
        fileName: file.name,
      };
    }
  }

  return { ok: true, files };
}

export function validateDecodedDimensions(width: number, height: number): void {
  if (width * height > SCREENSHOT_MAX_PIXELS) {
    throw new Error("图片像素超过 6000 万");
  }
}

export async function buildScreenshotInputs(
  files: readonly File[],
): Promise<ScreenshotInput[]> {
  return Promise.all(
    files.map(async (file, index) => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const fingerprint = fingerprintBytes(bytes);
      return {
        id: `screenshot-image:${fingerprint}`,
        index,
        file,
        fingerprint,
      };
    }),
  );
}

export function buildScreenshotBatchId(
  inputs: readonly ScreenshotInput[],
): string {
  const fingerprints = inputs.map(({ fingerprint }) => fingerprint);
  const bytes = new TextEncoder().encode(JSON.stringify(fingerprints));
  return `screenshot-batch:${fingerprintBytes(bytes)}`;
}
