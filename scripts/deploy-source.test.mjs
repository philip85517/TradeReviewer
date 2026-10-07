import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, symlink, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test, { afterEach } from "node:test";

import { createSourceSnapshot, resolveReleaseSource } from "./deploy-source.mjs";

const exec = promisify(execFile);
const sandboxes = [];

async function git(cwd, ...args) {
  return (await exec("git", args, { cwd, maxBuffer: 4 * 1024 * 1024 })).stdout.trim();
}

async function repository() {
  const root = await mkdtemp(join(tmpdir(), "tradereview-source-"));
  sandboxes.push(root);
  const sourceDir = join(root, "source");
  await mkdir(sourceDir);
  await git(sourceDir, "init", "--initial-branch=main");
  await git(sourceDir, "config", "user.email", "tests@example.invalid");
  await git(sourceDir, "config", "user.name", "Source tests");
  await writeFile(join(sourceDir, "app.js"), "committed\n");
  await mkdir(join(sourceDir, "build"));
  await writeFile(join(sourceDir, "build", "sites-vite-plugin.ts"), "export default {};\n");
  await git(sourceDir, "add", ".");
  await git(sourceDir, "commit", "-m", "initial");
  return { root, sourceDir };
}

afterEach(async () => {
  while (sandboxes.length) await rm(sandboxes.pop(), { recursive: true, force: true });
});

test("current resolves a clean branch and full commit", async () => {
  const { sourceDir } = await repository();
  const commit = await git(sourceDir, "rev-parse", "HEAD");
  assert.match(commit, /^[0-9a-f]{40}$/);
  assert.deepEqual(await resolveReleaseSource({ sourceDir }), {
    commit,
    requestedRef: "current",
    branch: "main",
    resolvedRef: "HEAD",
  });
});

test("current rejects tracked edits and untracked application files", async () => {
  const { sourceDir } = await repository();
  await writeFile(join(sourceDir, "app.js"), "changed\n");
  await assert.rejects(resolveReleaseSource({ sourceDir }), /unfinished|dirty|uncommitted/i);
  await git(sourceDir, "checkout", "--", "app.js");
  await writeFile(join(sourceDir, "new-app.js"), "new\n");
  await assert.rejects(resolveReleaseSource({ sourceDir }), /unfinished|dirty|uncommitted/i);
});

test("current permits excluded scratch and credential changes", async () => {
  const { sourceDir } = await repository();
  await mkdir(join(sourceDir, ".scratch"));
  await writeFile(join(sourceDir, ".scratch", "note.txt"), "local\n");
  await writeFile(join(sourceDir, ".env"), "SECRET=local\n");
  assert.equal((await resolveReleaseSource({ sourceDir })).branch, "main");
});

test("detached current reports no branch", async () => {
  const { sourceDir } = await repository();
  const commit = await git(sourceDir, "rev-parse", "HEAD");
  await git(sourceDir, "checkout", "--detach", commit);
  const selected = await resolveReleaseSource({ sourceDir });
  assert.equal(selected.branch, null);
  assert.equal(selected.commit, commit);
});

test("explicit refs resolve despite dirty worktree and identify a local branch", async () => {
  const { sourceDir } = await repository();
  const commit = await git(sourceDir, "rev-parse", "HEAD");
  await git(sourceDir, "branch", "release");
  await writeFile(join(sourceDir, "app.js"), "dirty\n");
  const selected = await resolveReleaseSource({ sourceDir, ref: "release" });
  assert.equal(selected.commit, commit);
  assert.equal(selected.requestedRef, "release");
  assert.equal(selected.branch, "release");
});

test("current rejects an application filename whose bytes end in whitespace", async () => {
  const { sourceDir } = await repository();
  await writeFile(join(sourceDir, "app.js "), "new\n");
  await assert.rejects(resolveReleaseSource({ sourceDir }), /unfinished|application changes/i);
});

test("current rejects dirty edits to tracked build application source", async () => {
  const { sourceDir } = await repository();
  await writeFile(join(sourceDir, "build", "sites-vite-plugin.ts"), "export default { dirty: true };\n");
  await assert.rejects(resolveReleaseSource({ sourceDir }), /unfinished|application changes/i);
});

