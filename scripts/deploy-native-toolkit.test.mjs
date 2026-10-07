import assert from "node:assert/strict";
import { cp, link, lstat, mkdtemp, mkdir, readFile, readlink, rm, symlink, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { beginNativeToolkitTransaction } from "./deploy-native-toolkit.mjs";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");

async function tempTarget() {
  const root = await mkdtemp(join(tmpdir(), "tradereview-toolkit-"));
  await mkdir(join(root, "ops"), { recursive: true });
  return root;
}

test("installs the current toolkit and restores prior control files", async () => {
  const target = await tempTarget();
  const oldMakefile = join(target, "Makefile");
  const oldOps = join(target, "ops", "deploy-native.mjs");
  await writeFile(oldMakefile, "old makefile"); await chmod(oldMakefile, 0o640);
  await writeFile(oldOps, "old ops");
  const transaction = await beginNativeToolkitTransaction({ targetDir: target });
  assert.equal(await readFile(join(target, "ops", "deploy-native-toolkit.mjs"), "utf8"), await readFile(join(repo, "scripts", "deploy-native-toolkit.mjs"), "utf8"));
  assert.equal(await readFile(join(target, "ops", "native-node.sh"), "utf8"), await readFile(join(repo, "scripts", "native-node.sh"), "utf8"));
  await transaction.restore();
  assert.equal(await readFile(oldMakefile, "utf8"), "old makefile");
  assert.equal(await readFile(oldOps, "utf8"), "old ops");
  await assert.rejects(() => lstat(join(target, "ops", "deploy-native-toolkit.mjs")), { code: "ENOENT" });
  await assert.rejects(() => lstat(join(target, "ops", "native-node.sh")), { code: "ENOENT" });
  await rm(target, { recursive: true, force: true });
});

test("restores all files after an install failure and leaves the target sentinel", async () => {
  const target = await tempTarget();
  await writeFile(join(target, "ops", "sentinel"), "keep");
  await assert.rejects(() => beginNativeToolkitTransaction({ targetDir: target, toolkitDir: join(target, "missing-toolkit") }), /toolkit|missing|source/i);
  assert.equal(await readFile(join(target, "ops", "sentinel"), "utf8"), "keep");
  await assert.rejects(() => lstat(join(target, "ops", "deploy-native.mjs")), { code: "ENOENT" });
  await rm(target, { recursive: true, force: true });
});

test("installed toolkit resolves its control files from the target deployment", async () => {
  const target = await tempTarget();
  for (const name of ["deploy-native.mjs", "deploy-source.mjs", "deploy-native-runtime.mjs", "deploy.mjs", "deploy-native-toolkit.mjs", "native-environment.mjs", "native-node.sh"]) await cp(join(repo, "scripts", name), join(target, "ops", name));
  await cp(join(repo, "conf", "native-environment.json"), join(target, "ops", "native-environment.json"));
  await cp(join(repo, "deploy", "ops", "start-native.command"), join(target, "ops", "start-native.command"));
  await cp(join(repo, "deploy", "target", "Makefile"), join(target, "Makefile"));
  await cp(join(repo, "deploy", "DEPLOYMENT.md"), join(target, "DEPLOYMENT.md"));
  const installed = await import(`${join(target, "ops", "deploy-native-toolkit.mjs")}?installed=${Date.now()}`);
  const transaction = await installed.beginNativeToolkitTransaction({ targetDir: target });
  assert.equal((await lstat(join(target, "ops", "deploy-native-runtime.mjs"))).isFile(), true);
  await transaction.discard();
  await rm(target, { recursive: true, force: true });
});

test("rejects symlinked target roots without touching the outsider", async () => {
  const parent = await mkdtemp(join(tmpdir(), "tradereview-toolkit-link-"));
  const outsider = await mkdtemp(join(tmpdir(), "tradereview-toolkit-outside-"));
  const target = join(parent, "target");
  await symlink(outsider, target);
  await assert.rejects(() => beginNativeToolkitTransaction({ targetDir: target }), /symlink|symbolic/i);
  assert.equal((await readlink(target)), outsider);
  await rm(parent, { recursive: true, force: true }); await rm(outsider, { recursive: true, force: true });
});

test("rejects a symlinked target parent before canonicalization", async () => {
  const parent = await mkdtemp(join(tmpdir(), "tradereview-toolkit-parent-"));
  const outsider = await mkdtemp(join(tmpdir(), "tradereview-toolkit-parent-outside-"));
  const linkedParent = join(parent, "linked-parent");
  const target = join(linkedParent, "target");
  await symlink(outsider, linkedParent);
  await assert.rejects(() => beginNativeToolkitTransaction({ targetDir: target }), /symlink|symbolic/i);
  assert.equal((await lstat(join(outsider, "ops")).catch(() => null)), null);
  await rm(parent, { recursive: true, force: true }); await rm(outsider, { recursive: true, force: true });
});

test("rejects hard-linked toolkit destinations without touching the outside inode", async () => {
  const target = await tempTarget();
  const outside = join(target, "outside-control");
  const destination = join(target, "ops", "native-environment.mjs");
  await writeFile(outside, "outside sentinel");
  await link(outside, destination);
  await assert.rejects(() => beginNativeToolkitTransaction({ targetDir: target }), /hard-linked/i);
  assert.equal(await readFile(outside, "utf8"), "outside sentinel");
  assert.equal((await lstat(destination)).nlink, 2);
  await rm(target, { recursive: true, force: true });
});
