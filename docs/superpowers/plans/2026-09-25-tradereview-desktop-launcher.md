# TradeReview Desktop Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Provide an executable `tradeReview.command` on the macOS desktop that starts the official TradeReview service and opens the browser when it is ready.

**Architecture:** Keep the reusable launcher source in `deploy/ops/tradeReview.command`. The launcher will preflight port 3022 with `lsof`, reuse only a healthy listener whose working directory resolves inside the official deployment release, and otherwise fail without killing processes or changing ports. When the port is free it will start the existing foreground `ops/start-native.command` and run a bounded background readiness poll that opens the official URL; installation copies the source to `~/Desktop/tradeReview.command` and marks it executable.

**Tech Stack:** macOS zsh, `lsof`, `curl`, `open`, existing Node production startup script.

**Spec:** `docs/superpowers/specs/2026-09-25-tradereview-desktop-launcher-design.md`

## Global Constraints

- Official service URL is `http://127.0.0.1:3022/`.
- Official deployment root is `/Users/zhoulin/projects/交易空间/TradingReview`.
- Invoke its existing `ops/start-native.command`; do not duplicate runtime configuration.
- Do not terminate an unrelated listener, choose another port, or modify business data.
- Keep the service attached to the launcher Terminal session; closing that session stops the service.
- Preserve the pre-existing untracked `.scratch/start-master-20260923/` directory.

## Review Focus

- Port 3022 is owned by an unrelated service: report conflict and preserve it.
- Port 3022 is already owned by this deployment: open the page without launching a duplicate.
- The current release symlink resolves to a physical release directory: verify listener ownership against the resolved release.
- Startup exits before health becomes ready: readiness poll reports failure after a bounded wait.
- Desktop path or executable permissions: installation creates exactly `~/Desktop/tradeReview.command` with execute permission.

---

### Task 1: Add the reusable macOS desktop launcher

**Files:**
- Create: `deploy/ops/tradeReview.command`
- Modify: `README.md` (add the desktop launcher install and usage instructions)

**Interfaces:**
- Consumes: `/Users/zhoulin/projects/交易空间/TradingReview/ops/start-native.command`, local `lsof`, `curl`, and `open`.
- Produces: executable zsh script at `deploy/ops/tradeReview.command` that opens the official URL only after `/api/storage/status` returns success.

- [x] Create the source script with strict shell mode, explicit official paths, and one bounded readiness timeout.
- [x] Resolve `app/current` physically and inspect PID/cwd for any existing 3022 listener; reuse only a healthy listener rooted in the official release path.
- [x] If 3022 is occupied by another process, print an actionable error and exit without signaling it.
- [x] If 3022 is free, start the existing native production script in the foreground while a bounded background poll opens the URL after the storage health endpoint succeeds.
- [x] Document copying it to `~/Desktop/tradeReview.command`, applying execute permission, and stopping the service by closing its Terminal session.
- [x] Run `zsh -n deploy/ops/tradeReview.command` and inspect the resulting diff.

### Task 2: Install and verify the desktop launcher

**Files:**
- Install copy: `/Users/zhoulin/Desktop/tradeReview.command`

**Interfaces:**
- Consumes: the committed source script from Task 1.
- Produces: executable desktop file named exactly `tradeReview.command`.

- [x] Copy source to the desktop and set executable permission.
- [x] Verify filename, executable mode, and byte identity with the repository source.
- [x] Exercise an existing official service path: the launcher opens the official URL and does not start another server.
- [x] Exercise port-conflict handling against a disposable local listener, then verify that process is still alive.
- [x] Record observed result and restore the port to its pre-check state.

- [x] Implementation and acceptance record committed on the task branch.
