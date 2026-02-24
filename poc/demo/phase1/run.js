/**
 * Phase 1 PoC runner: start payment-unaware upstream on 3010 (private, NOT published),
 * then start the gateway on 3005 (published).
 *
 * Gateway is started exactly like baseline: `npm run dev` -> ts-node src/server.ts
 * (No dist build output exists in this repo baseline.)
 */

const { spawn } = require("child_process");

function start(cmd, args, name) {
  const p = spawn(cmd, args, {
    stdio: "inherit",
    env: process.env,
  });

  p.on("exit", (code, signal) => {
    console.error(`[poc] ${name} exited code=${code} signal=${signal}`);
    process.exit(code ?? 1);
  });

  return p;
}

const upstreamPort = process.env.UPSTREAM_PORT || "3010";
const gatewayPort = process.env.PORT || "3005";

console.log(`[poc] starting upstream on :${upstreamPort}`);
start("node", ["poc/demo/phase1/upstream/server.js"], "upstream");

console.log(`[poc] starting gateway on :${gatewayPort}`);

// Run the gateway exactly as you do on host.
start("npm", ["run", "dev"], "gateway");
