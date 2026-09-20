import type {
  RecallDirectoryExportResult,
  RecallDirectoryHandle,
  RecallExportManifest,
  RecallFileHandle,
  RecallWritable,
} from "./types";

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: () => Promise<RecallDirectoryHandle>;
};

function browserWindow() {
  if (typeof window === "undefined") return undefined;
  return window as DirectoryPickerWindow;
}

export function canUseRecallDirectoryExport() {
  const candidate = browserWindow();
  return Boolean(
    candidate?.isSecureContext === true &&
      typeof candidate.showDirectoryPicker === "function",
  );
}

/** Call this directly from a user click before starting any asynchronous writes. */
export async function chooseRecallDirectory() {
  const candidate = browserWindow();
  if (!candidate?.isSecureContext || typeof candidate.showDirectoryPicker !== "function") {
    return null;
  }
  try {
    return await candidate.showDirectoryPicker();
  } catch (error) {
    if (isCancellation(error)) return null;
    throw error;
  }
}

function isCancellation(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "name" in error &&
      (error as { name?: string }).name === "AbortError",
  );
}

function isNotFound(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: string }).name;
  return name === "NotFoundError" || name === "ENOENT";
}

function isCollision(error: unknown) {
  if (!error || typeof error !== "object") return false;
  return (error as { name?: string }).name === "TypeMismatchError";
}

async function createUniqueFolder(root: RecallDirectoryHandle, baseName: string) {
  for (let suffix = 1; suffix <= 9999; suffix += 1) {
    const folderName = suffix === 1 ? baseName : `${baseName}_${String(suffix).padStart(2, "0")}`;
    let exists = false;
    try {
      await root.getDirectoryHandle(folderName);
      exists = true;
    } catch (error) {
      if (isCollision(error)) exists = true;
      else if (!isNotFound(error)) throw error;
    }
    if (!exists) {
      return {
        folderName,
        handle: await root.getDirectoryHandle(folderName, { create: true }),
      };
    }
  }
  throw new Error("无法为导出创建唯一目录");
}

async function writeFile(
  handle: RecallFileHandle,
  bytes: ReadonlyArray<number>,
  mimeType: string,
) {
  let writable: RecallWritable | undefined;
  try {
    writable = await handle.createWritable();
    const buffer = Uint8Array.from(bytes);
    await writable.write(new Blob([buffer.buffer as ArrayBuffer], { type: mimeType }));
  } catch (error) {
    throw error;
  } finally {
    if (writable) await writable.close();
  }
}

export async function writeRecallExportDirectory(
  manifest: RecallExportManifest,
  root: RecallDirectoryHandle,
): Promise<RecallDirectoryExportResult> {
  const totalFiles = manifest.files.length;
  let folderName: string | undefined;
  let displayPath: string | undefined;
  let writtenFiles = 0;
  try {
    const folder = await createUniqueFolder(root, manifest.folderName);
    folderName = folder.folderName;
    displayPath = `${root.name ?? "选择的目录"}/${folderName}`;
    const images = await folder.handle.getDirectoryHandle("images", { create: true });
    for (const file of manifest.files.filter((candidate) => candidate.kind === "image")) {
      const fileName = file.path.startsWith("images/") ? file.path.slice("images/".length) : file.path;
      await writeFile(
        await images.getFileHandle(fileName, { create: true }),
        file.bytes,
        file.mimeType,
      );
      writtenFiles += 1;
    }
    for (const file of manifest.files.filter((candidate) => candidate.kind === "markdown")) {
      const fileName = file.path.startsWith("images/") ? file.path.slice("images/".length) : file.path;
      await writeFile(
        await folder.handle.getFileHandle(fileName, { create: true }),
        file.bytes,
        file.mimeType,
      );
      writtenFiles += 1;
    }
    return { status: "success", folderName, displayPath, writtenFiles, totalFiles };
  } catch (error) {
    return {
      status: "partial",
      folderName,
      displayPath,
      writtenFiles,
      totalFiles,
      error,
    };
  }
}