test("current rejects a staged rename from ignored state into application source", async () => {
  const { sourceDir } = await repository();
  await mkdir(join(sourceDir, ".scratch"));
  await writeFile(join(sourceDir, ".scratch", "tracked.js"), "tracked\n");
  await git(sourceDir, "add", "-f", ".scratch/tracked.js");
  await git(sourceDir, "commit", "-m", "ignored source");
  await git(sourceDir, "mv", ".scratch/tracked.js", "renamed.js");
  await writeFile(join(sourceDir, "renamed.js"), "unstaged destination\n");
  await assert.rejects(resolveReleaseSource({ sourceDir }), /unfinished|application changes/i);
});

test("resolveReleaseSource rejects an injected non-full commit SHA", async () => {
  const { sourceDir } = await repository();
  await assert.rejects(
    resolveReleaseSource({ sourceDir, ref: "main" }, { runGit: async () => "deadbeef\n" }),
    /full commit|sha/i,
  );
});

test("master fetches the current origin master commit", async () => {
  const first = await repository();
  const bare = join(first.root, "origin.git");
  await git(first.root, "init", "--bare", bare);
  await git(first.sourceDir, "remote", "add", "origin", bare);
  await git(first.sourceDir, "push", "origin", "main:master");
  const second = await repository();
  await git(second.sourceDir, "remote", "add", "origin", bare);
  await git(second.sourceDir, "fetch", "origin", "master:refs/remotes/origin/master");
  const before = await git(second.sourceDir, "rev-parse", "refs/remotes/origin/master");
  await writeFile(join(first.sourceDir, "app.js"), "remote advance\n");
  await git(first.sourceDir, "add", "app.js");
  await git(first.sourceDir, "commit", "-m", "advance");
  await git(first.sourceDir, "push", "origin", "main:master");
  const selected = await resolveReleaseSource({ sourceDir: second.sourceDir, ref: "master" });
  assert.notEqual(selected.commit, before);
  assert.equal(selected.commit, await git(second.sourceDir, "rev-parse", "refs/remotes/origin/master"));
  assert.equal(selected.resolvedRef, "refs/remotes/origin/master");
});

test("master rejects fetch failure instead of using stale origin master", async () => {
  const { sourceDir } = await repository();
  await git(sourceDir, "remote", "add", "origin", "/missing/origin.git");
  await assert.rejects(resolveReleaseSource({ sourceDir, ref: "master" }), /fetch|origin|failed/i);
});

test("snapshot contains committed bytes and filters application secrets", async () => {
  const { sourceDir, root } = await repository();
  await writeFile(join(sourceDir, "app.js"), "working tree dirt\n");
  await writeFile(join(sourceDir, ".env"), "SECRET=committed\n");
  await git(sourceDir, "add", ".env");
  await git(sourceDir, "commit", "-m", "secret fixture");
  const commit = await git(sourceDir, "rev-parse", "HEAD");
  const destinationDir = join(root, "snapshot");
  await mkdir(destinationDir);
  await createSourceSnapshot({ sourceDir, selection: { commit }, destinationDir });
  assert.equal(await readFile(join(destinationDir, "app.js"), "utf8"), "committed\n");
  assert.equal(await readFile(join(destinationDir, "build", "sites-vite-plugin.ts"), "utf8"), "export default {};\n");
  assert.equal(await readFile(join(destinationDir, ".env"), "utf8").catch(() => null), null);
});

test("snapshot rejects committed symlinks", async () => {
  const { sourceDir, root } = await repository();
  await symlink("app.js", join(sourceDir, "link.js"));
  await git(sourceDir, "add", "link.js");
  await git(sourceDir, "commit", "-m", "symlink fixture");
  await assert.rejects(
    createSourceSnapshot({ sourceDir, selection: { commit: await git(sourceDir, "rev-parse", "HEAD") }, destinationDir: join(root, "snapshot") }),
    /symlink/i,
  );
});
