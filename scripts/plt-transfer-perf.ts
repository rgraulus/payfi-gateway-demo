#!/usr/bin/env ts-node
/**
 * PLT transfer helper (PERF clone) for autorun E2E.
 *
 * Goals:
 * - Keep stdout machine-friendly: prints ONLY tx hash to stdout.
 * - Add perf timings to stderr (safe, opt-in via e2e-perf-proxy.sh only).
 * - Optional: allow --decimals <n> to skip on-chain token info lookup (EUDemo=6).
 *
 * Patch:
 * - Emit ONE machine-parseable perf line to stderr (prefixed with "PERF_PAYER ").
 */

import { existsSync, readFileSync } from "node:fs";

type Args = Record<string, string | boolean>;

function usage(exitCode = 0): never {
  const msg = `
Usage:
  ./scripts/plt-transfer-perf.ts --wallet keys/wallet.export --to <ACCOUNT_ADDRESS> --tokenId EUDemo --amount 0.050101

Required:
  --wallet <path>     Path to wallet.export (parseWallet)
  --to <address>      Recipient account address (base58)
  --tokenId <id>      TokenId (e.g., EUDemo)
  --amount <decimal>  Amount as decimal string (e.g., 0.050101)

Optional:
  --grpcHost <host>   Default: grpc.testnet.concordium.com
  --grpcPort <port>   Default: 20000
  --memo <string>     Optional memo (best-effort; not used for correlation)
  --wait              Wait for finalization (default)
  --no-wait           Do NOT wait for finalization
  --decimals <n>      Skip token-info lookup and use decimals directly (e.g., 6)
  --help              Show help

Output:
  Prints the submitted transaction hash to stdout.
  Logs human/perf output to stderr.
`;
  console.error(msg.trim() + "\n");
  process.exit(exitCode);
}

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    if (key === "help") out.help = true;
    else if (key === "wait") out.wait = true;
    else if (key === "no-wait") out["no-wait"] = true;
    else {
      const v = argv[i + 1];
      if (!v || v.startsWith("--")) {
        out[key] = true;
      } else {
        out[key] = v;
        i++;
      }
    }
  }
  return out;
}

function reqStr(args: Args, k: string): string {
  const v = args[k];
  if (typeof v !== "string" || v.length === 0) {
    console.error(`ERROR: missing required --${k}`);
    usage(2);
  }
  return v;
}

function nowMs(): number {
  return Date.now();
}
function fmtMs(ms: number): string {
  return `${(ms / 1000).toFixed(3)}s`;
}
function ms(ms: number): number {
  return Math.max(0, Math.round(ms));
}

/**
 * Emit one machine-parseable line to stderr.
 * Format: key=value pairs, space-separated, prefixed with "PERF_PAYER ".
 * Values are milliseconds (integers) unless otherwise noted.
 *
 * Example:
 * PERF_PAYER version=1 imports_ms=718 client_ms=23 ... finalize_wait_ms=5957 total_ms=7478 wait=1 decimals=6 tokenId=EUDemo
 */
function emitPerfLine(fields: Record<string, string | number | boolean>) {
  const parts: string[] = ["PERF_PAYER"];
  for (const [k, v] of Object.entries(fields)) {
    const val =
      typeof v === "boolean" ? (v ? "1" : "0") : typeof v === "number" ? String(v) : v;
    // Keep it safe for parsing: no whitespace/newlines in values
    parts.push(`${k}=${String(val).replace(/\s+/g, "_")}`);
  }
  console.error(parts.join(" "));
}

