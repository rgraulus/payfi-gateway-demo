// scripts/ci_run_m4.mjs
import { spawn } from "child_process";
import net from "net";

function isWin() {
  return process.platform === "win32";
}

function npmCmd() {
  // Windows needs npm.cmd, but we also use shell:true for reliability under MINGW/Git Bash.
  return isWin() ? "npm.cmd" : "npm";
}

function spawnLogged(cmd, args, env, extraOpts = {}) {
  const p = spawn(cmd, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
    ...extraOpts,
  });

  p.on("error", (err) => {
    console.error(`[ci:m4] ERROR: spawn failed for ${cmd} ${args.join(" ")}:`, err);
    process.exit(1);
  });

  p.on("exit", (code) => {
    if (code && code !== 0) process.exit(code);
  });

  return p;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHttpOk(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url, { method: "GET" });
      if (r.ok) return true;
    } catch {
      // ignore while starting
    }
    await sleep(100);
  }
  return false;
}

function tryListen(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.unref();

    s.on("error", () => resolve(null));

    s.listen({ port, host: "127.0.0.1" }, () => {
      const addr = s.address();
      const p = typeof addr === "object" && addr ? addr.port : null;
      s.close(() => resolve(p));
    });
  });
}

async function pickOpenPort(preferredPort) {
  const base = Number(preferredPort);
  const candidates = [];

  if (Number.isFinite(base) && base > 0) candidates.push(base);

  const start = Number.isFinite(base) && base > 0 ? base + 1 : 3005;
  for (let p = start; p < start + 30; p++) candidates.push(p);

  // finally, OS-chosen free port
  candidates.push(0);

  for (const p of candidates) {
    const got = await tryListen(p);
    if (got) return got;
  }
  throw new Error("Unable to find a free TCP port");
}

function runHarness(script, env) {
  return new Promise((resolve, reject) => {
    const p = spawn("bash", [script], { stdio: "inherit", env });
    p.on("error", (err) => reject(err));
    p.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${script} failed: ${code}`))
    );
  });
}

(async () => {
  const preferredGatewayPort = process.env.PORT || "3005";
  const gatewayPort = await pickOpenPort(preferredGatewayPort);

  const BASE = process.env.BASE || `http://127.0.0.1:${gatewayPort}`;
  const JWKS_URL =
    process.env.CRP_JWKS_URL || "http://127.0.0.1:8088/.well-known/jwks.json";
  const UPSTREAM_PORT = process.env.UPSTREAM_PORT || "3010";

  console.log(`[ci:m4] gatewayPort=${gatewayPort}`);
  console.log(`[ci:m4] BASE=${BASE}`);
  console.log(`[ci:m4] UPSTREAM_PORT=${UPSTREAM_PORT}`);
  console.log(`[ci:m4] CRP_JWKS_URL=${JWKS_URL}`);

  // Start upstream
  const upstream = spawnLogged("node", ["scripts/ci_upstream_server.mjs"], {
    UPSTREAM_PORT,
  });

  // Start gateway
  // KEY FIX: On Windows/MINGW, spawn npm via shell:true to avoid spawn EINVAL/ENOENT issues.
  const gateway = spawnLogged(
    npmCmd(),
    ["run", "dev"],
    {
      PORT: String(gatewayPort),
      X402_ALLOW_DEV_HARNESS: "true",
      CRP_JWKS_URL: JWKS_URL,
      X402_DEV_RECEIPT_REQUIRE_SIG: "true",
      NODE_ENV: process.env.NODE_ENV || "development",
    },
    isWin() ? { shell: true } : {}
  );

  const cleanup = () => {
    try { upstream.kill("SIGTERM"); } catch {}
    try { gateway.kill("SIGTERM"); } catch {}
  };

  process.on("SIGINT", () => {
    cleanup();
    process.exit(1);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(1);
  });

  // Wait for gateway readiness
  const ok = await waitForHttpOk(`${BASE}/healthz`, 15000);
  if (!ok) {
    cleanup();
    throw new Error(`[ci:m4] gateway did not become ready at ${BASE}/healthz`);
  }

  // Harness env: DO NOT pass NONCE if empty, otherwise harness treats it as explicitly set = "".
  const harnessEnv = {
    ...process.env,
    WAIT_FOR_USER: "false",
    BASE,
    UPSTREAM_PORT,
  };

  if (process.env.NONCE && String(process.env.NONCE).trim().length > 0) {
    harnessEnv.NONCE = String(process.env.NONCE).trim();
  } else {
    delete harnessEnv.NONCE;
  }

  try {
    await runHarness("./scripts/phase_b_paid_proxy_harness.sh", { ...harnessEnv });
    await runHarness("./scripts/phase_d_nonfinalized_receipt_harness.sh", { ...harnessEnv });
  } finally {
    cleanup();
  }

  console.log("[ci:m4] DONE: all harnesses passed");
})().catch((err) => {
  console.error("[ci:m4] ERROR:", err);
  process.exit(1);
});
