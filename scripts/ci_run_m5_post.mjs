#!/usr/bin/env node
/**
 * scripts/ci_run_m5_post.mjs
 *
 * CI runner for M5 POST flows.
 *
 * What this script does:
 *  1) Ensures port 3005 is free
 *  2) Starts the gateway on port 3005 (dev harness enabled)
 *  3) Runs POST Phase B harness (paid + replay)
 *  4) Runs POST Phase D harness (pending settlement)
 *  5) Shuts everything down cleanly
 *
 * Key Windows fix:
 *  - Use "cmd.exe /d /s /c <command>" to avoid spawn EINVAL when launching npm from MSYS/Git-Bash.
 */

import { spawn } from "child_process";
import net from "net";
import path from "path";
import process from "process";

const ROOT = path.resolve(process.cwd());
const GATEWAY_PORT = 3005;

const isWin = process.platform === "win32";
const CMD = isWin ? "cmd.exe" : null;

const BASH = isWin ? "bash.exe" : "bash";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const sock = net.createConnection({ port, host: "127.0.0.1" });
    sock.once("connect", () => {
      sock.end();
      resolve(true);
    });
    sock.once("error", () => {
      sock.destroy();
      resolve(false);
    });
  });
}

async function waitForPortOpen(port, timeoutMs = 15_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(port)) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for port ${port} to open`);
}

async function waitForPortClosed(port, timeoutMs = 15_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!(await isPortOpen(port))) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for port ${port} to close`);
}

/**
 * Spawn helper that avoids Windows EINVAL by using cmd.exe when needed.
 */
function spawnCommand(commandLine, opts = {}) {
  if (isWin) {
    // cmd.exe parsing requires a single string after /c
    return spawn(CMD, ["/d", "/s", "/c", commandLine], {
      cwd: ROOT,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
      ...opts,
    });
  }

  // On non-Windows: execute via shell so we can pass a single command line
  return spawn("sh", ["-lc", commandLine], {
    cwd: ROOT,
    env: process.env,
    stdio: "inherit",
    ...opts,
  });
}

function runBash(scriptPath, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(BASH, [scriptPath], {
      cwd: ROOT,
      env: { ...process.env, ...extraEnv },
      stdio: "inherit",
      windowsHide: true,
    });
    p.on("error", reject);
    p.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${BASH} exited with code ${code}`));
    });
  });
}

/**
 * Robust gateway start on Windows/MSYS:
 * - Uses cmd.exe to run npm, avoiding spawn EINVAL
 */
function startGateway() {
  const env = {
    ...process.env,
    X402_ALLOW_DEV_HARNESS: "true",
    NODE_ENV: "development",
    CRP_JWKS_URL: "http://127.0.0.1:8088/.well-known/jwks.json",
  };

  if (isWin) {
    // Use SET to apply env only to this command, then run npm.
    const cmdLine =
      `set "X402_ALLOW_DEV_HARNESS=true" && ` +
      `set "NODE_ENV=development" && ` +
      `set "CRP_JWKS_URL=http://127.0.0.1:8088/.well-known/jwks.json" && ` +
      `npm run dev`;

    const p = spawn(CMD, ["/d", "/s", "/c", cmdLine], {
      cwd: ROOT,
      env,
      stdio: "inherit",
      windowsHide: true,
    });

    p.on("error", (e) => {
      console.error("[ci:m5-post] gateway spawn error:", e);
    });

    return p;
  }

  // Non-Windows
  const p = spawn("npm", ["run", "dev"], {
    cwd: ROOT,
    env,
    stdio: "inherit",
  });

  p.on("error", (e) => {
    console.error("[ci:m5-post] gateway spawn error:", e);
  });

  return p;
}

async function main() {
  console.log(`[ci:m5-post] starting gateway on :${GATEWAY_PORT}`);

  // Fail fast if port is already taken
  if (await isPortOpen(GATEWAY_PORT)) {
    throw new Error(`port ${GATEWAY_PORT} is already open. Stop the existing gateway and retry.`);
  }

  const gateway = startGateway();

  try {
    await waitForPortOpen(GATEWAY_PORT);
    console.log("[ci:m5-post] gateway is listening");

    console.log("[ci:m5-post] running POST Phase B harness");
    await runBash("scripts/phase_b_paid_proxy_post_harness.sh");

    console.log("[ci:m5-post] running POST Phase D (pending settlement) harness");
    await runBash("scripts/phase_d_paid_proxy_post_pending_harness.sh");

    console.log("[ci:m5-post] DONE: all POST harnesses passed");
    process.exitCode = 0;
  } catch (err) {
    console.error("[ci:m5-post] ERROR:", err?.stack || err?.message || err);
    process.exitCode = 1;
  } finally {
    console.log("[ci:m5-post] shutting down gateway");
    try {
      gateway.kill("SIGTERM");
    } catch {}

    // Best-effort: wait for port to close so we don't leave a zombie listener
    try {
      await waitForPortClosed(GATEWAY_PORT, 10_000);
    } catch (e) {
      console.error("[ci:m5-post] WARNING:", e?.message || e);
      console.error("[ci:m5-post] If port is still open, kill the owning node.exe PID (Get-NetTCPConnection -LocalPort 3005).");
    }
  }
}

main().catch((e) => {
  console.error(e?.stack || e);
  process.exit(1);
});