async function main() {
  const t0 = nowMs();

  const args = parseArgs(process.argv.slice(2));
  if (args.help) usage(0);

  const walletPath = reqStr(args, "wallet");
  const toAddr = reqStr(args, "to");
  const tokenIdStr = reqStr(args, "tokenId");
  const amountStr = reqStr(args, "amount");

  const grpcHost = (args.grpcHost as string) || "grpc.testnet.concordium.com";
  const grpcPort = Number((args.grpcPort as string) || "20000");

  const wait = args["no-wait"] === true ? false : true; // default wait=true
  const memoStr = typeof args.memo === "string" ? (args.memo as string) : undefined;

  const decimalsArg = typeof args.decimals === "string" ? Number(args.decimals) : undefined;
  if (
    decimalsArg !== undefined &&
    (!Number.isFinite(decimalsArg) || decimalsArg < 0 || decimalsArg > 18)
  ) {
    console.error(`ERROR: invalid --decimals value: ${args.decimals}`);
    usage(2);
  }

  if (!existsSync(walletPath)) {
    console.error(`ERROR: wallet file not found: ${walletPath}`);
    process.exit(2);
  }

  // ---- Dynamic ESM imports (fix for TS1479 in ts-node CommonJS) ----
  const tImports0 = nowMs();
  const webSdk = await import("@concordium/web-sdk");
  const pltSdk = await import("@concordium/web-sdk/plt");
  const nodeSdk = await import("@concordium/web-sdk/nodejs");
  const grpc = await import("@grpc/grpc-js");
  const tImports1 = nowMs();

  const {
    AccountAddress,
    parseWallet,
    buildAccountSigner,
    isKnown,
    TransactionSummaryType,
    TransactionKindString,
    RejectReasonTag,
  } = webSdk;

  const { TokenId, TokenAmount, Token, TokenHolder, Cbor } = pltSdk;
  const { ConcordiumGRPCNodeClient } = nodeSdk;
  const { credentials } = grpc;

  const tClient0 = nowMs();
  const client = new ConcordiumGRPCNodeClient(grpcHost, grpcPort, credentials.createSsl());
  const tClient1 = nowMs();

  const tWallet0 = nowMs();
  const walletFile = readFileSync(walletPath, "utf8");
  const walletExport = parseWallet(walletFile);
  const sender = AccountAddress.fromBase58(walletExport.value.address);
  const signer = buildAccountSigner(walletExport);
  const tWallet1 = nowMs();

  const tokenId = TokenId.fromString(tokenIdStr);

  // Resolve decimals: either from flag or chain lookup.
  let decimals: number;
  let token: any;

  const tDecimals0 = nowMs();
  if (decimalsArg !== undefined) {
    decimals = decimalsArg;
    token = await Token.fromId(client, tokenId);
  } else {
    token = await Token.fromId(client, tokenId);
    decimals = token.info.state.decimals;
  }
  const tDecimals1 = nowMs();

  const tAmount0 = nowMs();
  const amount = TokenAmount.fromDecimal(amountStr, decimals);
  const recipient = TokenHolder.fromAccountAddress(AccountAddress.fromBase58(toAddr)).address;
  const tAmount1 = nowMs();

  // Memo optional/best-effort.
  let memo: unknown = undefined;
  const tMemo0 = nowMs();
  if (memoStr) {
    const maybeCborMemo = (pltSdk as any).CborMemo;
    if (maybeCborMemo && typeof maybeCborMemo.fromString === "function") {
      memo = maybeCborMemo.fromString(memoStr);
    } else {
      console.error(
        "WARN: memo requested but CborMemo.fromString not available in this SDK build; skipping memo."
      );
    }
  }
  const tMemo1 = nowMs();

  const transfer: any = { recipient, amount, memo };

  console.error(
    `[payer:plt:perf] tokenId=${tokenIdStr} decimals=${decimals} amount=${amountStr} to=${toAddr} sender=${walletExport.value.address} wait=${wait}`
  );

  const tSubmit0 = nowMs();
  const txHash = await Token.transfer(token, sender, transfer, signer);
  const tSubmit1 = nowMs();

  // stdout ONLY: tx hash
  process.stdout.write(String(txHash) + "\n");

  let tFinal0 = 0;
  let tFinal1 = 0;

  if (wait) {
    tFinal0 = nowMs();
    const result = await client.waitForTransactionFinalization(txHash);
    tFinal1 = nowMs();

    if (!isKnown(result.summary)) {
      console.error("ERROR: unexpected transaction outcome (unknown summary)");
      process.exit(1);
    }
    if (result.summary.type !== TransactionSummaryType.AccountTransaction) {
      console.error(`ERROR: unexpected summary type: ${result.summary.type}`);
      process.exit(1);
    }

    switch (result.summary.transactionType) {
      case TransactionKindString.TokenUpdate:
        console.error("[payer:plt:perf] finalized: TokenUpdate");
        break;
      case TransactionKindString.Failed: {
        console.error("[payer:plt:perf] finalized: FAILED");
        if (result.summary.rejectReason?.tag === RejectReasonTag.TokenUpdateTransactionFailed) {
          const details = Cbor.decode(result.summary.rejectReason.contents.details);
          console.error(result.summary.rejectReason.contents, details);
        } else {
          console.error(result.summary.rejectReason);
        }
        process.exit(1);
        break;
      }
      default:
        console.error(`ERROR: unexpected transaction kind: ${result.summary.transactionType}`);
        process.exit(1);
    }
  }

  const t1 = nowMs();

  // Human-friendly timings (stderr only)
  console.error(
    [
      `[payer:plt:perf] timing imports=${fmtMs(tImports1 - tImports0)}`,
      `client=${fmtMs(tClient1 - tClient0)}`,
      `wallet=${fmtMs(tWallet1 - tWallet0)}`,
      `decimals+token=${fmtMs(tDecimals1 - tDecimals0)}`,
      `amount=${fmtMs(tAmount1 - tAmount0)}`,
      `memo=${fmtMs(tMemo1 - tMemo0)}`,
      `submit=${fmtMs(tSubmit1 - tSubmit0)}`,
      wait ? `finalize_wait=${fmtMs(tFinal1 - tFinal0)}` : `finalize_wait=0.000s`,
      `total=${fmtMs(t1 - t0)}`,
    ].join(" ")
  );

  // NEW: Machine-parseable one-liner (stderr only)
  emitPerfLine({
    version: 1,
    wait,
    tokenId: tokenIdStr,
    decimals,
    grpcHost,
    grpcPort,
    imports_ms: ms(tImports1 - tImports0),
    client_ms: ms(tClient1 - tClient0),
    wallet_ms: ms(tWallet1 - tWallet0),
    decimals_token_ms: ms(tDecimals1 - tDecimals0),
    amount_ms: ms(tAmount1 - tAmount0),
    memo_ms: ms(tMemo1 - tMemo0),
    submit_ms: ms(tSubmit1 - tSubmit0),
    finalize_wait_ms: wait ? ms(tFinal1 - tFinal0) : 0,
    total_ms: ms(t1 - t0),
    txHash: String(txHash),
  });
}

main().catch((e) => {
  console.error("ERROR:", e?.stack || e);
  process.exit(1);
});
