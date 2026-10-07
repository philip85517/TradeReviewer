import { execFile } from "node:child_process";
import { mkdtemp, lstat, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const COMMAND_TIMEOUT_MS = 30_000;

const APPLICATION_ROOT_EXCLUSIONS = new Set([
  ".git", "node_modules", "dist", ".next", ".vinext", ".wrangler", "data", "config", "logs",
  "trades", ".superpowers", ".worktrees", ".scratch", ".data",
]);
const PRIVATE_CREDENTIAL_NAMES = new Set([
  ".dockercfg", ".netrc", ".npmrc", "credentials.json", "id_dsa", "id_ecdsa", "id_ed25519", "id_rsa",
  "service-account.json",
]);
const PRIVATE_CREDENTIAL_EXTENSIONS = [".der", ".jks", ".key", ".keystore", ".p12", ".pem", ".pfx", ".pkcs8", ".pkcs12"];

function applicationPathAllowed(pathname) {
  const normalized = pathname.split(sep).join("/");
  if (!normalized || normalized === ".") return true;
  const [root] = normalized.split("/");
  if (APPLICATION_ROOT_EXCLUSIONS.has(root)) return false;
  const filename = normalized.slice(normalized.lastIndexOf("/") + 1).toLowerCase();
  if (filename === ".env.example") return true;
  if (filename === ".env" || filename.startsWith(".env.")) return false;
  if (PRIVATE_CREDENTIAL_NAMES.has(filename)) return false;
  return !PRIVATE_CREDENTIAL_EXTENSIONS.some((extension) => filename.endsWith(extension));
}

async function runGit(sourceDir, args) {
  try {
    const result = await execFileAsync("git", args, {
      cwd: sourceDir, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: COMMAND_TIMEOUT_MS,
    });
    return result.stdout;
  } catch (error) {
    if (error.code === "ETIMEDOUT") throw new Error(`git ${args[0]} timed out after ${COMMAND_TIMEOUT_MS}ms`);
    const detail = String(error.stderr || error.message || "git command failed").trim();
    throw new Error(`git ${args[0]} failed: ${detail}`, { cause: error });
  }
}

function trimmed(value) {
  return value.trim();
}

function validateRef(ref) {
  if (typeof ref !== "string" || !ref || ref.startsWith("-") || /[\0\r\n]/u.test(ref)) {
    throw new Error("Git ref is unsafe or empty");
  }
  return ref;
}

function statusPaths(status) {
  const fields = status.split("\0").filter(Boolean);
  const paths = [];
  for (let index = 0; index < fields.length; index += 1) {
    const entry = fields[index];
    const path = entry.slice(3);
    paths.push(path);
    if (entry.slice(0, 2).includes("R") || entry.slice(0, 2).includes("C")) {
      if (fields[index + 1]) paths.push(fields[++index]);
    }
  }
  return paths;
}

async function resolveCurrent(sourceDir, dependencies) {
  const status = await dependencies.runGit(sourceDir, ["status", "--porcelain=v1", "--untracked-files=all", "-z"]);
  const unfinished = statusPaths(status).filter((path) => applicationPathAllowed(path));
  if (unfinished.length) throw new Error(`Cannot deploy unfinished source; worktree has application changes: ${unfinished.join(", ")}`);
  const commit = trimmed(await dependencies.runGit(sourceDir, ["rev-parse", "--verify", "HEAD^{commit}"]));
  if (!/^[0-9a-f]{40}$/u.test(commit)) throw new Error("Git did not resolve a full commit SHA");
  const branch = trimmed(await dependencies.runGit(sourceDir, ["symbolic-ref", "--quiet", "--short", "HEAD"]).catch(() => "")) || null;
  return { commit, requestedRef: "current", branch, resolvedRef: "HEAD" };
}

export async function resolveReleaseSource({ sourceDir, ref = "current" }, dependencies = {}) {
  const resolvedSourceDir = resolve(sourceDir);
  const run = dependencies.runGit ?? runGit;
  const selectedRef = validateRef(ref);
  if (selectedRef === "current") return resolveCurrent(resolvedSourceDir, { runGit: run });

  let resolvedRef = selectedRef;
  if (selectedRef === "master") {
    await run(resolvedSourceDir, ["fetch", "origin", "+refs/heads/master:refs/remotes/origin/master"]);
    resolvedRef = "refs/remotes/origin/master";
  }
  const commit = trimmed(await run(resolvedSourceDir, ["rev-parse", "--verify", "--end-of-options", `${resolvedRef}^{commit}`]));
  if (!/^[0-9a-f]{40}$/u.test(commit)) throw new Error("Git did not resolve a full commit SHA");
  const branch = selectedRef === "master"
    ? "master"
    : trimmed(await run(resolvedSourceDir, ["for-each-ref", "--format=%(refname:short)", `refs/heads/${selectedRef}`]).catch(() => "")) || null;
  return { commit, requestedRef: selectedRef, branch, resolvedRef };
}

async function writeArchive(sourceDir, commit, archivePath) {
  const child = (await import("node:child_process")).spawn("git", ["archive", "--format=tar", commit], {
    cwd: sourceDir,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = createWriteStream(archivePath, { mode: 0o600 });
  let errorOutput = "";
  child.stderr.on("data", (chunk) => { errorOutput += chunk.toString(); });
  child.stdout.pipe(output);
  await new Promise((resolvePromise, reject) => {
    let childClosed = false;
    let outputFinished = false;
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`git archive timed out after ${COMMAND_TIMEOUT_MS}ms`));
    }, COMMAND_TIMEOUT_MS);
    const complete = () => {
      if (childClosed && outputFinished) {
        clearTimeout(timer);
        resolvePromise();
      }
    };
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    output.once("error", (error) => { clearTimeout(timer); reject(error); });
    output.once("finish", () => { outputFinished = true; complete(); });
    child.once("close", (code) => {
      if (code !== 0) {
        clearTimeout(timer);
        reject(new Error(`git archive failed: ${errorOutput.trim()}`));
      }
      else { childClosed = true; complete(); }
    });
  });
}

