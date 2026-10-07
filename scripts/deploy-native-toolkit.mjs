import { copyFile, lstat, mkdir, mkdtemp, readFile, rm, writeFile, chmod } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const OWN_DIR = dirname(fileURLToPath(import.meta.url));
const MODULES = ["deploy-native.mjs", "deploy-source.mjs", "deploy-native-runtime.mjs", "deploy.mjs", "deploy-native-toolkit.mjs", "native-environment.mjs"];

async function details(path) {
  try { return await lstat(path); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

async function rejectSymlinkAncestors(path, allowMissing = true) {
  const absolute = resolve(path);
  const parts = absolute.split(sep);
  let current = parts[0] || sep;
  if (current === "/var") { try { current = realpathSync.native(current); } catch {} }
  for (const part of parts.slice(parts[0] === "" ? 1 : 1)) {
    current = current === sep ? join(current, part) : join(current, part);
    if (current === "/var") { try { current = realpathSync.native(current); } catch {} }
    const stat = await details(current);
    if (!stat) { if (allowMissing) return; throw new Error(`Missing path ancestor: ${current}`); }
    if (stat.isSymbolicLink()) throw new Error(`Refusing symlink path: ${current}`);
  }
}

async function assertRegular(path, label) {
  const stat = await details(path);
  if (!stat) return null;
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`${label} must be an ordinary file`);
  if (stat.nlink > 1) throw new Error(`${label} must not be hard-linked`);
  return stat;
}

async function restoreEntry(entry) {
  if (entry.existed) {
    const current = await assertRegular(entry.destination, `Toolkit destination ${entry.destination}`);
    if (!current) throw new Error(`Toolkit destination disappeared during rollback: ${entry.destination}`);
    await writeFile(entry.destination, await readFile(entry.backup), { mode: entry.mode });
    await chmod(entry.destination, entry.mode);
  } else {
    const current = await details(entry.destination);
    if (current?.isSymbolicLink() || (current && !current.isFile())) throw new Error(`Toolkit destination was replaced unsafely during rollback: ${entry.destination}`);
    if (current?.nlink > 1) throw new Error(`Toolkit destination was hard-linked during rollback: ${entry.destination}`);
    await rm(entry.destination, { force: true });
  }
}

function sourceLayout(toolkitDir) {
  const supplied = toolkitDir ? resolve(toolkitDir) : null;
  const sourceScripts = supplied ? (supplied.endsWith(`${sep}scripts`) ? supplied : join(supplied, "scripts")) : OWN_DIR;
  const installed = basename(sourceScripts) === "ops";
  const sourceRoot = dirname(sourceScripts);
  const files = MODULES.map((name) => ({ source: join(sourceScripts, name), target: join("ops", name) }));
  if (installed) {
    files.push({ source: join(sourceScripts, "native-environment.json"), target: join("ops", "native-environment.json") });
    files.push({ source: join(sourceScripts, "start-native.command"), target: join("ops", "start-native.command") });
    files.push({ source: join(sourceRoot, "Makefile"), target: "Makefile" }, { source: join(sourceRoot, "DEPLOYMENT.md"), target: "DEPLOYMENT.md" });
  } else {
    files.push({ source: join(sourceRoot, "conf", "native-environment.json"), target: join("ops", "native-environment.json") });
    files.push({ source: join(sourceRoot, "deploy", "ops", "start-native.command"), target: join("ops", "start-native.command") });
    files.push({ source: join(sourceRoot, "deploy", "target", "Makefile"), target: "Makefile" }, { source: join(sourceRoot, "deploy", "DEPLOYMENT.md"), target: "DEPLOYMENT.md" });
  }
  return files;
}

function basename(path) { return path.split(sep).filter(Boolean).at(-1); }

export async function beginNativeToolkitTransaction({ targetDir, toolkitDir } = {}) {
  if (typeof targetDir !== "string" || !isAbsolute(targetDir)) throw new Error("targetDir must be absolute");
  let target = resolve(targetDir);
  const requestedTargetStat = await details(target);
  if (requestedTargetStat?.isSymbolicLink()) throw new Error("Refusing symlink targetDir");
  // Validate the user-supplied path before canonicalization; resolving its
  // parent first would hide a symlinked intermediate directory outside the
  // deployment root.
  await rejectSymlinkAncestors(target);
  try { target = join(realpathSync.native(dirname(target)), basename(target)); } catch {}
  await rejectSymlinkAncestors(target);
  const ops = join(target, "ops");
  const targetStat = await details(target);
  if (targetStat?.isSymbolicLink() || (targetStat && !targetStat.isDirectory())) throw new Error("targetDir must be an ordinary directory");
  const opsStat = await details(ops);
  if (opsStat?.isSymbolicLink() || (opsStat && !opsStat.isDirectory())) throw new Error("target ops must be an ordinary directory");
  const files = sourceLayout(toolkitDir);
  const backupDir = await mkdtemp(join(tmpdir(), "tradereview-toolkit-backup-"));
  const manifest = [];
  let settled = false;
  try {
    await mkdir(target, { recursive: true }); await mkdir(ops, { recursive: true });
    for (let index = 0; index < files.length; index += 1) {
      const item = files[index];
      await rejectSymlinkAncestors(item.source, false);
      const sourceStat = await assertRegular(item.source, `Toolkit source ${item.source}`);
      const destination = join(target, item.target);
      await rejectSymlinkAncestors(dirname(destination), true);
      const previous = await assertRegular(destination, `Toolkit destination ${destination}`);
      const backup = join(backupDir, String(index));
      if (previous) { await writeFile(backup, await readFile(destination), { mode: previous.mode & 0o777 }); }
      manifest.push({ destination, backup, existed: Boolean(previous), mode: previous?.mode & 0o777, sourceMode: sourceStat.mode & 0o777 });
      await copyFile(item.source, destination);
      await chmod(destination, sourceStat.mode & 0o777);
    }
    async function restore() {
      if (settled) return; settled = true;
      for (const entry of [...manifest].reverse()) {
        await restoreEntry(entry);
      }
      await rm(backupDir, { recursive: true, force: true });
    }
    async function discard() { if (settled) return; settled = true; await rm(backupDir, { recursive: true, force: true }); }
    return { restore, discard };
  } catch (error) {
    for (const entry of [...manifest].reverse()) {
      try { await restoreEntry(entry); } catch {}
    }
    await rm(backupDir, { recursive: true, force: true });
    throw error;
  }
}