async function tarOutput(args) {
  return (await execFileAsync("tar", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 })).stdout;
}

async function copyFiltered(source, destination, root) {
  const entries = await readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = join(source, entry.name);
    const pathFromRoot = relative(root, sourcePath);
    if (!applicationPathAllowed(pathFromRoot)) continue;
    const destinationPath = join(destination, entry.name);
    const details = await lstat(sourcePath);
    if (details.isSymbolicLink()) throw new Error(`Snapshot archive contains symlink: ${pathFromRoot}`);
    if (details.isDirectory()) {
      await mkdir(destinationPath, { recursive: true });
      await copyFiltered(sourcePath, destinationPath, root);
    } else if (details.isFile()) {
      await mkdir(dirname(destinationPath), { recursive: true });
      await writeFile(destinationPath, await readFile(sourcePath), { mode: details.mode & 0o777 });
    }
  }
}

export async function createSourceSnapshot({ sourceDir, selection, destinationDir }) {
  const commit = typeof selection === "string" ? selection : selection?.commit;
  if (!/^[0-9a-f]{40}$/u.test(commit ?? "")) throw new Error("Snapshot requires a full commit SHA");
  const target = resolve(destinationDir);
  await mkdir(target, { recursive: true });
  if ((await readdir(target)).length) throw new Error("Snapshot destination must be empty");
  const temporaryRoot = await mkdtemp(join(tmpdir(), "tradereview-archive-"));
  const archivePath = join(temporaryRoot, "source.tar");
  const extracted = join(temporaryRoot, "extracted");
  try {
    await writeArchive(resolve(sourceDir), commit, archivePath);
    const names = (await tarOutput(["-tf", archivePath])).split("\n").filter(Boolean);
    for (const name of names) {
      const normalized = name.replace(/\/$/u, "");
      if (normalized.startsWith("/") || normalized.split("/").includes("..")) throw new Error(`Unsafe archive path: ${name}`);
    }
    const listing = await tarOutput(["-tvf", archivePath]);
    if (listing.split("\n").some((line) => line.startsWith("l"))) throw new Error("Snapshot archive contains symlink");
    await mkdir(extracted);
    await execFileAsync("tar", ["-xf", archivePath, "-C", extracted, "--no-same-owner", "--no-same-permissions"]);
    await copyFiltered(extracted, target, extracted);
    return target;
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
